import mongoose from 'mongoose';

import type {
  ContentType,
  Vote,
  VoteRequest,
  VoteResponse,
  VoteSummaryResponse,
  VotesListResponse,
} from '@aca/shared';

import { HttpError } from '../../lib/errors.js';
import { PreferenceModel } from '../preferences/model.js';
import type { PreferenceDocument } from '../preferences/model.js';
import type { VoteContext, VoteDocument } from './model.js';
import { VoteModel } from './model.js';
import { resolveVotedItem } from './resolve-item.js';
import type { VotedItemMeta } from './resolve-item.js';

function toVoteResponse(vote: VoteDocument): Vote {
  return {
    section: vote.section,
    itemId: vote.itemId,
    value: vote.value,
    createdAt: vote.createdAt.toISOString(),
    updatedAt: vote.updatedAt.toISOString(),
  };
}

/**
 * Built entirely from the preference document and the resolved item, never
 * from the request body: this is the training payload, and a client-supplied
 * itemMeta would let anyone inject fabricated training rows.
 */
function buildVoteContext(
  preference: PreferenceDocument,
  resolvedItem: VotedItemMeta,
): VoteContext {
  const { servedAt, ...itemMeta } = resolvedItem;
  return {
    preferenceVersion: preference.version,
    assets: preference.assets,
    investorType: preference.investorType,
    contentTypes: preference.contentTypes,
    riskTolerance: preference.riskTolerance,
    servedAt,
    itemMeta,
  };
}

async function clearVote(
  userId: string,
  section: ContentType,
  itemId: string,
): Promise<VoteResponse> {
  // No item resolution here: clearing must keep working after an item ages
  // out of cache.
  await VoteModel.deleteOne({ userId, section, itemId });
  return { vote: null };
}

export async function castVote(userId: string, input: VoteRequest): Promise<VoteResponse> {
  const preference = await PreferenceModel.findOne({ userId });
  if (!preference) {
    throw new HttpError(403, 'Onboarding required');
  }

  if (input.value === 0) {
    return clearVote(userId, input.section, input.itemId);
  }

  // Checked after the clear branch, for the same reason clearing skips item
  // resolution: removing a vote writes no context, so it must keep working for
  // a user whose preferences moved on since the item was served.
  if (input.preferenceVersion !== preference.version) {
    throw new HttpError(409, 'Preferences changed');
  }

  const resolvedItem = await resolveVotedItem(userId, input.section, input.itemId, preference);
  if (!resolvedItem) {
    throw new HttpError(404, 'Item not found');
  }

  const context = buildVoteContext(preference, resolvedItem);
  const vote = await VoteModel.findOneAndUpdate(
    { userId, section: input.section, itemId: input.itemId },
    { $set: { value: input.value, context } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  // upsert + new guarantee a document; mongoose's types can't express that.
  return { vote: toVoteResponse(vote!) };
}

/**
 * Deliberately unpaginated: a user can only accumulate votes for items they were
 * actually served, which bounds this at a few hundred rows in the worst case.
 */
export async function listVotes(userId: string): Promise<VotesListResponse> {
  const votes = await VoteModel.find({ userId });
  return { votes: votes.map(toVoteResponse) };
}

interface VoteTallyRow {
  _id: ContentType;
  up: number;
  down: number;
}

export async function getVoteSummary(userId: string): Promise<VoteSummaryResponse> {
  const rows = await VoteModel.aggregate<VoteTallyRow>([
    // Aggregation bypasses Mongoose's schema casting, so the id is converted by hand.
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$section',
        up: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } },
        down: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } },
      },
    },
    // $group emits groups in no defined order; without this the same data
    // renders in a different order on every refresh.
    { $sort: { _id: 1 } },
  ]);

  const bySection = rows.map((row) => ({ section: row._id, up: row.up, down: row.down }));
  const totals = bySection.reduce(
    (acc, row) => ({ up: acc.up + row.up, down: acc.down + row.down }),
    { up: 0, down: 0 },
  );

  return { summary: { totals, bySection } };
}
