import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

/** Shape of a persisted refresh-token document. */
export interface RefreshTokenAttributes {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type RefreshTokenDocument = HydratedDocument<RefreshTokenAttributes>;

const refreshTokenSchema = new Schema<RefreshTokenAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL index: MongoDB's background reaper deletes a document once its
// `expiresAt` is in the past, so expired tokens self-clean with no cron job.
refreshTokenSchema.index({ expiresAt: 1 }, { expires: 0 });

export const RefreshTokenModel = mongoose.model<RefreshTokenAttributes>(
  'RefreshToken',
  refreshTokenSchema,
);
