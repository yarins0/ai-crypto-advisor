import { z } from 'zod';

import { contentTypes } from './preferences.js';

/** Bounded because it is stored and later read back as an index key, not free text. */
const itemIdSchema = z.string().min(1).max(300);

/**
 * `0` clears an existing vote. It is a request value only — a stored vote is
 * always 1 or -1, so "cleared" cannot be represented as a row.
 */
export const voteRequestSchema = z.object({
  section: z.enum(contentTypes),
  itemId: itemIdSchema,
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
  /**
   * Echoed from the dashboard response, compared against the stored version and
   * then discarded — never written into the vote's context. A client can
   * therefore cause its own vote to be rejected, but never forge a training row.
   */
  preferenceVersion: z.number().int().nonnegative(),
});

export const voteSchema = z.object({
  section: z.enum(contentTypes),
  itemId: itemIdSchema,
  value: z.union([z.literal(1), z.literal(-1)]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Null after a clear, so one response shape covers both outcomes of a POST. */
export const voteResponseSchema = z.object({ vote: voteSchema.nullable() });

// The dashboard response carries content, not vote state, so this is what lets a
// reloaded client render which items the user has already voted on.
export const votesListResponseSchema = z.object({ votes: z.array(voteSchema) });

const voteTallySchema = z.object({
  up: z.number().int().nonnegative(),
  down: z.number().int().nonnegative(),
});

export const voteSummaryResponseSchema = z.object({
  summary: z.object({
    totals: voteTallySchema,
    bySection: z.array(voteTallySchema.extend({ section: z.enum(contentTypes) })),
  }),
});

export type VoteRequest = z.infer<typeof voteRequestSchema>;
export type Vote = z.infer<typeof voteSchema>;
export type VoteResponse = z.infer<typeof voteResponseSchema>;
export type VotesListResponse = z.infer<typeof votesListResponseSchema>;
export type VoteSummaryResponse = z.infer<typeof voteSummaryResponseSchema>;
