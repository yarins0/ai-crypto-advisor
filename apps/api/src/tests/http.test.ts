import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchOk } from '../lib/http.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchOk', () => {
  it('returns the response on a 2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    const response = await fetchOk('https://example.com/data');

    expect(response.status).toBe(200);
  });

  it('throws on a non-2xx status, with the status in the message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));

    await expect(fetchOk('https://example.com/data')).rejects.toThrow(/503/);
  });

  it('sets a User-Agent header on the outgoing request', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await fetchOk('https://example.com/data');

    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);
    expect(headers.get('User-Agent')).toBeTruthy();
  });

  it('applies a request timeout via an abort signal', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await fetchOk('https://example.com/data');

    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(requestInit.signal).toBeInstanceOf(AbortSignal);
  });
});
