/**
 * The access token is held in module scope rather than localStorage: a value
 * never written to storage cannot be read back out of it by injected script.
 * The cost is that a reload starts with no token, which is what the
 * refresh-on-boot flow in client.ts exists to cover.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
