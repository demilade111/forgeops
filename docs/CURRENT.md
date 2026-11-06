# ForgeOps — Current Work

_Last updated: 2026-11-05_

## Project status

- **Phase 0:** core planning done; remaining tickets deferred to just-in-time.
- **Built so far:** M1-S0 to M1-S6: foundation, accounts, reference app, GitHub connect plus projects and services
  (backend), deployment intent with the outbox, RabbitMQ and the worker (backend), build and push of the image
  to a local registry (backend), and running the image behind a managed URL through Caddy (backend).
- Approved V1 features are requirements, not implementations.

## Completed

| Ticket | Title | Status | Decisions |
| --- | --- | --- | --- |
| FGO-00.01.01 | Define the first deployable application | **Done** (2026-10-25) | PD-001 to PD-007 |
| FGO-00.01.02 | User personas and workflows, incl. access control | **Done** (2026-10-25) | PD-008 to PD-012 |

Phase 0.1.2 summary (details in `docs/DECISIONS.md` and `docs/PRODUCT.md`):

| ID | Decision |
| --- | --- |
| PD-008 | Org-scoped authorization; V1 has one `owner` role; several orgs per user; invites and roles in V1.5 |
| PD-009 | Personas: developer, org owner, platform operator, automated system; core workflows W1–W9 |
| PD-010 | M1 includes real accounts (sign-up, login, logout, personal org); no single-user shortcut |
| PD-011 | Manual deploys in M1; opt-in auto-deploy on push per service in V1; trigger recorded per deployment |
| PD-012 | No platform super-admin UI in V1; operator cannot read tenant secrets through ForgeOps |

PD-008, PD-009, PD-010 and PD-012 were decided by Claude at the product owner's request; PD-011 was
explicitly confirmed by the product owner. Any of them can be revisited.

Accepted architecture decisions: ADR-001 (modular monolith + worker), ADR-002 (React + Vite SPA),
ADR-003 (Node.js + Express + TypeScript), ADR-004 (PostgreSQL), ADR-005 (Prisma), ADR-006 (RabbitMQ
locally / SQS in the cloud), ADR-023 (pnpm monorepo). ADR-016 (secrets) direction agreed.

## Next

**Planning status (2026-10-25):** the product owner closed core planning. The remaining Phase 0 tickets
(0.1.3–0.1.10, 0.2, 0.3, 0.4) are **deferred, not dropped**: each is done just-in-time before the M1
slice that needs it (e.g. 0.2.1 auth requirements before M1-S1).

**M1-S0 Foundation: Done (2026-10-25).** Browser → React → Express → PostgreSQL runs end to end, reports
failures correctly, and starts from documented commands (`README.md`).

**M1-S1 Identity & organization: Done (2026-10-27).** Sign-up, login, logout and `/api/me` work end to end in
the browser, backed by server-side sessions. Still open from Phase 2: rate limiting (2.2.9), concurrency tests
(2.2.10), per-field form messages (2.3.3).

**M1-S2 Reference API: Done (2026-10-28).** Private repo https://github.com/demilade111/forgeops-sample-api
(sibling folder `../forgeops-sample-api`).

**M1-S3 Connect & configure: backend done (2026-10-31).** GitHub App `forgeops-dev-demilade111` (ID 5550990)
installed (installation 177099801) and linked by hand to the local test account `demo@forgeops.test` (OAuth
deferred, ADR-042). Projects and web services API (FGO-03.04.02): create/list/read projects, add/read/update a
service; source checked against GitHub on save (installation covers the repo, branch exists, Dockerfile in the
folder); env vars encrypted at rest (ADR-040). Screens follow after M1-S6 (PD-013).

**M1-S4 Deployment intent & progress: backend done (2026-11-01).** `POST /api/services/:id/deployments` (required
`Idempotency-Key`, 202, 409 while another deployment is active) saves the deployment and an outbox row in one
transaction. The worker (`pnpm --filter @forgeops/api worker`) relays the outbox to RabbitMQ with publisher
confirms, claims the deployment, resolves the branch's commit through the GitHub App (3 retries with backoff) and
records the `resolve-commit` step. Duplicates are skipped, crashed jobs are redelivered and resumed, poison
messages go to `deployments.dead`. ADR-043 to ADR-047. The local database had to be re-seeded (ISS-032): local
test account `demo@forgeops.test` (random password, never shown), installation 177099801 re-linked, service
`api` in project `sample-shop` with source directory `api`.

**M1-S5 Build & track: backend done (2026-11-03).** After `resolve-commit` the worker now runs `fetch-source`
(GitHub tarball of the pinned commit into a fresh per-deployment folder, paths kept inside it), `build`
(`docker build` with BuildKit on this machine, log saved on the step) and `push` (to the local registry `registry:3`
on `127.0.0.1:5001`, digest saved as `Deployment.image`). Build 15 min, push 5 min and GitHub 2 min time limits; a
sweeper fails deployments running over 60 minutes and releases their lock (5.5.7). ADR-048 to ADR-051. The local
database was empty again (ISS-035), so a local seed script now recreates everything (ADR-053):
`pnpm --filter @forgeops/api seed` gives `demo@forgeops.test` (password in `~/.forgeops/demo-password`), the GitHub
link, project `sample-shop` and service `api` (source directory `api`, port 8080).

**M1-S6 Run & expose: backend done (2026-11-05).** After `push` the worker now runs `run` (env vars decrypted into a
600 file, `docker run` of the image by digest as `fo-<deploymentId>` on network `forgeops-apps`) and `route` (Caddy
admin API: `<service>.<project>.localhost` goes to that container and port; older containers of the service removed;
URL saved on `Deployment.url`). A failed start or routing keeps the live version serving. `curl
http://api.sample-shop.localhost` returns the sample API's response. ADR-019 accepted, ADR-054, ADR-055. The local
data was gone again (ISS-036); `seed` restored it.

**Mini frontend (PD-013): done (2026-11-06).** Vercel-style landing page with a live deploy replay; login and
sign-up; projects with the GitHub connection; create project; add a web service (repository from GitHub, branch,
source directory, port, encrypted env vars); service page with Deploy, deployment history, live step-by-step status
with logs, and the live URL. ADR-056 to ADR-058.

**Next:** M1-S7 Readiness & health (decisions needed: health path per service, readiness time limit).

Local environment (2026-10-27): git 2.50.1 · Docker engine now **OrbStack** (was Docker Desktop) · Node 24.22.1
LTS via nvm (pinned in `.nvmrc`; run `nvm use` in this folder) · pnpm 11.5.2 via corepack.

Repository: private GitHub repo https://github.com/demilade111/forgeops, default branch `main`.

Dependency install scripts are blocked by default (pnpm). `esbuild` (used by tsx) is explicitly denied in
`pnpm-workspace.yaml` because tsx works without it.

Run the API locally: `nvm use`, then `pnpm --filter @forgeops/api dev` (port 4000, override with `PORT`).

Local services: `docker compose up -d` also starts Caddy (apps at `http://<service>.<project>.localhost`, admin API
on `127.0.0.1:2019`) and a test Caddy (admin 2020, HTTP 8081). It starts RabbitMQ 4 on `127.0.0.1:5673` (UI on 15673) and PostgreSQL 18 on `127.0.0.1:5433` (user, password and database
all `forgeops`; local development only). Port 5433 because Homebrew PostgreSQL 14 already uses 5432.
Stop with `docker compose stop`; `docker compose down -v` also deletes the data.

API settings live in `apps/api/.env` (git-ignored; copy from `.env.example`). The Prisma client is generated
into `apps/api/src/generated/` on install; after editing `schema.prisma`, run
`pnpm --filter @forgeops/api exec prisma generate`.

Run the frontend: `pnpm --filter @forgeops/frontend dev` (http://localhost:5173). Vite forwards `/api` and
`/health` to the API on port 4000, so start the API and database first.

API tests use a separate database, `forgeops_test` (`TEST_DATABASE_URL` in `apps/api/.env`); Vitest applies
migrations to it automatically. Docker must be running.

## Task log

| Ticket | Title | Status | Notes |
| --- | --- | --- | --- |
| — | Project docs bootstrap (CLAUDE.md, docs/) | Done | Created from master plan v1.0 |
| FGO-00.01.01 | Define the first deployable application | Done | PD-001 to PD-007 |
| FGO-00.01.02 | User personas and workflows (incl. access control) | Done | PD-008 to PD-012 |
| FGO-00.01.03–00.04.08 | Remaining Phase 0 tickets | Deferred | Done just-in-time before the slice that needs them |
| FGO-01.01.01 | Create the Git repository | Done | Verified: repo private, `origin/main` = local `main`, `.env` and `.DS_Store` ignored |
| FGO-01.01.03 | Configure TypeScript and shared linting | Done | Verified: lint and format checks pass; lint rejects `any` and unused vars; strict tsconfig rejects unchecked index access and implicit `any` |
| FGO-01.01.05 + 01.03.01 | Create API workspace and bootstrap Express | Done | Verified: typecheck, lint, format, build pass; server answers HTTP; busy port exits with code 1 and a clear error; `tsx watch` dev mode works |
| FGO-01.03.04–05, 01.03.09 | Health endpoints + test setup | Done | Verified: 7 tests pass (live, ready, failing check, timeout, no error leak, 404); sabotaging readiness makes 2 tests fail; real server answers both endpoints |
| FGO-01.03.03 | Environment validation | Done | Verified: 15 tests pass; real server refuses PORT=abc/0/70000 with a clear message and exit 1; unset PORT uses 4000; error messages never echo the rejected value |
| — | Simplify API to a single `server.ts` | Done | Owner request: removed `app.ts` and the health module; readiness returns ok until 1.4.5. Verified: 11 tests pass, sabotage test caught a leaked value, built and dev servers answer 200, bad PORT and busy port exit 1 |
| FGO-01.03.06 | Global validation and exception handling | Deferred | Added when the first real feature needs it |
| FGO-01.04.01 | Start PostgreSQL locally | Done | Verified: PostgreSQL 18.6 reachable on 127.0.0.1:5433 only; data survives a container restart; Homebrew PostgreSQL 14 on 5432 untouched |
| FGO-01.04.03, 01.04.05 | Prisma + database readiness check | Done | Verified: 15 tests pass; real server returns ready 200 with DB up, 503 instantly with DB stopped (live stays 200), back to 200 ~3 s after DB restart; missing DATABASE_URL refused; fresh install regenerates the client; dev mode reads `.env` |
| FGO-01.04.04 | Initial database schema | Deferred | Comes with M1-S1 identity tables |
| FGO-01.01.04, 01.04.06–08 | Frontend workspace + live API status | Done | Verified: 20 tests pass (5 frontend, 15 API); typecheck, lint, format, build pass; in a real browser the page showed "healthy", then "database unavailable" with Postgres stopped, "API unreachable" with the API stopped, and recovered on its own when both came back |
| — | Rename `apps/web` to `apps/frontend` | Done | Owner request; docs and lockfile updated |
| FGO-01.01.08 | Local setup documentation (README) | Done | Verified on a fresh clone: install (client generated by postinstall), 20 tests, typecheck, lint, format all pass |
| — | Frontend structure: axios API layer, `useRequest`, Zustand session store, types folder, Tailwind | Done | Owner request. 40 tests pass; typecheck, lint, format, build pass; browser: styled form, "Please wait..." during login, signed-in card, logout |
| — | Redesign with shadcn/ui | Done | Split-screen login with brand panel, signed-in dashboard with organizations and a projects empty state; checked at desktop and phone sizes; 5 frontend tests, typecheck, lint, build pass |
| M1-S2 | Reference API (`forgeops-sample-api`) | Done | 3 tests; Docker image builds; healthy release returns 200, `FAIL_READINESS=true` returns 503 on readiness while staying live; non-root; stops cleanly on SIGTERM |
| FGO-03.04.02 | Projects and web services API (M1-S3 backend) | Done | 71 API + 5 frontend tests; sabotage tests caught a missing organization filter and plain-text env vars; real `curl` against GitHub: typo branch, wrong folder, repo outside the installation and bad port refused, valid service saved, database holds only ciphertext |
| — | GitHub App connect flow (M1-S3) | Done | Commit `2d9ae95`; OAuth verification built and tested but not configured (ADR-042) |
| M1-S4 | Deployment intent & progress (backend) | Done | 92 API + 5 frontend tests, incl. a real RabbitMQ round trip and redelivery; 7 sabotage tests caught a claim that accepted finished deployments, ack before work, a missing outbox row, no lock, a lock never released, a relay that never marks rows sent and an unscoped read. Real run against GitHub: deploy with the worker off waited in the outbox, then succeeded with `main`'s real SHA; replay 202, second key 409, no key 400; missing branch failed with the reason and released the lock; worker exits when RabbitMQ restarts and stops cleanly on SIGTERM |
| — | Local seed script (ADR-053) | Done | Ran twice: second run changed nothing; password file 600. Full path through the real API with the seeded account: login 200, service shows port 8080 and env var names only, Deploy 202, worker ran all four steps to succeeded with the same digest as the earlier smoke run |
| M1-S5 | Build & track (backend) | Done | 103 API + 5 frontend tests, builds and pushes run against the real local Docker and registry; 11 sabotage tests caught: no tag cleanup after push, no symlink containment, time-out not detected, digest not parsed, workspace not cleaned, a resumed deployment resolving the branch again, build log not saved, failed step log dropped, image not recorded, sweeper keeping the lock, sweeper failing fresh deployments. Real run against GitHub: `demilade111/forgeops-sample-api` at `f2edcd7` fetched, built and pushed in 22 s; image pulled back by digest runs as `node` and returns 200 on `/` and `/health/ready`; worker refuses to start without `REGISTRY_HOST` or without Docker, and stops cleanly on SIGTERM. Self-review fixes: Docker checked at start-up, local tag removed after push, tests use their own registry on 5002 (ADR-052) |
| PD-013 | Mini frontend | Done | 5 frontend tests, typecheck, lint, build pass. In the browser: sign-up lands on projects; a bad project name shows the API message; create project; add-service form; Deploy on a service without GitHub showed "GitHub is not connected" on the Pin commit step through the real worker; checked at phone width. The success view (Live badge, URL) was not exercised in the browser, because signing in as the GitHub-linked demo account needs its password |
| M1-S6 | Run & expose (backend) | Done | 110 API + 5 frontend tests, with real containers and a test Caddy; 5 sabotage tests caught: old containers not removed, URL collision not checked, new container left behind when routing fails, env vars not passed, URL not saved. Real run through the API with the seeded account: all six steps succeeded for `forgeops-sample-api` at `f2edcd7`; `curl http://api.sample-shop.localhost` returned the sample's JSON and `/health/ready` 200; still 200 after a Caddy restart; a redeploy left one container. Unknown hosts get 404 |
| — | Delete services and projects (ADR-060) | Done | 118 API tests incl. 8 new: delete hides at once and refuses deploys, project delete takes its services, 409 while a deploy runs, other orgs get 404, the worker takes a real running app offline (URL 404, no containers, rows gone), a stray message leaves a live service alone, a router outage keeps the deletion pending and the sweeper requests it again. Browser, with a throwaway account: typed the name, deleted a service, then the project; the worker removed both |
| M1-S1 | Identity & organization | Done | 35 API + 5 frontend tests pass; sabotage tests caught a readable cookie, a skipped password check and a logout that kept the session; in a real browser: sign-up, reload stays signed in, logout, wrong password error, login, duplicate email error |

## Deferred until needed

| Item | Needed when | Notes |
| --- | --- | --- |
| GitHub OAuth verification live (Client ID + secret in `~/.forgeops/`) | Before anyone other than the owner uses ForgeOps, and at the latest before M1-S13 | Code and tests done; needs "Request user authorization during installation", Callback URL `http://localhost:5173/api/github/callback`, Client ID and a client secret |
| Remaining frontend screens (PD-013) | One pass after M1-S12, before M1-S13 | Logs, history, rollback, metrics, alerts |
| Restrict the GitHub App installation to `forgeops-sample-api` (ISS-031) | Now; owner action on GitHub | Installation settings: "Only select repositories" |
| Paginate repository listing beyond 100 repos (4.2.9) | Before real users connect large accounts | `listRepositories` reads one page of 100 |
| Worker lease (worker id + heartbeat) | Before running more than one worker | Resuming `running` is only safe with one worker (ADR-046) |
| Deployment list pagination (5.3.9) and cancellation (5.3.7) | With the deployment history screen | List returns the latest 50 |
| Build CPU/memory limits; rootless builder | Before building anyone else's code | M1 builds trusted repos with the host's Docker (ADR-048) |
| Container CPU/memory limits; Caddy admin API unreachable from app containers | Before running anyone else's code | ADR-019, ADR-054 |
| Globally unique URLs (same project and service name in two orgs) | Before a second organization deploys | Refused for now (ADR-019) |
| `JobPublisher`/`JobConsumer` split and SQS adapter (ADR-006) | Phase 8 | `connectQueue` is the interface for now (ADR-045) |

## Open decisions to watch

ADR-017 automatic build engine ·
ADR-018 scheduled-job mechanism · ADR-020 alert channel ·
ADR-021 metrics source · ADR-022 failed-rollout criteria · plus proposed ADRs for Kubernetes and cloud.

## Blockers

None.
