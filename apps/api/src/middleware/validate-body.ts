import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Parses `req.body` against `schema` and replaces it with the parsed value.
 * Later milestones validate preference and vote bodies with this same
 * helper, so validation behavior cannot drift between routes. Failures are
 * forwarded to `next` as a ZodError — the error handler owns response shape.
 */
export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}
