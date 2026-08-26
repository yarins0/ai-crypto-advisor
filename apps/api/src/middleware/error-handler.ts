import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { HttpError } from '../lib/errors.js';

const DUPLICATE_KEY_ERROR_CODE = 11000;

/**
 * Mongoose does not export a class for this, so a duplicate-key error is
 * identified by shape rather than an `instanceof` check.
 */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY_ERROR_CODE
  );
}

function buildValidationFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    fields[issue.path.join('.')] = issue.message;
  }
  return fields;
}

/**
 * Central error responder. Every route funnels its errors here via `next`,
 * so response shape stays identical no matter which handler failed.
 * Express identifies this as an error handler by its four-parameter arity,
 * so all four must stay declared even when unused.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', fields: buildValidationFields(error) });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (isDuplicateKeyError(error)) {
    res.status(409).json({ error: 'Already exists' });
    return;
  }

  // The raw error can contain a query, a file path, or a library version —
  // logged for debugging but never sent to the client.
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
}
