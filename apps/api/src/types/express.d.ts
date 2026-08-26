/**
 * Augments Express's Request with the fields our middleware attaches, so
 * downstream handlers get `req.userId` typed without a cast.
 */
declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth from a verified access token. */
      userId?: string;
    }
  }
}

export {};
