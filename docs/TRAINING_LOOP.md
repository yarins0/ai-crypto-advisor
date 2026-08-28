# Training Loop — design

The brief asks for a design, not an implementation. Nothing described here is built: the app
collects the data and stops. This document says what is being collected and why, what a training
row would look like, what the current schema **cannot** answer, and the smallest change that
would fix that.

The honest summary up front: the vote data is good enough to train a first ranker and not good
enough to evaluate one without bias. The gap is a single missing collection, specified in
[The impression gap](#the-impression-gap).

- [What is collected today](#what-is-collected-today)
- [From a vote to a training row](#from-a-vote-to-a-training-row)
- [The impression gap](#the-impression-gap)
- [Cold start](#cold-start)
- [The ranker, in two stages](#the-ranker-in-two-stages)
- [Exploration](#exploration)
- [Offline evaluation](#offline-evaluation)
- [Online evaluation](#online-evaluation)
- [Failure modes](#failure-modes)
- [What would be built first](#what-would-be-built-first)

## What is collected today

A vote is not a counter. Each row freezes the state that produced the item, because a label is
worthless without the conditions it was given under.

```
Vote {
  userId, section, itemId, value: 1 | -1, createdAt, updatedAt,
  context: {
    preferenceVersion, assets[], investorType, contentTypes[],
    servedAt,
    itemMeta: { title?, coinId?, source?, model? }
  }
}
```

Three properties of this snapshot are deliberate and worth stating, because they are what make
the rows trustworthy rather than merely present:

- **`context` is built server-side and has no path from the request.** `buildVoteContext` takes
  only the preference document and the resolved item. A client-supplied `itemMeta` would let
  anyone inject fabricated training rows, which is a worse outcome than collecting none.
- **The item must be one the caller's own preferences could have served.** A label recorded
  against content the user never saw is actively harmful, not merely useless.
- **`preferenceVersion` is the version the item was _served_ under**, not the version current
  when the vote arrived. The dashboard echoes the version it composed with and a mismatch is
  rejected with 409, so a user who edits preferences mid-session cannot silently attach a label
  to the wrong feature vector.

`itemMeta.source` deserves particular attention. It records which degradation tier answered —
`live`, `cache` or `fallback` — and it is the field that keeps the dataset honest. During an
upstream outage every user sees the same handful of committed fallback articles; without this
field those items accumulate votes across the whole userbase and appear genuinely popular.
`itemMeta.model` does the same job for the insight: it attributes the label to the model that
generated the text, so a vote cast against a since-deprecated `HF_MODEL` can be excluded rather
than blamed on its replacement.

### What the snapshot does not capture

Four omissions, each of which constrains what can be learned:

| Missing                         | Consequence                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `riskTolerance`                 | It is on the preference document and shapes the insight prompt, but is not copied into `context` — a feature that influenced the item is absent from the item's label. |
| Position                        | News is sorted newest-first and capped at 12; the rank the user actually saw is not recorded, so position bias cannot be corrected.                                    |
| The previous value of a re-vote | `updatedAt` proves a vote changed but not what it changed from. Clearing deletes the row outright, so "user withdrew approval" is unrecoverable.                       |
| Everything not voted on         | See below — this is the significant one.                                                                                                                               |

`riskTolerance` is a one-line addition to `VoteContext` and should be made before any data worth
training on accumulates; it is cheap now and unrecoverable later, since old rows cannot be
backfilled with a value that was never stored.

Also worth flagging so it is not misread: **`servedAt` is the content's `fetchedAt`, not the
moment the user saw it.** It comes from the cache envelope and is shared across every user served
that same row. It measures how stale the content was, which is genuinely useful — but the time
the item was impressed is `createdAt` at best, and strictly is not recorded at all.

## From a vote to a training row

The target is a standard learning-to-rank triple, `(user_features, item_features, label)`, one
row per interaction.

**User features** come entirely from `context`, never from the user's _current_ preferences —
that distinction is the point of freezing the snapshot:

| Feature         | Encoding                     | Source                 |
| --------------- | ---------------------------- | ---------------------- |
| `investorType`  | one-hot, 4                   | `context.investorType` |
| `riskTolerance` | one-hot, 3                   | _not yet stored_       |
| `contentTypes`  | multi-hot, 4                 | `context.contentTypes` |
| `assets`        | multi-hot, 15 curated ids    | `context.assets`       |
| tenure          | days between signup and vote | `User.createdAt`       |

**Item features** vary by section, which is itself informative — `itemId` is not a uniform
entity across sections, and a single model over all four would be learning four unrelated tasks:

| Section   | `itemId` is    | Features available                                                            |
| --------- | -------------- | ----------------------------------------------------------------------------- |
| `prices`  | a CoinGecko id | the coin, its membership in the user's asset set, tier                        |
| `news`    | an article id  | title text, the asset whose feed it came from, article age at serve, tier     |
| `insight` | a UTC day      | generating model, the market state it was built from, tier                    |
| `memes`   | a meme id      | the meme itself — a fixed curated set, so this is pure item-identity learning |

**Label** is `value`, already ±1. No implicit-feedback inference is needed, which is a genuine
advantage of an explicit vote button over click logs: the signal is unambiguous and the user
knew they were giving it.

The practical consequence of the table above is **four small models, not one**. `memes` over a
fixed curated set is a bandit problem with ~N arms and needs no features at all. `news` is the
only section with real content to embed. `prices` is nearly determined by the user's own asset
selection. Training one model across sections would drown the sections with signal in the ones
without.

## The impression gap

Only items that were **voted on** produce rows. Nothing records what was served and ignored.

This is not a small omission, and it is worth being precise about what it forecloses:

- **There are no negatives, only downvotes.** An unvoted item is indistinguishable between "saw
  it, did not care" and "never appeared". Treating unvoted items as negative is the standard
  shortcut and it is wrong here for a specific reason: the dashboard shows at most 12 news items
  from a 15-asset universe, so most items were never eligible to be seen at all.
- **Propensities are not estimable.** Inverse propensity weighting needs `P(item shown | user)`,
  which needs a record of what the serving policy did. The plan's own §10 names IPW as the
  correction for position bias; it cannot be computed from what is stored today.
- **Engagement rate is unmeasurable.** Votes per user is a count, not a rate, because the
  denominator does not exist.

### The minimum fix

One collection, written on every dashboard composition:

```
Impression {
  userId, section, itemId,
  position,            // rank within the section as served
  servedAt,            // when composed, not when the content was fetched
  source,              // which degradation tier answered
  preferenceVersion,
  policy               // 'recency-v1' — which serving policy produced this
}
```

Cost, stated plainly: up to 29 rows per dashboard load per user — 12 news items, up to 15
coins, one insight, one meme — which is a real write amplification on a free-tier cluster and
needs a TTL index — 90 days is enough for any training
window that matters here. It also means the dashboard response now writes on a read path, which
is why it should be fire-and-forget: a failed impression write must never fail a dashboard that
composed successfully, exactly as a failed cache write does not today.

The `policy` field is what makes the log durable. The current serving policy is deterministic
recency, so today's propensities are known analytically; the moment a learned ranker ships, they
are not, and a log that cannot say which policy produced a row is retrospectively worthless.

With this collection, a training row becomes a **join** — impressions left-joined to votes,
label 0 where no vote exists — and every technique below becomes computable. Without it, the
loop can be trained but not honestly evaluated.

## Cold start

Cold start is the common case here, not an edge case: reviewers register fresh accounts, and the
seeded demo account was deliberately dropped. A user's first dashboard must be good with zero
votes.

The onboarding quiz exists precisely to make that possible. It yields a complete user feature
vector before any interaction: assets, investor type, content types, risk tolerance. So the
ranker has a cold-start path that needs no model at all:

```mermaid
flowchart LR
    Q["onboarding answers"] --> P["content-based prior"]
    P --> S["served dashboard"]
    S --> V["votes"]
    V --> M["learned ranker"]
    M -->|"blend weight rises with vote count"| S
```

The blend is the design decision worth defending. A hard switch at some vote threshold makes the
dashboard visibly lurch the moment it triggers; weighting the learned score by
`n / (n + k)` — with `n` the user's vote count and `k` a constant around 20 — moves a user from
prior to personalised continuously, and degrades back gracefully if they later clear their votes.

The population prior handles the third case: a user with no votes _and_ an unusual asset set
falls back to what similar `investorType` cohorts liked, not to a global average.

## The ranker, in two stages

**v0 — no learning.** Score each candidate by feature overlap with the stated preferences: asset
match, section membership, recency for news. This is roughly what the app already does, written
down as a scoring function instead of a sort order. It is the baseline every later model must
beat, and having it explicit is what makes "did the model help?" answerable.

**v1 — gradient-boosted trees on the joined data.** Not a neural model, for reasons specific to
this dataset rather than fashion: the feature set is small, categorical and tabular; the data
volume is at most thousands of rows; and GBDTs handle the multi-hot asset encoding and missing
`riskTolerance` without imputation. LightGBM with a ranking objective (`lambdarank`) fits the
per-section grouping directly.

Text is where a learned representation earns its place, and only for news: embed the article
title, reduce to a handful of dimensions, and feed those as features. The alternative — treating
each article id as a category — cannot generalise at all, since news items are unique and never
recur.

Retraining is a nightly batch job. Online learning is the wrong shape for this: vote volume is
low, the serving policy changes rarely, and a nightly artefact is inspectable before it ships in
a way a continuously-updated model is not.

## Exploration

A ranker that only shows what it already predicts will only ever learn about what it shows. This
is the feedback loop that makes recommender systems quietly degrade, and it needs a deliberate
counterweight.

The current situation is unusually favourable and should be exploited before it is lost: **the
serving policy today is fixed and non-personalised**, so the logs being collected right now are
free of confounding from a previous ranker. That property disappears permanently the day v1
ships. Data collected under a known policy is the cleanest data this system will ever have.

Once v1 ships, ε-greedy is sufficient and should be preferred over anything more sophisticated:
reserve one slot in each section for a candidate the model did not rank first, chosen uniformly
from the eligible set, and record it in the impression log with its policy tag. Thompson sampling
is the better answer for `memes` specifically, since a fixed curated set with a binary reward per
arm is exactly the Beta-Bernoulli bandit setting, and there are no features to learn anyway.

## Offline evaluation

The evaluation split must be **temporal, not random**. A random split leaks: news items are
shared across users on the same day, so the same article appears in train and test, and the model
scores well by memorising items rather than learning preferences. Hold out the most recent N
days.

| Metric              | Answers                                                         |
| ------------------- | --------------------------------------------------------------- |
| AUC                 | can the model separate upvotes from downvotes at all            |
| NDCG@k, per section | does the ordering put liked items near the top                  |
| Coverage            | how much of the catalogue is ever recommended                   |
| Per-cohort AUC      | does it work for low-vote users, not just the enthusiastic ones |

Coverage and per-cohort AUC are there to catch the two failures that a headline metric hides. A
model that recommends the same three memes to everyone can score well on NDCG while being a worse
product. And an aggregate metric is dominated by heavy voters, who are precisely the users the
cold-start path does not need to serve.

Every offline number is measured against the v0 baseline, not against zero.

## Online evaluation

Offline metrics measure agreement with past behaviour, which is not the same as being better.
The online test is an A/B split at the user level — not the session level, since a user who sees
a different ranking on each visit experiences inconsistency rather than a treatment.

Primary metric: vote rate per dashboard load, which requires the impression log's denominator.
Guardrails: downvote rate, and section-level dwell if it is ever instrumented. A ranker that
raises upvotes _and_ downvotes together is polarising rather than improving, and only the pair
reveals that.

Run for at least one full week. Crypto news has a strong weekday cycle, and a Tuesday-to-Thursday
test measures the cycle.

## Failure modes

The ones that actually break this loop, in rough order of likelihood:

- **The feedback loop.** The model shows what it predicts, learns from what it showed, and
  narrows. Exploration is the mitigation; coverage is the metric that detects it.
- **Fallback contamination.** During an upstream outage every user sees the same committed
  fallback items. Left unfiltered, those items look universally popular. `itemMeta.source` is
  already recorded for exactly this — **exclude `fallback` rows from training**, or at minimum
  carry the tier as a feature so the model can learn the difference.
- **Position bias.** Users vote on what is near the top. Without logged position this is not
  merely uncorrected but undetectable, which is worse — the model appears to be learning
  preference while partly learning rank.
- **Preference drift.** A user's stored preference is versioned and mutable; their taste moves.
  `preferenceVersion` lets a training set be scoped to a stable window rather than silently
  mixing regimes.
- **Sparsity.** With one vote per user-item and a small user base, most cells are empty. This is
  the argument for content features over collaborative filtering: a matrix-factorisation
  approach needs overlap this dataset will not have.
- **The unobserved-label problem.** Labels exist only for served items, so the model is always
  evaluated on the distribution it created. This does not have a clean fix; it has a discipline —
  exploration, propensity logging, and treating offline numbers as directional rather than
  decisive.

## What would be built first

In order, smallest first, each one useful on its own:

1. **Add `riskTolerance` to `VoteContext`.** One line. Unrecoverable if deferred, since existing
   rows cannot be backfilled.
2. **Add the `Impression` collection** with a TTL index and a fire-and-forget write. Nothing
   downstream is honestly measurable without it.
3. **Write v0 as an explicit scoring function.** Makes the current behaviour a baseline instead
   of an implicit sort.
4. **Collect for a few weeks under the fixed policy.** This data is clean in a way no later data
   will be.
5. **Then train v1**, offline-evaluate against v0, and A/B it.

Steps 1 and 2 are hours of work and are the difference between a dataset that can answer
questions and one that merely accumulates. Everything after them is conventional.
