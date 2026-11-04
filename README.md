# ForgeOps

A reliability-first deployment platform: connect a GitHub repository, deploy web services, workers and
scheduled jobs, see what broke and roll back. Portfolio project; see [docs/PRODUCT.md](docs/PRODUCT.md).

**Status:** early development. Working today: React dashboard → Express API → PostgreSQL, with health checks.
Progress is tracked in [docs/CURRENT.md](docs/CURRENT.md).

## Stack

React + Vite · Node.js + Express + TypeScript · PostgreSQL + Prisma · pnpm monorepo · Docker Compose.
Every technical decision and its trade-offs: [docs/DECISIONS.md](docs/DECISIONS.md).

```
apps/
  api/        Express API (port 4000)
  frontend/   React dashboard (port 5173)
docs/         product, architecture, roadmap, decisions, issues
```

## Prerequisites

- [nvm](https://github.com/nvm-sh/nvm) (the repo pins Node 24 in `.nvmrc`)
- Docker Desktop
- pnpm, enabled through Node's corepack (step 2 below)

## Setup

```bash
nvm install && nvm use
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env
mkdir -p ~/.forgeops && chmod 700 ~/.forgeops
(umask 077 && openssl rand -base64 32 > ~/.forgeops/env-encryption.key)
docker compose up -d
pnpm --filter @forgeops/api exec prisma migrate dev
```

Optional demo data, safe to rerun after the local database is reset: set `SEED_GITHUB_INSTALLATION_ID` in
`apps/api/.env`, then run `pnpm --filter @forgeops/api seed`. It creates `demo@forgeops.test` (password saved in
`~/.forgeops/demo-password`), links the GitHub installation and adds the sample project and service.

Set `ENCRYPTION_KEY_PATH` in `apps/api/.env` to the full path of that key file (it encrypts service env vars; losing
it loses the stored values). GitHub settings are optional: fill in the `GITHUB_APP_*` values from your GitHub App
to connect repositories, and `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET_PATH` to verify installations through
GitHub sign-in. Keep key files outside the repo and put only their paths in `.env`. `RABBITMQ_URL`,
`REGISTRY_HOST` and `TEST_REGISTRY_HOST` (already in `.env.example`) are needed by the deployment worker and the tests, which also need
Docker running.

## Run

In three terminals (run `nvm use` in each):

```bash
pnpm --filter @forgeops/api dev
pnpm --filter @forgeops/api worker
pnpm --filter @forgeops/frontend dev
```

The worker sends queued deployments to RabbitMQ and runs them: it downloads the commit, builds the image with this
machine's Docker and pushes it to the local registry. It needs the GitHub App settings and Docker, and exits if it
loses its RabbitMQ connection; start it again and unfinished messages are redelivered.

Open http://localhost:5173. The frontend forwards `/api` and `/health` requests to the API.

| Service | Address |
| --- | --- |
| Dashboard | http://localhost:5173 |
| API | http://localhost:4000 (`/health/live`, `/health/ready`) |
| PostgreSQL | `127.0.0.1:5433`, user / password / database: `forgeops` (local only) |
| RabbitMQ | `127.0.0.1:5673`, management UI http://localhost:15673, user / password: `forgeops` (local only) |
| Image registry | `localhost:5001` (`curl localhost:5001/v2/_catalog` lists images; local only, no login) |
| Test image registry | `localhost:5002`, used only by the tests; in memory, emptied on restart |

## Checks

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

## Troubleshooting

- **Port 5432 already in use:** expected if you run another PostgreSQL. ForgeOps uses 5433.
- **First `docker compose up` is slow:** PostgreSQL initialises its data on first start (can take ~30 s on
  Docker Desktop for Mac). Later starts take seconds.
- **`Cannot find module .../generated/prisma/client.js`:** run `pnpm --filter @forgeops/api exec prisma generate`.
- **`Invalid configuration`:** a setting in `apps/api/.env` is missing or wrong; the message names which one.
- **Stop everything:** `docker compose stop` (keeps data) or `docker compose down -v` (deletes data).
