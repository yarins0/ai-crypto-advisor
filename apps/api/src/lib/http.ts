const REQUEST_TIMEOUT_MS = 8_000;

/** Several public APIs reject or throttle requests that send no User-Agent. */
const USER_AGENT = 'ai-crypto-advisor/1.0 (+https://github.com/yarins0/ai-crypto-advisor)';

/**
 * Fetches with a timeout and throws on any non-2xx.
 *
 * Failures are plain Errors, never HttpError: an upstream 429 must not become
 * the status this API returns to its own client. Callers wrap this in the cache
 * helper, whose degradation path is what turns a throw into a served response —
 * which is also why no retry happens here.
 */
export async function fetchOk(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('User-Agent', USER_AGENT);

  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${url} failed with ${response.status}`);
  }

  return response;
}
