import { ApiError } from './client.js';

const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/** The message to render beside one input, when the API blamed that field. */
export function getFieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.fields?.[field] : undefined;
}

/**
 * The message for a form-level banner, or null when there is nothing to show.
 * A validation failure carrying per-field messages returns null: those render
 * against their own inputs, and repeating them in a banner says nothing new.
 */
export function getFormMessage(error: unknown): string | null {
  if (error === null || error === undefined) {
    return null;
  }
  if (!(error instanceof ApiError)) {
    return UNKNOWN_ERROR_MESSAGE;
  }
  const hasFieldErrors = error.fields !== undefined && Object.keys(error.fields).length > 0;
  return hasFieldErrors ? null : error.message;
}
