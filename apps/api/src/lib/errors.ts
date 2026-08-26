/**
 * A carrier for errors that already know their HTTP status, so route
 * handlers can throw domain errors instead of building responses inline.
 * `errorHandler` reads `status` and `message` straight off this class.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
