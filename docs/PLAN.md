# AI Crypto Advisor — Implementation Plan

Status: **ratified and in progress.** M0–M4 implemented; M5 onward outstanding.
Last updated: 2026-08-27

---

## 1. What we're building

A personalised crypto dashboard. A user signs up, answers a short onboarding quiz, and
lands on a dashboard whose four sections are composed from their stated preferences. Every
section can be voted on, and those votes are persisted with enough surrounding context to
be useful as training data later. A meme re-rolls on each dashboard refresh.

The feature list is deliberately small. The brief says it is graded on _"clean UX, readable
code, and good structure"_ — so the interesting engineering is in the parts the feature list
doesn't mention: what the dashboard does when CoinGecko rate-limits, what the AI section
shows when Hugging Face cold-starts, and whether a reviewer can understand the codebase in
ten minutes.

## 2. Stack

| Layer         | Choice                                                          | Why                                                                                                                                         |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend      | React 19 + Vite + TypeScript                                    | Brief requires React or Angular. Vite keeps the build trivial and the SPA deploys as static files.                                          |
| Styling       | Tailwind CSS                                                    | Fast to build a dense dark UI; design tokens live in one config.                                                                            |
| Data fetching | TanStack Query                                                  | Caching, retries and optimistic vote updates for free.                                                                                      |
| Charts        | Recharts                                                        | Sparklines on coin cards. Small, declarative, no D3 hand-rolling.                                                                           |
| Backend       | Node 20 + Express 5 + TypeScript                                | One language across the stack; minimal footprint on a free host.                                                                            |
| Validation    | Zod                                                             | One schema per DTO, shared with the client via `packages/shared`.                                                                           |
| DB            | MongoDB Atlas + Mongoose                                        | Chosen by the developer. Free tier persists across redeploys, and the Atlas UI is easy to share with reviewers (a listed deliverable).      |
| Auth          | JWT access token + rotating refresh token in an httpOnly cookie | Brief allows JWT or session. Short-lived access token in memory, refresh in a cookie — avoids putting a long-lived token in `localStorage`. |
| LLM           | Hugging Face Inference API                                      | Chosen by the developer. Free tier, no card required.                                                                                       |
| Tests         | Vitest + Supertest (api), Vitest + Testing Library (web)        | Same runner both sides.                                                                                                                     |
| CI            | GitHub Actions                                                  | Lint, typecheck, test on every push.                                                                                                        |
| Hosting       | Vercel (web) · Render (api) · Atlas (db)                        | All free tiers.                                                                                                                             |

## 3. Repository layout

npm workspaces monorepo, so the client and server share DTO types and can't drift:

```
.
├── apps/
│   ├── web/                 # React + Vite SPA          → Vercel
│   │   └── src/
│   │       ├── app/         # router, providers, layout
│   │       ├── features/    # auth · onboarding · dashboard · votes
│   │       ├── components/  # ui primitives (Card, Skeleton, Toast, VoteButtons)
│   │       └── lib/         # api client, query client, formatters
│   └── api/                 # Express + TypeScript      → Render
│       └── src/
│           ├── modules/     # auth · preferences · dashboard · votes
│           │   └── <mod>/   # route.ts · service.ts · model.ts · schema.ts
│           ├── integrations/# coingecko · cointelegraph · huggingface · memes
│           ├── lib/         # cache, http client, logger, errors
│           └── middleware/  # auth guard, validation, error handler
├── packages/shared/         # Zod schemas + inferred TS types, used by both apps
├── docs/                    # this plan, architecture, AI logs, training write-up
└── .github/workflows/ci.yml
```

**Trade-off, ratified in M1:** the workspace is kept, and `packages/shared` gains a real
build step.

The friction this paragraph predicted arrived immediately. With `exports` pointing at
`./src/index.ts`, `npm run build` succeeded but the emitted `dist/**/*.js` still imported
`@aca/shared` — a TypeScript file Node cannot load — so `npm start` would have failed on
Render after a green build. Rather than inline the types and accept two copies of the API
contract that will drift, `packages/shared` now compiles to `dist/` (JS plus `.d.ts`) and
its `exports` point there.

Two details make the ordering safe:

- The root `workspaces` array lists `packages/*` before `apps/*`, so `npm run build` at the
  root builds the shared package before anything consumes it.
- `packages/shared` has a `prepare` script, which npm runs automatically after any install.
  A fresh clone therefore has `dist/` before the first `typecheck`, and CI needs no extra step.

Deploy still needs a root install with a scoped build (`npm ci` at root, then
`npm run build -w apps/web`), which is a few lines of config in exchange for a single
source of truth for API contracts.

## 4. Data model

```ts
User            { _id, email (unique, lowercased), name, passwordHash,
                  onboardedAt: Date | null, isDemo: boolean, timestamps }

Preference      { userId (unique ref),
                  assets: string[],            // CoinGecko ids: ['bitcoin','ethereum']
                  investorType: 'hodler'|'day_trader'|'nft_collector'|'yield_farmer',
                  contentTypes: ('news'|'prices'|'insight'|'memes')[],
                  riskTolerance: 'low'|'medium'|'high',
                  version: number,             // bumped on edit; votes reference it
                  timestamps }

Vote            { userId, section, itemId, value: 1 | -1,
                  context: {                   // frozen snapshot — this is the training payload
                    preferenceVersion, assets, investorType, contentTypes,
                    servedAt, itemMeta: { title?, coinId?, source?, model? }
                  },
                  timestamps }
                  // unique index (userId, section, itemId) → re-vote updates, never duplicates
                  // `context` is rebuilt server-side from the cache row that served the item,
                  // never accepted from the request: it is training data, so a client-supplied
                  // itemMeta would let anyone inject fabricated rows.

ContentCache    { key (unique), payload, fetchedAt }
                  // TTL index on fetchedAt purges after 7 days, far past any logical TTL:
                  // the stale tier serves already-expired rows, so freshness is computed
                  // in code, never stored. Shared across users — one call serves everyone.

RefreshToken    { userId, tokenHash, expiresAt, revokedAt }
```

`Preference` is a separate collection rather than an embedded subdocument specifically so
`version` can be bumped independently — a vote needs to know _which_ preference set was in
force when the item was served, or the training data is worthless.

`Vote` carries no `itemType`. An earlier draft had one alongside `section`, but `section`
determines it one-to-one, and two fields encoding one fact are two fields that can disagree.

A vote resolves only for an item the caller's own preferences could have served — the section
must be in `contentTypes` and a coin must be in `assets`. Without that check a client can
create rows for content it was never shown, and a training example labelled against content
the user never saw is worse than no example at all.

One limitation this leaves, stated because `context` is a training artefact and its
provenance has to be exact: `preferenceVersion` is read when the vote is cast, not when the
item was served. A user who edits preferences between seeing an item and voting on it
records the newer version. The scoping check above narrows the window — an edit that changes
the section or the asset makes the vote 404 outright — but an edit to `riskTolerance` alone
does not. Closing it fully would mean persisting the version alongside every served item,
which is more machinery than the residual skew justifies.

Closed in **M5**, and not by that route: the dashboard response carries the
`preferenceVersion` it served and the vote request echoes it back, so `castVote` compares the
two and rejects a mismatch with 409 rather than recording a skewed version. That costs one
number on two payloads that already exist, instead of a stored version per served item.

The echoed value is compared and then discarded. `buildVoteContext` still takes only the
preference document and the resolved item, so it has no parameter through which the request
could reach it — a client can cause its own vote to be rejected, never forge the context that
gets recorded. Clearing a vote (`value: 0`) skips the check deliberately, since it writes no
context and has to keep working after a preference edit. The cost is that a vote on an item
served under older preferences fails, and the client refetches the dashboard and retries.

`Preference.assets` is validated against the curated id list rather than accepted as free
strings. An unrecognised id is otherwise accepted with a 200 and only surfaces later as a
coin with no prices and no news feed — a failure two layers from where it entered.

## 5. API surface

```
POST   /api/auth/register        → 201 { user, accessToken } + refresh cookie
POST   /api/auth/login           → 200 { user, accessToken } + refresh cookie
POST   /api/auth/refresh         → 200 { user, accessToken } + rotated refresh cookie
POST   /api/auth/logout          → 204, clears the refresh cookie
GET    /api/auth/me              → 200 PublicUser

GET    /api/onboarding/questions → server-driven quiz definition (client renders, doesn't hardcode)
GET    /api/preferences
PUT    /api/preferences          → onboarding submit and later edits share one endpoint

GET    /api/dashboard            → { sections: { news, prices, insight, memes }, preferenceVersion, generatedAt }
GET    /api/dashboard/meme       → re-roll the meme only (?exclude=<id> avoids a repeat)

POST   /api/votes                → { section, itemId, value, preferenceVersion }  (upsert; value 0 clears)
GET    /api/votes                → the caller's own votes, so a reload can render what they already voted on
GET    /api/votes/summary        → aggregate counts, powers the analytics view

GET    /api/health
```

`GET /api/dashboard` composes all four sections server-side in parallel. One round trip, and
the client never learns which third-party APIs exist.

The section names are the `Preference.contentTypes` values, not a parallel vocabulary. One
list means a preference, a response key and a vote's `section` cannot disagree about what a
section is called, and gating a section is then a membership test rather than a lookup table.

All four section keys are always present, and a section the user did not select is `null`
rather than omitted. Optional keys would make a section accidentally dropped by a bug
indistinguishable on the wire from one deliberately deselected — and since the client parses
this response against the shared schema, mandatory keys are what keeps that schema able to
prove the response is complete.

Every error response uses one shape: `{ error: string, fields?: Record<string, string> }`.
A Zod validation failure fills `fields`; nothing else does.

The refresh token is delivered **only** as an httpOnly cookie (`refresh_token`, `Path=/api/auth`),
never in a response body. The access token is the opposite: body only, never a cookie.

## 6. Resilience — the part that actually matters

Every free API in this brief will fail during a review. CoinGecko rate-limits, the
Cointelegraph RSS feed can go down or change shape, Hugging Face cold-starts, and Reddit
blocks datacenter IPs outright. So each integration goes through one helper with a
three-tier degradation path:

```
live fetch  →  stale cache (serve expired data rather than nothing)  →  committed static fallback
```

Every section in the dashboard response carries `source: 'live' | 'cache' | 'fallback'` and
`fetchedAt`, and the UI renders a small, honest badge when data isn't live. Showing a user
five-minute-old prices with a quiet "updated 5m ago" is good UX; showing them a spinner
forever is not.

`source` names which tier answered, not where the bytes came from. A cache hit inside its
TTL is `live`; `cache` means specifically that the data is stale and was served anyway.
Reporting every cache hit as `cache` would leave the badge lit on almost every render,
which conveys nothing.

| Integration | Endpoint                                                                        | TTL          | Fallback                                                                                        |
| ----------- | ------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Coin prices | CoinGecko `/coins/markets` with `sparkline=true`, all curated ids under one key | 60s          | Stale cache, then `fallbacks/coins.ts`. One call returns price _and_ 7-day sparkline.           |
| News        | Cointelegraph RSS, per-coin via `/rss/tag/<slug>`                               | 10 min       | Stale cache, then `fallbacks/news.ts`.                                                          |
| AI insight  | HF router, OpenAI-compatible chat completions                                   | 24h per user | Deterministic templated insight built from _real_ market data — degraded, but never fabricated. |
| Meme        | Static curated list, no upstream                                                | —            | None needed: the curated list is the source, not a fallback.                                    |

The news slug is the CoinGecko id for 13 of the 15 curated assets. Two differ and are
overridden: `binancecoin` → `bnb`, `avalanche-2` → `avalanche`. All 15 verified live on
2026-08-26 (200, 30 items each).

Prices are fetched for every curated id under a single cache key rather than per user, so
the shared-cache mitigation in §8 holds: keying on a user's asset set would produce a
distinct upstream call per distinct preference set.

Reddit is not called at all. §8 rates "Reddit blocks cloud IPs" as High, and the curated
list is already the primary source — an opportunistic branch that never succeeds in
production is code that does not need to exist.

The AI insight is cached per user per calendar day, which is both a rate-limit defence and
literally what "Insight of the **Day**" means. Day-scoping the key also puts yesterday's row
permanently out of the stale tier's reach. That is deliberate rather than incidental:
yesterday's generated prose about yesterday's prices is a worse answer than today's
deterministic template about today's, so for this one section the second tier is skipped and
the fallback is what catches a Hugging Face failure.

A consequence worth stating, because it shapes how a vote on the insight is validated: the
templated fallback is returned without writing a cache row, so an absent row is routine.
Insight votes are therefore authenticated by user plus UTC day — which fully identify the
item — and the cache row only enriches the recorded metadata.

An empty tag feed is resolved at the composition layer, not the integration. A feed that
returns zero articles is a genuinely successful fetch, so `cointelegraph.ts` caches it as
`live` and does not lie about it; the dashboard service, merging feeds across a user's
assets, substitutes the static fallback only when the merged result is empty. The
integration reports what happened and the composition layer decides what the user sees,
which keeps canned data out of the cache.

Merged news reports the worst tier any contributing feed returned and the oldest of their
fetch times, so the staleness badge can never overstate freshness.

## 7. Delivery milestones

| #   | Milestone         | Contents                                                                                                       |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| M0  | Scaffold          | Workspaces, TS configs, ESLint/Prettier, CI skeleton, `.env.example`                                           |
| M1  | Auth              | Mongo connection, User model, register/login/refresh/logout, guard middleware, tests                           |
| M2  | Preferences       | Question definitions, preferences CRUD, onboarding gate                                                        |
| M3  | Integrations      | Cache helper, four integration clients, static fallbacks, tests with mocked HTTP                               |
| M4  | Dashboard + votes | Parallel composition endpoint, vote upsert, summary aggregation                                                |
| M5  | Web core          | Auth screens, onboarding wizard, dashboard shell, voting with optimistic updates                               |
| M6  | Polish            | Dark terminal theme, sparklines, skeletons, empty/error/stale states, responsive pass                          |
| M7  | Deploy            | Atlas cluster, Render service, Vercel project, seed demo account, smoke test, verify the read-only review user |
| M8  | Docs              | README with setup + reviewer credentials, ARCHITECTURE, training-loop write-up, interaction summary            |

M1–M4 are backend and independently testable; M5–M6 are frontend. M7 happens early enough
to catch deploy problems while there's still time to fix them — the deploy is a deliverable,
not an afterthought.

Not scheduled to any milestone, deliberately: `smoke` and `check:integrations` stay out of
CI because both need external state a CI runner doesn't have (a live server, real upstreams,
HF credentials) — both already load `apps/api/.env` via `--env-file-if-exists`, so if this
ever changes, CI would need those secrets injected. Recorded here so the omission reads as a
decision, not something dropped.

## 8. Risk register

| Risk                                                                                       | Likelihood | Mitigation                                                                                    |
| ------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------- |
| Render free tier sleeps after 15 min idle → ~50s cold start when a reviewer opens the link | High       | Keep-warm ping from a GitHub Actions schedule; honest loading state; documented in the README |
| CoinGecko rate-limits (free tier is tight)                                                 | High       | Server-side shared cache — one upstream call serves all users, not one per user               |
| Cointelegraph RSS structure changes, or a tag feed doesn't exist for a chosen coin         | Medium     | Committed static fallback; news is never the reason the page fails                            |
| HF free inference cold-start or model deprecation                                          | High       | Model id is env-configurable; deterministic fallback insight from real market data            |
| Reddit blocks cloud IPs                                                                    | High       | Static meme JSON is the primary source, not the fallback                                      |
| Atlas requires an IP allowlist Render can't predict                                        | Medium     | Allow `0.0.0.0/0` with a strong generated password (standard for PaaS-hosted apps)            |
| "Go big" scope creep eats the deadline                                                     | Medium     | Milestones are ordered so M0–M5 alone is a complete, submittable app; M6 polish is additive   |

## 9. Resolved decisions

Answered by the developer on 2026-08-26:

| Question                | Answer                                                                                                    | What it means for the build                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| News source             | Cointelegraph RSS, not CryptoPanic                                                                        | No visible CryptoPanic free tier at signup time. RSS needs no key, no signup, no rate limit — verified live 2026-08-26 (200 OK, 30 items, valid RSS 2.0, works with no User-Agent). Per-coin filtering uses `cointelegraph.com/rss/tag/<slug>`. Coverage was spot-checked across all 15 curated assets on 2026-08-26: 13 work with the CoinGecko id as the slug, and `binancecoin` and `avalanche-2` return 404 and are overridden to `bnb` and `avalanche` (see §6). |
| Reviewer DB access      | Read-only Atlas user, credentials sent **in the submission email**                                        | Nothing sensitive enters the public repo.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Demo account            | Credentials sent **in the submission email**                                                              | `demo@aicryptoadvisor.app` (or similar), pre-seeded with completed onboarding, realistic preferences and a spread of votes, so a reviewer sees a populated dashboard on first load.                                                                                                                                                                                                                                                                                   |
| Domain                  | Default `*.vercel.app` is fine                                                                            | No DNS work. Backend stays on `*.onrender.com`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Refresh-token transport | httpOnly cookie, with the API proxied under the web app's own domain                                      | See "One site, not two" below.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Refresh-token storage   | HMAC-SHA256 with a server-side pepper (`REFRESH_TOKEN_PEPPER`), replacing the unused `JWT_REFRESH_SECRET` | The refresh token is a random string, not a JWT, so a JWT secret had no consumer. The pepper means read-only database access alone cannot match a captured token to its row — which matters, because M7 hands exactly that access to a reviewer.                                                                                                                                                                                                                      |

### One site, not two: the API is proxied under the web app's domain

The refresh token lives in an httpOnly cookie, so page JavaScript cannot read it and an XSS
bug cannot steal a session. That choice forces a second one.

A cookie shared between `*.vercel.app` and `*.onrender.com` is a **third-party cookie**. It
needs `SameSite=None`, and Safari blocks that by default, as do Brave and Chrome incognito.
A reviewer would log in and appear logged out on the next page load.

So Vercel rewrites `/api/(.*)` to the Render service. The browser sees one origin. Three
things follow:

- The cookie is first-party and can use `SameSite=Lax`, which by itself blocks CSRF on the
  `POST`-only refresh and logout routes. No CSRF-token machinery is needed.
- CORS stops being load-bearing. `WEB_ORIGIN` and the `cors` middleware stay for direct
  local development against `localhost:4000`, not for production.
- The web client calls the relative path `/api/...`. `VITE_API_URL` becomes a
  local-development override only (M5).

Cost: a `vercel.json` `rewrites` block (M7) and one extra network hop.

### Credential handling

Credentials were initially going to be published in the README. That was reversed: this is
a public repository, and credentials committed to one are found by automated scrapers within
hours — MongoDB Atlas runs its own leaked-credential detection and may disable the user
mid-review. They now go in the submission email instead, which costs the reviewer nothing.

Rules that follow from this:

- **No credentials in the repo, ever** — not in the README, not in seed scripts, not in
  committed `.env` files, not in test fixtures. `.env` is gitignored; `.env.example` names
  variables and gives no values.
- The Atlas review user is still **read-only** (`read` role) and **scoped to the single
  application database** — defence in depth, not a substitute for keeping it out of git.
- The README points reviewers at the submission email for access, so the deliverable is
  still discoverable from the repo.
- Rotate both the Atlas user and the demo password once the review window closes.

### M7 verification step: confirm the review user actually works

Before sending credentials in the submission email, verify them from a clean, unauthenticated
shell — not the machine that created the user, which may have a cached connection or a
whitelisted IP:

1. Connect with the exact connection string a reviewer would use:
   `mongosh "mongodb+srv://review-readonly:<password>@<cluster>.mongodb.net/<db-name>"`.
2. Confirm read access: run a `find` on a seeded collection (e.g. `db.users.find().limit(1)`)
   and confirm it returns data.
3. Confirm write access is blocked: attempt `db.users.insertOne({})` and confirm it fails with
   an authorization error, not a network or auth error — this is what proves the role is
   `read`, not `readWrite`.
4. Confirm database scope: attempt to read a collection in a **different** database on the
   same cluster and confirm that also fails — this is what proves the user is scoped to the
   single application database, not cluster-wide.
5. Only send the credentials once all three checks (read succeeds, write fails, cross-database
   read fails) pass.

## 10. Bonus deliverable — the training-loop write-up

The brief asks for a _design_, not an implementation. `docs/TRAINING_LOOP.md` will cover:
what the `Vote.context` snapshot captures and why; turning vote events into
`(user_features, item_features, label)` training rows; a cold-start path from onboarding
answers to a content-based ranker; bandit-style exploration so the model doesn't only ever
learn from what it already chose to show; offline evaluation (NDCG, AUC on held-out days)
and online A/B; and the failure modes that make this kind of loop go wrong — position bias
corrected with inverse propensity weighting, and the fact that you only ever observe labels
for items you served.
