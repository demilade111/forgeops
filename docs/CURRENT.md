# ForgeOps — Current Work

_Last updated: 2026-10-25_

## Project status

- **Phase 0 (product discovery and architecture) is in progress.**
- **No application code exists yet.** The repository contains documentation only.
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

**Active phase:** Phase 1 / **M1-S0 Foundation**.

**Next ticket:** FGO-01.04.03 Configure database connection and migrations (Prisma) · Status: Design discussion.
(1.3.6 error handling is deferred until the first real feature needs it.)

Local environment (2026-10-25): git 2.50.1 · Docker 29.8.2 · Node 24.22.1 LTS via nvm (pinned in
`.nvmrc`; system default left unchanged, run `nvm use` in this folder) · pnpm 11.5.2 via corepack.

Repository: private GitHub repo https://github.com/demilade111/forgeops, default branch `main`.

Dependency install scripts are blocked by default (pnpm). `esbuild` (used by tsx) is explicitly denied in
`pnpm-workspace.yaml` because tsx works without it.

Run the API locally: `nvm use`, then `pnpm --filter @forgeops/api dev` (port 4000, override with `PORT`).

Local database: `docker compose up -d` starts PostgreSQL 18 on `127.0.0.1:5433` (user, password and database
all `forgeops`; local development only). Port 5433 because Homebrew PostgreSQL 14 already uses 5432.
Stop with `docker compose stop`; `docker compose down -v` also deletes the data.

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
| FGO-01.04.03 | Prisma connection and migrations | Design discussion | Next |

## Open decisions to watch

ADR-007 authentication mechanism (needed before M1-S1) · ADR-017 automatic build engine ·
ADR-018 scheduled-job mechanism · ADR-019 managed URL scheme · ADR-020 alert channel ·
ADR-021 metrics source · ADR-022 failed-rollout criteria · plus proposed ADRs for Kubernetes and cloud.

## Blockers

None.
