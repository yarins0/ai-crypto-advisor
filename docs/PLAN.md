# AI Crypto Advisor — Implementation Plan

Status: **draft, awaiting ratification.** No application code written yet.
Last updated: 2026-08-26

---

## 1. What we're building

A personalised crypto dashboard. A user signs up, answers a short onboarding quiz, and
lands on a dashboard whose four sections are composed from their stated preferences. Every
section can be voted on, and those votes are persisted with enough surrounding context to
be useful as training data later. A meme re-rolls on each dashboard refresh.

The feature list is deliberately small. The brief says it is graded on *"clean UX, readable
code, and good structure"* — so the interesting engineering is in the parts the feature list
doesn't mention: what the dashboard does when CoinGecko rate-limits, what the AI section
shows when Hugging Face cold-starts, and whether a reviewer can understand the codebase in
ten minutes.

## 2. Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 19 + Vite + TypeScript | Brief requires React or Angular. Vite keeps the build trivial and the SPA deploys as static files. |
| Styling | Tailwind CSS | Fast to build a dense dark UI; design tokens live in one config. |
| Data fetching | TanStack Query | Caching, retries and optimistic vote updates for free. |
| Charts | Recharts | Sparklines on coin cards. Small, declarative, no D3 hand-rolling. |
| Backend | Node 20 + Express 5 + TypeScript | One language across the stack; minimal footprint on a free host. |
| Validation | Zod | One schema per DTO, shared with the client via `packages/shared`. |
| DB | MongoDB Atlas + Mongoose | Chosen by the developer. Free tier persists across redeploys, and the Atlas UI is easy to share with reviewers (a listed deliverable). |
| Auth | JWT access token + rotating refresh token in an httpOnly cookie | Brief allows JWT or session. Short-lived access token in memory, refresh in a cookie — avoids putting a long-lived token in `localStorage`. |
| LLM | Hugging Face Inference API | Chosen by the developer. Free tier, no card required. |
| Tests | Vitest + Supertest (api), Vitest + Testing Library (web) | Same runner both sides. |
| CI | GitHub Actions | Lint, typecheck, test on every push. |
| Hosting | Vercel (web) · Render (api) · Atlas (db) | All free tiers. |

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
│           ├── integrations/# coingecko · cryptopanic · huggingface · memes
│           ├── lib/         # cache, http client, logger, errors
│           └── middleware/  # auth guard, validation, error handler
├── packages/shared/         # Zod schemas + inferred TS types, used by both apps
├── docs/                    # this plan, architecture, AI logs, training write-up
└── .github/workflows/ci.yml
```

**Trade-off, flagged for ratification:** workspaces mean Vercel and Render both need a root
install with a scoped build (`npm ci` at root, `npm run build -w apps/web`). That's a few
lines of deploy config in exchange for a single source of truth for API contracts. If deploy
friction bites, the fallback is to inline the shared types into each app.

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

Vote            { userId, section, itemId, itemType, value: 1 | -1,
                  context: {                   // frozen snapshot — this is the training payload
                    preferenceVersion, assets, investorType, contentTypes,
                    servedAt, itemMeta: { title?, coinId?, source?, model? }
                  },
                  timestamps }
                  // unique index (userId, section, itemId) → re-vote updates, never duplicates

ContentCache    { key (unique), payload, source, fetchedAt, expiresAt }
                  // TTL index on expiresAt; shared across all users, so one CoinGecko call
                  // serves every concurrent visitor

RefreshToken    { userId, tokenHash, expiresAt, revokedAt }
```

`Preference` is a separate collection rather than an embedded subdocument specifically so
`version` can be bumped independently — a vote needs to know *which* preference set was in
force when the item was served, or the training data is worthless.

## 5. API surface

```
POST   /api/auth/register        → { user, accessToken } + refresh cookie
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/onboarding/questions → server-driven quiz definition (client renders, doesn't hardcode)
GET    /api/preferences
PUT    /api/preferences          → onboarding submit and later edits share one endpoint

GET    /api/dashboard            → { sections: { news, coins, insight, meme }, generatedAt }
GET    /api/dashboard/meme       → re-roll the meme only

POST   /api/votes                → { section, itemId, value }  (upsert; value 0 clears)
GET    /api/votes/summary        → aggregate counts, powers the analytics view

GET    /api/health
```

`GET /api/dashboard` composes all four sections server-side in parallel. One round trip, and
the client never learns which third-party APIs exist.

## 6. Resilience — the part that actually matters

Every free API in this brief will fail during a review. CoinGecko rate-limits, CryptoPanic's
free tier is restrictive, Hugging Face cold-starts, and Reddit blocks datacenter IPs
outright. So each integration goes through one helper with a three-tier degradation path:

```
live fetch  →  stale cache (serve expired data rather than nothing)  →  committed static fallback
```

Every section in the dashboard response carries `source: 'live' | 'cache' | 'fallback'` and
`fetchedAt`, and the UI renders a small, honest badge when data isn't live. Showing a user
five-minute-old prices with a quiet "updated 5m ago" is good UX; showing them a spinner
forever is not.

| Integration | Endpoint | TTL | Fallback |
| --- | --- | --- | --- |
| Coin prices | CoinGecko `/coins/markets` with `sparkline=true` | 60s | Stale cache, then static snapshot. One call returns price *and* 7-day sparkline. |
| News | CryptoPanic `/v1/posts` filtered to the user's assets | 10 min | Stale cache, then a committed `news.fallback.json`. |
| AI insight | HF router, OpenAI-compatible chat completions | 24h per user | Deterministic templated insight built from *real* market data — degraded, but never fabricated. |
| Meme | Static curated JSON (primary) + opportunistic Reddit `.json` | — | Static JSON is the primary source precisely because Reddit will block Render's IPs. |

The AI insight is cached per user per calendar day, which is both a rate-limit defence and
literally what "Insight of the **Day**" means.

## 7. Delivery milestones

| # | Milestone | Contents |
| --- | --- | --- |
| M0 | Scaffold | Workspaces, TS configs, ESLint/Prettier, CI skeleton, `.env.example` |
| M1 | Auth | Mongo connection, User model, register/login/refresh/logout, guard middleware, tests |
| M2 | Preferences | Question definitions, preferences CRUD, onboarding gate |
| M3 | Integrations | Cache helper, four integration clients, static fallbacks, tests with mocked HTTP |
| M4 | Dashboard + votes | Parallel composition endpoint, vote upsert, summary aggregation |
| M5 | Web core | Auth screens, onboarding wizard, dashboard shell, voting with optimistic updates |
| M6 | Polish | Dark terminal theme, sparklines, skeletons, empty/error/stale states, responsive pass |
| M7 | Deploy | Atlas cluster, Render service, Vercel project, seed demo account, smoke test |
| M8 | Docs | README with setup + reviewer credentials, ARCHITECTURE, training-loop write-up, interaction summary |

M1–M4 are backend and independently testable; M5–M6 are frontend. M7 happens early enough
to catch deploy problems while there's still time to fix them — the deploy is a deliverable,
not an afterthought.

## 8. Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Render free tier sleeps after 15 min idle → ~50s cold start when a reviewer opens the link | High | Keep-warm ping from a GitHub Actions schedule; honest loading state; documented in the README |
| CoinGecko rate-limits (free tier is tight) | High | Server-side shared cache — one upstream call serves all users, not one per user |
| CryptoPanic free token restrictions / API changes | Medium | Committed static fallback; news is never the reason the page fails |
| HF free inference cold-start or model deprecation | High | Model id is env-configurable; deterministic fallback insight from real market data |
| Reddit blocks cloud IPs | High | Static meme JSON is the primary source, not the fallback |
| Atlas requires an IP allowlist Render can't predict | Medium | Allow `0.0.0.0/0` with a strong generated password (standard for PaaS-hosted apps) |
| "Go big" scope creep eats the deadline | Medium | Milestones are ordered so M0–M5 alone is a complete, submittable app; M6 polish is additive |

## 9. Resolved decisions

Answered by the developer on 2026-08-26:

| Question | Answer | What it means for the build |
| --- | --- | --- |
| CryptoPanic token | Developer will obtain one | News runs live. The static fallback still ships, but as a degradation path rather than the primary source. |
| Reviewer DB access | Read-only Atlas user, credentials sent **in the submission email** | Nothing sensitive enters the public repo. |
| Demo account | Credentials sent **in the submission email** | `demo@aicryptoadvisor.app` (or similar), pre-seeded with completed onboarding, realistic preferences and a spread of votes, so a reviewer sees a populated dashboard on first load. |
| Domain | Default `*.vercel.app` is fine | No DNS work. Backend stays on `*.onrender.com`; CORS allowlist is env-driven. |

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

## 10. Bonus deliverable — the training-loop write-up

The brief asks for a *design*, not an implementation. `docs/TRAINING_LOOP.md` will cover:
what the `Vote.context` snapshot captures and why; turning vote events into
`(user_features, item_features, label)` training rows; a cold-start path from onboarding
answers to a content-based ranker; bandit-style exploration so the model doesn't only ever
learn from what it already chose to show; offline evaluation (NDCG, AUC on held-out days)
and online A/B; and the failure modes that make this kind of loop go wrong — position bias
corrected with inverse propensity weighting, and the fact that you only ever observe labels
for items you served.
