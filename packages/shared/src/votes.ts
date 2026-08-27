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
export type VoteSummaryResponse = z.infer<typeof voteSummaryResponseSchema>;
