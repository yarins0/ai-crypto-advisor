# AI Crypto Advisor

A personalised crypto dashboard. A user signs up, answers a short onboarding quiz, and gets
a dashboard composed from their preferences: news, prices, an AI insight, and a meme. Every
section can be voted on, and the votes are stored with enough context to train a ranker.

- Plan and architecture: [`docs/PLAN.md`](docs/PLAN.md)
- AI interaction log: [`docs/AI_INTERACTION_LOG.md`](docs/AI_INTERACTION_LOG.md)

## Stack

React 19 + Vite + TypeScript + Tailwind (web) · Node 20 + Express 5 + TypeScript + Zod (api)
· MongoDB Atlas · npm workspaces.

## Local setup

1. Install dependencies from the repository root:
   ```bash
   npm install
   ```
2. Create the environment files:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
3. Fill in `apps/api/.env`. Each variable has a comment with the link to get its value.
4. Start both apps:
   ```bash
   npm run dev
   ```
5. Check the API answers:
   ```bash
   curl http://localhost:4000/api/health
   ```

The web app runs on <http://localhost:5173>. The API runs on <http://localhost:4000>.

## Scripts

| Command             | Effect                                 |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Start the api and the web app together |
| `npm run build`     | Build every workspace                  |
| `npm run lint`      | ESLint over the repository             |
| `npm run typecheck` | TypeScript over every workspace        |
| `npm test`          | Vitest over every workspace            |

## Reviewer access

Demo account credentials and read-only database access are in the submission email. They are
never committed to this repository.
