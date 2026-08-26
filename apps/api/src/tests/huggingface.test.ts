import { afterEach, describe, expect, it, vi } from 'vitest';

import { chatCompletion } from '../integrations/huggingface.js';

afterEach(() => {
  // fileParallelism is disabled, so every test file shares one worker; a
  // leaked fetch stub, stubbed env, or re-imported module graph here would
  // poison tests in files run after this one.
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

// env.ts parses process.env at import time, so exercising the token-present
// path means stubbing the env and re-importing the module graph fresh.
async function importWithToken(): Promise<typeof import('../integrations/huggingface.js')> {
  vi.resetModules();
  vi.stubEnv('HUGGINGFACE_API_TOKEN', 'test-token');
  vi.stubEnv('HUGGINGFACE_MODEL', 'test-model');
  return import('../integrations/huggingface.js');
}

function mockFetchOnce(body: unknown, status = 200): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe('chatCompletion', () => {
  // HUGGINGFACE_API_TOKEN is not set by src/tests/setup.ts.
  it('rejects without a configured token and never calls fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(chatCompletion([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'HUGGINGFACE_API_TOKEN is not configured',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the assistant text on a valid 200', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'hello there' } }] });
    const { chatCompletion: chatCompletionWithToken } = await importWithToken();

    const result = await chatCompletionWithToken([{ role: 'user', content: 'hi' }]);

    expect(result).toBe('hello there');
  });

  it('sends the chat-completions request with the bearer token and model', async () => {
    const fetchSpy = mockFetchOnce({ choices: [{ message: { content: 'hello there' } }] });
    const { chatCompletion: chatCompletionWithToken } = await importWithToken();
    const messages = [{ role: 'user', content: 'hi' } as const];

    await chatCompletionWithToken(messages);

    const [requestedUrl, requestInit] = fetchSpy.mock.calls[0] ?? [];
    expect(String(requestedUrl)).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(requestInit?.method).toBe('POST');
    const headers = new Headers(requestInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
    const body = JSON.parse(String(requestInit?.body)) as { model: string; messages: unknown };
    expect(body.model).toBe('test-model');
    expect(body.messages).toEqual(messages);
  });

  it('rejects when choices is empty', async () => {
    mockFetchOnce({ choices: [] });
    const { chatCompletion: chatCompletionWithToken } = await importWithToken();

    await expect(chatCompletionWithToken([{ role: 'user', content: 'hi' }])).rejects.toThrow();
  });

  it('rejects on a malformed response shape', async () => {
    mockFetchOnce({ choices: [{ message: {} }] });
    const { chatCompletion: chatCompletionWithToken } = await importWithToken();

    await expect(chatCompletionWithToken([{ role: 'user', content: 'hi' }])).rejects.toThrow();
  });
});
