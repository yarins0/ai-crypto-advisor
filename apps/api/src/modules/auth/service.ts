import { randomBytes, createHmac } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

import type { LoginRequest, PublicUser, RegisterRequest } from '@aca/shared';

import { env } from '../../env.js';
import { HttpError } from '../../lib/errors.js';
import { RefreshTokenModel } from './refresh-token.model.js';
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
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token';
const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required';
// Computed once at module load, never matches a real password. Used to give
// a nonexistent-user login attempt the same bcrypt.compare cost as a real one.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-parity', BCRYPT_ROUNDS);

/** Maps a persisted user document to the shape that is safe to send to clients. */
function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    onboardedAt: user.onboardedAt ? user.onboardedAt.toISOString() : null,
    isDemo: user.isDemo,
  };
}

/** Signs a short-lived access token carrying no claims beyond the subject. */
function issueAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    // env.ts validates this as a non-empty string at boot; the jsonwebtoken
    // types only accept its own branded StringValue, which a plain env var
    // can never satisfy structurally.
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

/**
 * HMACs a raw refresh token before it touches the database. A plain SHA-256
 * would let read-only database access alone (given to external reviewers)
 * match a captured token to its row. The pepper lives only on the server,
 * so a database dump alone cannot be turned back into a valid token.
 */
function hashRefreshToken(rawToken: string): string {
  return createHmac('sha256', env.REFRESH_TOKEN_PEPPER).update(rawToken).digest('hex');
}

/**
 * Issues a new refresh token for a user and persists only its hash.
 *
 * This is deliberately not a JWT. A signature exists to let a server trust a
 * token without a database round trip; here the token is looked up in the
 * database on every use anyway, so a signature would buy nothing. Being
 * stored is the point: stored means a single token can be revoked, and
 * revocable means logout and theft-response actually work.
 */
async function createRefreshToken(userId: string): Promise<string> {
  const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * SECONDS_PER_DAY * MS_PER_SECOND);
  await RefreshTokenModel.create({ userId, tokenHash: hashRefreshToken(rawToken), expiresAt });
  return rawToken;
}

/** Builds the full session — public profile, access token, and raw refresh token — for a user. */
async function createSession(user: UserDocument): Promise<AuthSession> {
  const userId = user._id.toString();
  const accessToken = issueAccessToken(userId);
  const refreshToken = await createRefreshToken(userId);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

/**
 * Creates a new user and its first session.
 *
 * No pre-check for an existing email: the unique index on `email` rejects
 * the insert instead, and the error handler maps that duplicate-key error
 * to a 409. A pre-check has a race window between the check and the insert;
 * an index does not.
 */
export async function registerUser(input: RegisterRequest): Promise<AuthSession> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await UserModel.create({ email: input.email, name: input.name, passwordHash });
  return createSession(user);
}

/**
 * Authenticates a user by email and password.
 *
 * An unknown email and a wrong password return the identical error message.
 * A distinct message for "no such account" would let an attacker enumerate
 * which addresses are registered. The lookup still runs `bcrypt.compare`
 * against a hash either way, so a missing user does not resolve conspicuously
 * faster than a wrong password.
 */
export async function loginUser(input: LoginRequest): Promise<AuthSession> {
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  // A missing user still runs bcrypt.compare against a precomputed dummy
  // hash, so a nonexistent email does not resolve conspicuously faster than
  // a wrong password would.
  const isPasswordValid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !isPasswordValid) {
    throw new HttpError(401, INVALID_CREDENTIALS_MESSAGE);
  }
  return createSession(user);
}

/**
 * Redeems a refresh token for a new session and consumes the old one.
 *
 * A refresh token found already revoked is a replay of a token that was
 * already used or already reported stolen. Every refresh token for that
 * user is revoked in response, logging out the thief and the legitimate
 * owner together — a forced re-login is the correct outcome here, a
 * silently continuing hijacked session is not.
 */
export async function rotateRefreshToken(rawToken: string): Promise<AuthSession> {
  const tokenHash = hashRefreshToken(rawToken);
  const tokenDocument = await RefreshTokenModel.findOne({ tokenHash });

  if (!tokenDocument) {
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }
  if (tokenDocument.revokedAt) {
    await RefreshTokenModel.updateMany(
      { userId: tokenDocument.userId, revokedAt: null },
      { revokedAt: new Date() },
    );
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }
  if (tokenDocument.expiresAt <= new Date()) {
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }

  tokenDocument.revokedAt = new Date();
  await tokenDocument.save();

  const user = await UserModel.findById(tokenDocument.userId);
  if (!user) {
    throw new HttpError(401, INVALID_REFRESH_TOKEN_MESSAGE);
  }
  // Rotation: a refresh token is single-use, so the response carries a
  // brand new refresh token alongside the new access token.
  return createSession(user);
}

/** Revokes a refresh token if it exists. Logout is idempotent, so a missing or already-revoked token is not an error. */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshTokenModel.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
}

/** Loads the public profile for an authenticated user. */
export async function getPublicUser(userId: string): Promise<PublicUser> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new HttpError(401, AUTHENTICATION_REQUIRED_MESSAGE);
  }
  return toPublicUser(user);
}
