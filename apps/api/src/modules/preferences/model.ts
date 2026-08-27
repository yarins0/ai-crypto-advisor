import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

import type { AssetId, ContentType, InvestorType, RiskTolerance } from '@aca/shared';

/** Shape of a persisted preference document. */
export interface PreferenceAttributes {
  userId: Types.ObjectId;
  assets: AssetId[];
  investorType: InvestorType;
  contentTypes: ContentType[];
  riskTolerance: RiskTolerance;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type PreferenceDocument = HydratedDocument<PreferenceAttributes>;

const preferenceSchema = new Schema<PreferenceAttributes>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    assets: { type: [String], required: true },
    investorType: { type: String, required: true },
    contentTypes: { type: [String], required: true },
    riskTolerance: { type: String, required: true },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

// The `unique: true` above, not a pre-check, is what makes the upsert in
// upsertPreferences() safe under concurrent submissions from the same user.
export const PreferenceModel = mongoose.model<PreferenceAttributes>('Preference', preferenceSchema);
