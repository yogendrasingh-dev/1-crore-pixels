# 1 Crore Pixels

Foundation monorepo. See `docs/*.md` for product/engineering source of truth and `CLAUDE.md` for how this repo is worked on.

## Prerequisites

- Node.js >= 22
- [Docker](https://www.docker.com/) (local Postgres + Redis)
- pnpm via [Corepack](https://nodejs.org/api/corepack.html) (bundled with Node): `corepack enable`

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env   # fill in real values for anything beyond local dev
docker compose up -d   # starts local Postgres + Redis
pnpm db:migrate         # applies packages/db/prisma migrations
pnpm dev                # starts apps/web on http://localhost:3000
```

## Repository layout

See `docs/ARCHITECTURE.md` §3. Summary:

```text
apps/
  web/                  Next.js app: public site, contribution flow, admin UI, API routes
packages/
  core/                 Framework-agnostic domain logic (state machine, pixel allocation, validation)
  db/                   Prisma schema, migrations, typed client
  payment-providers/    PaymentProvider interface + adapters (manual-upi, gateway)
  ui/                   Shared React components
  config/               Shared tsconfig / eslint / prettier config
```

## Common commands

Run from the repo root:

| Command            | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| `pnpm dev`         | Start `apps/web` in dev mode                                 |
| `pnpm build`       | Production build of `apps/web`                               |
| `pnpm typecheck`   | Typecheck every package                                      |
| `pnpm lint`        | Lint every package                                           |
| `pnpm test`        | Run every package's test suite (Vitest)                      |
| `pnpm format`      | Format the repo with Prettier                                |
| `pnpm db:generate` | Regenerate the Prisma client (runs automatically on install) |
| `pnpm db:migrate`  | Run Prisma migrations against your local database            |

## Environment variables

See `.env.example` and `docs/DEPLOYMENT.md` §3. Validated at server boot by `apps/web/src/lib/env.ts`.
