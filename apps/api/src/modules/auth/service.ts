import { randomBytes, createHmac } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

import type { LoginRequest, PublicUser, RegisterRequest } from '@aca/shared';

import { env } from '../../env.js';
import { HttpError } from '../../lib/errors.js';
import { RefreshTokenModel } from './refresh-token.model.js';
import type { RefreshTokenDocument } from './refresh-token.model.js';
import { UserModel } from './user.model.js';
import type { UserDocument } from './user.model.js';

/** Session handed back to the route layer after any auth operation. */
export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 48;
const MS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 86_400;
// RFC 9700 §4.14.2 "reuse interval": long enough to absorb a dropped response
// or a second tab booting on the same cookie, short enough that a thief racing
// the owner gains seconds rather than a session.
const REFRESH_REUSE_GRACE_MS = 3 * MS_PER_SECOND;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token';
const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';
// Compared against when no user matches, so login costs the same either way.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-parity', BCRYPT_ROUNDS);

/** Narrows a user document to the fields that are safe to send to a client. */
function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
    isDemo: user.isDemo,
  };
}

/** Carries no claims beyond the subject, so a leaked token discloses nothing. */
function issueAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    // Cast is unavoidable: jsonwebtoken accepts only its own branded
    // StringValue, which env.ts has already validated this against.
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

/**
 * Peppered rather than plain SHA-256: the pepper never leaves the server, so
 * the read-only database access handed to reviewers cannot match a captured
 * token to its row.
 */
function hashRefreshToken(rawToken: string): string {
  return createHmac('sha256', env.REFRESH_TOKEN_PEPPER).update(rawToken).digest('hex');
}

/**
 * Deliberately not a JWT. A signature buys trust without a database lookup,
 * but this token is looked up on every use regardless; being stored is what
 * makes it individually revocable, which logout and theft response require.
 */
async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * SECONDS_PER_DAY * MS_PER_SECOND,
  );
  await RefreshTokenModel.create({ userId, tokenHash: hashRefreshToken(rawToken), expiresAt });
  return rawToken;
}

async function createSession(user: UserDocument): Promise<AuthSession> {
  const userId = user._id.toString();
  const accessToken = issueAccessToken(userId);
  const refreshToken = await createRefreshToken(userId);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

/**
 * No pre-check for an existing email: the unique index rejects the insert and
 * the error handler maps that to a 409. A pre-check would leave a race window
 * between the read and the write.
 */
export async function registerUser(input: RegisterRequest): Promise<AuthSession> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await UserModel.create({ email: input.email, name: input.name, passwordHash });
  return createSession(user);
}

/**
 * An unknown email and a wrong password fail identically, in both message and
 * timing, so neither can be used to enumerate registered addresses.
 */
export async function loginUser(input: LoginRequest): Promise<AuthSession> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  const isPasswordValid = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !isPasswordValid) {
    throw new HttpError(401, INVALID_CREDENTIALS_MESSAGE);
  }
  return createSession(user);
}

/**
 * Both conditions are load-bearing. Liveness alone would forgive a replay days
 * later, while the owner's session is still running; the interval alone would
 * forgive the tokens a logout or a family revocation has just stamped, since
 * those are revoked "recently" too.
 */
async function isConcurrentRotation(tokenDocument: RefreshTokenDocument): Promise<boolean> {
  const { revokedAt } = tokenDocument;
  if (!revokedAt || Date.now() - revokedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
    return false;
  }
  const successor = await RefreshTokenModel.exists({
    userId: tokenDocument.userId,
    revokedAt: null,
  });
  return successor !== null;
}

/**
 * Replaying an already-revoked token is read as theft, and revoking the user's
 * whole family logs out thief and owner alike. The exception is a lost rotation
 * race — two tabs booting on one cookie — which is far likelier than an attacker
 * striking in the same few seconds and leaves a live successor behind to prove it.
 */
export async function rotateRefreshToken(rawToken: string): Promise<AuthSession> {
  const tokenHash = hashRefreshToken(rawToken);
  const tokenDocument = await RefreshTokenModel.findOne({ tokenHash });

  if (!tokenDocument) {
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }
  const isReplay = tokenDocument.revokedAt !== null;
  if (isReplay && !(await isConcurrentRotation(tokenDocument))) {
    await RefreshTokenModel.updateMany(
      { userId: tokenDocument.userId, revokedAt: null },
      { revokedAt: new Date() },
    );
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }
  if (tokenDocument.expiresAt <= new Date()) {
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  // Anchored to the first revocation and never re-stamped: sliding the window
  // forward on each replay would keep a stolen token valid indefinitely.
  if (!tokenDocument.revokedAt) {
    tokenDocument.revokedAt = new Date();
    await tokenDocument.save();
  }

  const user = await UserModel.findById(tokenDocument.userId);
  if (!user) {
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }
  return createSession(user);
}

/** Matches only unrevoked tokens, which keeps logout idempotent. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshTokenModel.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
}

export async function getPublicUser(userId: string): Promise<PublicUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  return toPublicUser(user);
}
