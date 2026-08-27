import mongoose, { Schema } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';

import type { AssetId, ContentSource, ContentType, InvestorType } from '@aca/shared';

export interface VoteItemMeta {
  title?: string;
  coinId?: string;
  source?: ContentSource;
  model?: string;
}

export interface VoteContext {
  preferenceVersion: number;
  assets: AssetId[];
  investorType: InvestorType;
  contentTypes: ContentType[];
  servedAt: Date;
  itemMeta: VoteItemMeta;
}

/** Shape of a persisted vote document. */
export interface VoteAttributes {
  userId: Types.ObjectId;
  section: ContentType;
  itemId: string;
  value: 1 | -1;
  context: VoteContext;
  createdAt: Date;
  updatedAt: Date;
}

export type VoteDocument = HydratedDocument<VoteAttributes>;

const voteItemMetaSchema = new Schema<VoteItemMeta>(
  {
    title: { type: String },
    coinId: { type: String },
    source: { type: String },
    model: { type: String },
  },
  { _id: false },
);

const voteContextSchema = new Schema<VoteContext>(
  {
    preferenceVersion: { type: Number, required: true },
    assets: { type: [String], required: true },
    investorType: { type: String, required: true },
    contentTypes: { type: [String], required: true },
    servedAt: { type: Date, required: true },
    itemMeta: { type: voteItemMetaSchema, required: true },
  },
  { _id: false },
);

const voteSchema = new Schema<VoteAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    section: { type: String, required: true },
    itemId: { type: String, required: true },
    value: { type: Number, required: true },
    context: { type: voteContextSchema, required: true },
  },
  { timestamps: true },
);

// The `unique: true` below, not a read-then-write check, is what makes a
// re-vote on the same item an update rather than a duplicate under
// concurrent requests — same pattern as PreferenceModel's userId index.
voteSchema.index({ userId: 1, section: 1, itemId: 1 }, { unique: true });

export const VoteModel = mongoose.model<VoteAttributes>('Vote', voteSchema);
