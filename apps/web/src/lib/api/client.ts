import { authResponseSchema } from '@aca/shared';
import type { AuthResponse } from '@aca/shared';

import { getAccessToken, setAccessToken } from './session.js';

const REFRESH_PATH = '/api/auth/refresh';
const UNAUTHORIZED_STATUS = 401;
const UNKNOWN_ERROR_MESSAGE = 'Something went wrong';

/**
 * Structural stand-in for a Zod schema, so the transport layer carries no
 * dependency on zod itself. Every schema in `@aca/shared` satisfies it.
 */
interface ResponseParser<TData> {
  parse: (data: unknown) => TData;
}

interface ApiRequestInit {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
}

/** The one error shape the API emits, per its central error handler. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readFields(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const fields: Record<string, string> = {};
  for (const [name, message] of Object.entries(value)) {
    if (typeof message === 'string') {
      fields[name] = message;
    }
  }
  return fields;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) {
    return new ApiError(response.status, UNKNOWN_ERROR_MESSAGE);
  }
  const message = typeof body.error === 'string' ? body.error : UNKNOWN_ERROR_MESSAGE;
  return new ApiError(response.status, message, readFields(body.fields));
}

function buildInit({ method = 'GET', body }: ApiRequestInit): RequestInit {
  const headers = new Headers();
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  return {
    method,
    headers,
    // Same-origin in development (Vite proxy) and in production (Vercel
    // rewrite), but stated so the VITE_API_URL escape hatch still sends the
    // refresh cookie.
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

async function sendRequest(path: string, options: ApiRequestInit): Promise<Response> {
  // buildInit runs per attempt so a retry after a refresh carries the new access
  // token; reusing one init object would replay the token that just got a 401.
  return fetch(path, buildInit(options));
}

async function readResponse<TData>(
  response: Response,
  parser: ResponseParser<TData>,
): Promise<TData> {
  if (!response.ok) {
    throw await toApiError(response);
  }
  // Parsing against the shared schema turns a backend contract change into a
  // loud failure here rather than an undefined surfacing deep in a component.
  return parser.parse(await response.json());
}

/**
 * Shared by every concurrent caller so the refresh endpoint is hit exactly once.
 * The API's reuse interval keeps a parallel refresh from revoking the session,
 * but the loser still burns a rotation and strands a token nothing holds.
 */
let refreshInFlight: Promise<AuthResponse> | null = null;

async function requestRefresh(): Promise<AuthResponse> {
  try {
    // Calls sendRequest directly rather than apiRequest: routing the refresh
    // through the 401 retry below would make it retry itself forever.
    const session = await readResponse(
      await sendRequest(REFRESH_PATH, { method: 'POST' }),
      authResponseSchema,
    );
    setAccessToken(session.accessToken);
    return session;
  } catch (error) {
    // A dead session must not keep a stale token attached to later requests,
    // where it would mask the logged-out state behind a generic 401.
    setAccessToken(null);
    throw error;
  }
}

export async function refreshSession(): Promise<AuthResponse> {
  refreshInFlight ??= requestRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiRequest<TData>(
  path: string,
  parser: ResponseParser<TData>,
  options: ApiRequestInit = {},
): Promise<TData> {
  // Read before the send so it reflects what the request actually carried. A 401
  // on a request with no Authorization header is the endpoint's own verdict —
  // refreshing cannot repair it and would discard its message for the refresh's.
  const hadAccessToken = getAccessToken() !== null;
  const response = await sendRequest(path, options);
  if (response.status !== UNAUTHORIZED_STATUS || !hadAccessToken) {
    return readResponse(response, parser);
  }
  // Exactly one retry: with a freshly minted access token the request either
  // succeeds or the 401 was never about expiry.
  await refreshSession();
  return readResponse(await sendRequest(path, options), parser);
}

/** Logout answers 204, so there is no body for a parser to read. */
export async function apiRequestVoid(path: string, options: ApiRequestInit = {}): Promise<void> {
  const response = await sendRequest(path, options);
  if (!response.ok) {
    throw await toApiError(response);
  }
}
