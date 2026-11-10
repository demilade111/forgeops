# ForgeOps — Decision Register

Two kinds of decisions are recorded here:

- **Product decisions (PD-xxx):** what ForgeOps must do. Confirmed by the product owner.
- **Architecture decisions (ADR-xxx):** how ForgeOps is built.

No proposed or open item becomes final simply because it appears here. Each one is compared against
alternatives and its reasoning recorded before Claude implements the relevant module.

Statuses: **Confirmed / Accepted** (final) · **Proposed** (recommendation, not approved) ·
**Open** (unresolved, no choice made) · **Deferred** · **Superseded**

---

## 1. Product decisions

| ID | Decision | Status |
| --- | --- | --- |
| PD-001 | Repository support: single- and multiple-repository applications | **Confirmed** (2026-10-25, Phase 0.1.1) |
| PD-002 | Build strategies: Dockerfile builds and automatic builds, one shared deployment pipeline | **Confirmed** (2026-10-25, Phase 0.1.1) |
| PD-003 | Service types: web services, background workers, scheduled jobs | **Confirmed** (2026-10-25, Phase 0.1.1) |
| PD-004 | Automatic-build languages: JavaScript, TypeScript, Python | **Confirmed** (2026-10-25, Phase 0.1.1) |
| PD-005 | Service configuration: automatic detection with editable settings | **Confirmed** (2026-10-25, Phase 0.1.1) |
| PD-006 | Advanced Deployment Operations in V1 (Option C) | **Confirmed** (2026-10-25, Phase 0.1.1) |
| PD-007 | First milestone: Production-Style Deployment of an Express + TypeScript API (Option C) | **Confirmed** (2026-10-25, Phase 0.1.1) |
| PD-008 | Access control: org-scoped authorization; V1 has one `owner` role; invites and roles in V1.5 | **Confirmed** (2026-10-25, Phase 0.1.2)* |
| PD-009 | Personas (developer, org owner, platform operator, automated system) and core workflows W1–W9 | **Confirmed** (2026-10-25, Phase 0.1.2)* |
| PD-010 | M1 includes real accounts and organization scoping; no single-user shortcut | **Confirmed** (2026-10-25, Phase 0.1.2)* |
| PD-011 | Deploy triggers: manual in M1; opt-in auto-deploy on push per service in V1; trigger recorded per deployment | **Confirmed** (2026-10-25, Phase 0.1.2; explicitly confirmed by product owner) |
| PD-012 | Platform operator: no super-admin UI in V1; no access to tenant secret values through ForgeOps | **Confirmed** (2026-10-25, Phase 0.1.2)* |
| PD-013 | Build order: backend and DevOps for the remaining M1 slices first, frontend screens afterwards | **Confirmed** (2026-10-31, product owner) |

\* Decided by Claude at the product owner's request ("take the decision now"). The product owner may revisit any of them.

### PD-001 — Repository support
- V1 supports single-repository applications (multiple services sharing one GitHub repository) and
  multiple-repository applications (services in different repositories).
- Each service independently references its own GitHub repository, branch and source directory.
- Multiple services may reference the same repository.
- **Constraint:** nothing in the design may assume one project = one repository.

### PD-002 — Build strategies
- **Dockerfile builds:** the developer provides a Dockerfile; ForgeOps builds the image from it. This can
  support additional languages when the Dockerfile produces a compatible container image.
- **Automatic builds:** no Dockerfile; ForgeOps detects supported application characteristics and uses an
  appropriate build engine to produce a container image.
- Both methods feed one shared deployment pipeline.
- **The automatic build engine is not selected** (see ADR-017).
- _Supersedes_ the earlier draft position "Dockerfile required, no buildpacks in V1" (2026-10-24, never confirmed).

### PD-003 — Supported service types
1. **Web services:** HTTP applications, including frontend websites and backend APIs. Can receive managed public URLs.
2. **Background workers:** continuously running processes without public HTTP endpoints.
3. **Scheduled jobs:** applications or commands run on a configured schedule. Need schedule configuration,
   execution history, status and logs.
- Workers and scheduled jobs do not require public URLs.

### PD-004 — Automatic-build language support
- Officially supported for automatic builds in V1: **JavaScript, TypeScript, Python**.
- Candidate application types: Node.js APIs, Next.js applications, React/Vite frontends, Python APIs and workers.
- Language support **does not** mean every framework is supported. Specific framework and runtime
  conventions are defined and tested during implementation planning.
- Go, Java and other languages are not committed to automatic builds in V1, but may deploy via Dockerfile builds.

### PD-005 — Service configuration experience
- Flow: connect repository → select branch and source directory → ForgeOps inspects and suggests settings
  → developer reviews → developer overrides where applicable → developer confirms before deploying.
- Settings: build method, source directory, build command, start command, runtime/framework, application
  port (web services), environment variables and secrets, schedule (scheduled jobs).
- When detection is ambiguous or insufficient, ForgeOps requests explicit configuration and never silently
  invents values.
- A repository-based YAML configuration file is not a required V1 feature.

### PD-006 — Advanced Deployment Operations (Option C)
- Required in V1: deployment progress and status; build and deployment logs; deployment history; source
  commit and image tracking; readiness and health checks; manual rollback; automatic rollback on failed
  rollout; basic CPU and memory metrics; failure alerts; useful failure reporting.
- Build success, rollout success and application health are **distinct outcomes**.
- **Automatic rollback is a recovery attempt, not a guarantee.** A destructive database migration or an
  unavailable infrastructure dependency may stop a previously healthy version from recovering.

### PD-007 — First end-to-end milestone (Option C: Production-Style Deployment)
- Reference application: a small Express.js + TypeScript HTTP API.
- The 15 acceptance criteria are listed in `docs/PRODUCT.md` (Milestone M1).
- Delivered through small, testable vertical slices (`docs/ROADMAP.md`, Milestone M1).
- M1 is the first milestone, **not** the full V1 release.

### PD-008 — Access control (Phase 0.1.2)
- Every resource belongs to an organization; every request is authorized against organization membership.
  Non-members get no access, and other organizations' resources behave as if they don't exist (no IDOR leaks).
- V1 has one role, `owner`: the creator is the organization's only member. A user can own several
  organizations and switch between them. A personal organization is created on sign-up.
- Invitations and the roles admin / developer / viewer are V1.5. Memberships store a role from day one so
  this needs no data-model redesign.
- **Why:** real tenant isolation (and tests proving it) without building team management in V1.
- **Alternatives rejected:** single global user with no organizations (no isolation to prove, and painful
  to retrofit); full RBAC with invites in V1 (large scope for little demo value).

### PD-009 — Personas and core workflows (Phase 0.1.2)
- Personas: developer (primary), organization owner (same person as the developer in V1), platform operator,
  automated system. Details in `docs/PRODUCT.md`.
- Core workflows W1–W9 (onboarding, create project, connect GitHub, add service, first deployment,
  investigate failure, recover, scheduled job runs, switch organization). Detailed journeys: tickets 0.1.3–0.1.9.

### PD-010 — M1 includes real accounts (Phase 0.1.2)
- M1 includes sign-up, login, logout and an automatically created personal organization, with all M1 data
  organization-scoped. No unauthenticated or single-user shortcut.
- **Why:** retrofitting authorization is a classic source of security bugs, and ForgeOps builds code from
  GitHub, so its control plane must never be open.
- **Cost:** M1 gains an identity slice (M1-S1). The login mechanism is still ADR-007.

### PD-011 — Deploy triggers and attribution (Phase 0.1.2)
- M1: manual deploys only.
- V1: auto-deploy on push to the service's configured branch, **off by default**, enabled per service.
- Every deployment records its trigger: user (who), GitHub push (which commit), or automatic rollback
  (which failed deployment caused it).

### PD-012 — Platform operator access (Phase 0.1.2)
- No platform super-admin UI in V1; the operator uses infrastructure and observability tools and runbooks.
- The operator must not be able to read tenant secret values through ForgeOps.
- A platform-operator admin UI is V1.5.

### PD-013 — Backend and DevOps first, frontend afterwards (2026-10-31)
- **Context:** the M1 slices in `ROADMAP.md` are vertical (API + UI per slice). The product owner wants to focus
  on the backend and DevOps, which are the main learning goals, and add the screens afterwards.
- **Options:** (a) keep vertical slices with UI each time; (b) build the backend and DevOps for M1-S3 to M1-S12
  first, then the frontend in one pass.
- **Choice:** (b), with one checkpoint: after M1-S6 (first real deploy end to end) build three small screens
  (service setup form, Deploy button, deployment status page) to validate the API shape and give a demo.
- **Trade-offs:** faster progress on the core engine and less UI rework while the API shape settles; but slice
  acceptance is shown through API tests and `curl` instead of the dashboard until the frontend pass, and UI
  problems surface later.
- **Consequences:** each slice is "backend done" when its API, worker and infrastructure pass tests and a real
  `curl`/CLI run; after S6 a mini frontend pass covers setup, deploy and status; the remaining screens (logs,
history, rollback, metrics, alerts) become one frontend pass before M1-S13. Existing screens
  (login, dashboard, repositories card) stay as they are.

---

## 2. Architecture decisions

| ID | Question | Current position | Status |
| --- | --- | --- | --- |
| ADR-001 | Application architecture | Modular monolith with feature-based modules and a separate deployment worker | **Accepted** (2026-10-24) |
| ADR-002 | Frontend | React + Vite + TypeScript single-page app (not Next.js) | **Accepted** (2026-10-25) |
| ADR-003 | Backend | Node.js + Express 5 + TypeScript (not NestJS) | **Accepted** (2026-10-24) |
| ADR-004 | Primary database | PostgreSQL | **Accepted** (2026-10-25) |
| ADR-005 | ORM / data access and migrations | Prisma | **Accepted** (2026-10-25) |
| ADR-006 | Message queue | RabbitMQ locally, AWS SQS in the cloud, behind one queue interface | **Accepted** (2026-10-24) |
| ADR-007 | Authentication mechanism | Server-side sessions in PostgreSQL, httpOnly cookie, email + password (not JWT) | **Accepted** (2026-10-25) |
| ADR-008 | Repository integration | GitHub App `forgeops-dev-demilade111`: Contents read-only, Metadata read-only, own account only, webhooks off | **Accepted** (2026-10-31) |
| ADR-009 | Build execution | Controlled CI-based builds before self-hosted runners; applies to both build methods (PD-002) | Proposed; M1 builds decided by ADR-048 |
| ADR-010 | Workload orchestration | Local Kubernetes first; managed cluster later if justified | Proposed |
| ADR-011 | Cloud | AWS for the production-style environment | Proposed |
| ADR-012 | Infrastructure as code | Terraform | Proposed |
| ADR-013 | Observability | Structured logs, metrics and traces introduced progressively; basic CPU/memory metrics and alerts are V1 (PD-006) | Proposed |
| ADR-014 | Tenant isolation | Authorization side settled by PD-008 (org-scoped). Workload side: one trusted workload environment initially | Proposed |
| ADR-015 | Deployment strategy | Rolling deployments with manual rollback **and automatic rollback on failed rollout** (PD-006) | Proposed (updated 2026-10-25) |
| ADR-016 | Secret management | Local `.env` (git-ignored) in development; AWS Secrets Manager for ForgeOps' own secrets in the cloud. App reads secrets only from env/config | Proposed (direction agreed 2026-10-24) |
| ADR-017 | Automatic build engine | Not selected (PD-002) | **Open** |
| ADR-018 | Scheduled job execution mechanism | Not selected (PD-003) | **Open** |
| ADR-019 | Managed URL scheme and traffic routing for web services | `http://<service>.<project>.localhost` in M1; Caddy reverse proxy, routes added at runtime through its admin API | **Accepted** (2026-11-05) |
| ADR-020 | Alert channel | Email to workspace members (Mailpit locally, SMTP such as Amazon SES in the cloud) and an optional Slack incoming webhook (ADR-070) | **Accepted** (2026-11-06) |
| ADR-021 | Source of basic CPU/memory metrics | `docker stats` sampled every 15 s by the worker into Postgres, kept 24 hours (ADR-069) | **Accepted** (2026-11-06) |
| ADR-022 | Failed-rollout criteria that trigger automatic rollback | Watch 5 minutes after go-live, check every 10 s; 3 failed checks in a row or a crash rolls back to the previous good version (ADR-067) | **Accepted** (2026-11-06) |
| ADR-023 | Repository layout | One Git monorepo with pnpm workspaces: `apps/frontend`, `apps/api`, `apps/worker`, `packages/shared` | **Accepted** (2026-10-25) |
| ADR-025 | Test tooling | Vitest (runner) + Supertest (HTTP tests against the Express app, no open port) | **Accepted** (2026-10-25) |
| ADR-026 | Password hashing | Node's built-in `crypto.scrypt` (not argon2 / bcrypt packages) | **Accepted** (2026-10-25) |
| ADR-027 | API route prefix | Application routes under `/api/...`; health checks stay at `/health/...`; no version prefix yet | **Accepted** (2026-10-25) |
| ADR-028 | Error responses | One JSON shape `{ "error": { "code", "message" } }`; no stack traces or internal details | **Accepted** (2026-10-25) |
| ADR-029 | Identity data model | `User`, `Organization`, `Membership` (role on the membership), `Session` (hashed token); UUIDv7 ids; lowercase emails | **Accepted** (2026-10-26) |
| ADR-030 | Database tests | Integration tests run against a real PostgreSQL test database (`forgeops_test`), not mocks | **Accepted** (2026-10-26) |
| ADR-031 | Health status in the UI | No health display in the dashboard; `/health/live` and `/health/ready` stay for infrastructure probes | **Accepted** (2026-10-26) |
| ADR-032 | Unused-argument lint rule | Allow unused parameters that start with `_` | **Accepted** (2026-10-26) |
| ADR-033 | Frontend structure | Feature folders mirroring API modules (`src/auth/`); plain React state and `fetch`; no router, form or data-fetching library yet | **Accepted** (2026-10-27) |
| ADR-034 | Frontend API layer | One axios instance and every API call in `src/api/index.ts`; `useRequest` hook for loading and errors; shared types in `src/types/` | **Accepted** (2026-10-28) |
| ADR-035 | Frontend shared state | Zustand store for state several screens share (the session); `useState` for state one component owns | **Accepted** (2026-10-28) |
| ADR-036 | Styling | Tailwind CSS 4 + shadcn/ui (Radix base, Nova preset, Geist font, Lucide icons) | **Accepted** (2026-10-28) |
| ADR-037 | Reference app for M1 | Separate private repo `forgeops-sample-api`: Express API in `api/`, npm, port 8080, `FAIL_READINESS` switch | **Accepted** (2026-10-28) |
| ADR-038 | GitHub API client | Plain `fetch` + Node `crypto` to sign the App JWT; no Octokit yet | **Accepted** (2026-10-31) |
| ADR-039 | Verifying GitHub installations | OAuth during installation + `state` cookie; accept an installation only if GitHub lists it for the signed-in GitHub user | **Accepted** (2026-10-31) |
| ADR-040 | Service env var storage | Every value encrypted with AES-256-GCM (Node `crypto`); key file outside the repo; API returns names only | **Accepted** (2026-10-31) |
| ADR-041 | Projects and services model | `Project` (slug name, unique per org) → `Service` (web, Dockerfile, repo id + name, branch, folder, port); source checked against GitHub on save | **Accepted** (2026-10-31) |
| ADR-042 | GitHub OAuth settings optional | API starts with only the App settings; installation verification answers 503 until Client ID and secret are added | **Accepted** (2026-10-31) |
| ADR-043 | Deployment model and duplicates | `Deployment` + `DeploymentStep` + `Outbox`; required `Idempotency-Key`; one active deployment per service via unique `activeServiceId` | **Accepted** (2026-11-01) |
| ADR-044 | Worker location | Worker is a second process inside `apps/api` (`src/worker.ts`) | **Accepted** (2026-11-01) |
| ADR-045 | RabbitMQ client and queue | `amqplib`; durable quorum queue `deployments`, delivery limit 5, dead-letter queue; confirms; prefetch 1 | **Accepted** (2026-11-01) |
| ADR-046 | M1-S4 worker behaviour | Outbox relay every second, claim, `resolve-commit` with 3 retries, known limits | **Accepted** (2026-11-01) |
| ADR-047 | Shared helpers | `isId`, `loadGitHubClient`, `Config` type moved for reuse | **Accepted** (2026-11-01) |
| ADR-048 | Build execution for M1 | Local Docker Engine with BuildKit on the worker's machine, run through the `docker` CLI; trusted sources only | **Accepted** (2026-11-03) |
| ADR-049 | Fetching source code | GitHub tarball of the pinned commit, unpacked by system `tar` into a fresh per-deployment folder; paths must stay inside it | **Accepted** (2026-11-03) |
| ADR-050 | Image registry for M1 | Local `registry:3` container on `127.0.0.1:5001`; images `services/<serviceId>:<deploymentId>`; the digest reference is stored | **Accepted** (2026-11-03) |
| ADR-052 | Test image registry | Tests push to a second `registry:3` on `127.0.0.1:5002` with in-memory storage (`TEST_REGISTRY_HOST`), never the dev registry | **Accepted** (2026-11-03) |
| ADR-054 | Where web services run in M1 | `docker run` on the host's Docker, network `forgeops-apps`, container `fo-<deploymentId>`, restart unless stopped, env vars from a 600 env file | **Accepted** (2026-11-05) |
| ADR-055 | Runtime tests | A second Caddy (`caddy-test`, admin 2020, HTTP 8081) and real containers; tests remove only their own containers | **Accepted** (2026-11-05) |
| ADR-056 | Frontend routing | `react-router` 7 (library mode): `/`, `/login`, `/signup`, `/app/...` | **Accepted** (2026-11-06) |
| ADR-057 | Visual design | White-and-purple Render-style landing page, light app; Inter Tight headings, Inter body, Geist Mono for code; amber, green, red only for deploy status | **Accepted** (2026-11-06) |
| ADR-058 | Mini frontend data flow | `useLoad` hook for reads; the service page polls the open deployment every 1.5 s while queued or running; Deploy keeps one Idempotency-Key per attempt | **Accepted** (2026-11-06) |
| ADR-059 | Settings in the dashboard | Service Settings tab edits branch, root directory, port and env vars through the existing `PATCH /api/services/:id`; account Settings page shows account, workspace, GitHub and log out | **Accepted** (2026-11-06) |
| ADR-060 | Deleting services and projects | Clean delete through the outbox and worker: hide at once, remove the route and containers, then the rows; refused while a deploy is active; project delete takes its services | **Accepted** (2026-11-06) |
| ADR-061 | Readiness check before go-live | New `health` step between `run` and `route`: call the service's health check path (default `/health/ready`, empty accepts any answer) through a temporary Caddy route every second for up to 60 s; 2xx or 3xx passes; a stopped container fails at once | **Accepted** (2026-11-06) |
| ADR-062 | Logs and history | Build and push logs saved every second while running; app logs read by the API with `docker logs` for the live container only; deploy detail page at `/app/deployments/:id` with commit, image, trigger and steps | **Accepted** (2026-11-06) |
| ADR-063 | Manual rollback | A rollback is a new deployment (`trigger: rollback`, `rollbackOfId`) that reuses an earlier successful deploy's image by digest and runs only start, health check and go live; each deploy stores its port and health path, env vars use current values | **Accepted** (2026-11-06) |
| ADR-053 | Local seed script | `pnpm --filter @forgeops/api seed` recreates the demo account, GitHub link, project and service; safe to rerun | **Accepted** (2026-11-03) |
| ADR-051 | Build logs, time limits and stale deployments | Step logs in `DeploymentStep.log` (last 64 KiB); build 15 min, push 5 min, GitHub calls 2 min; sweeper fails deployments running over 60 min | **Accepted** (2026-11-03) |
| ADR-024 | Code-quality toolchain | TypeScript 6.0 (strict, shared base config), ESLint flat config + typescript-eslint, Prettier | **Accepted** (2026-10-25) |

### Open decisions: what each one must answer

- **ADR-017 Automatic build engine:** what turns JS/TS/Python source without a Dockerfile into an image?
  Candidates to evaluate only (none chosen): Cloud Native Buildpacks, Railpack/Nixpacks-style builders,
  ForgeOps-generated Dockerfiles from tested templates.
- **ADR-018 Scheduled jobs:** what triggers a run and records its history? E.g. the workload platform's
  native scheduler (such as a Kubernetes CronJob) versus a ForgeOps scheduler creating one-off runs.
- **ADR-019 Managed URLs:** URL format for web services, and how traffic reaches them (ingress or gateway choice, TLS).
- **ADR-020 Alerts:** where failure alerts go (in-app, email, webhook/Slack, …) and what triggers them.
- **ADR-021 Metrics:** where CPU and memory numbers come from and how long they are kept.
- **ADR-022 Failed rollout:** exact conditions (readiness timeout, crash loop, failed health checks)
  that mark a rollout failed and trigger an automatic rollback attempt.
- **ADR-007 Authentication mechanism:** sessions vs tokens, email/password vs GitHub sign-in. Needed before M1-S1.

---

## 3. Architecture decision records

<!--
Template:

### ADR-XXX — Title
- **Status:** Accepted (YYYY-MM-DD)
- **Context:** What forces the decision
- **Options considered:** A / B / C with trade-offs
- **Decision:** What we chose
- **Consequences:** What gets easier, what gets harder, what we'd revisit
-->

### ADR-001 — Modular monolith with a separate deployment worker
- **Status:** Accepted (2026-10-24)
- **Context:** One developer, many features, and a need to explain every part. Deployment work is slow
  and must survive API restarts.
- **Options considered:** microservices (independent scaling and deploys, but network calls, distributed
  data and heavy ops overhead for one person); a single monolith doing everything in-process (simplest,
  but slow deployment work would block or die with API requests); a modular monolith plus a worker.
- **Decision:** One API codebase split into feature-based modules with clear boundaries (`auth`,
  `organizations`, `projects`, `services`, `deployments`, `integrations`, …), plus a separate worker
  process that runs deployment jobs. The API and worker share code but run as separate processes and containers.
- **Consequences:** One database, one deploy pipeline, simple local development. Modules talk through each
  other's public service functions, never by reaching into another module's tables. If one module ever
  needs to be its own service, those boundaries make the split possible.

### ADR-003 — Backend framework: Node.js + Express + TypeScript
- **Status:** Accepted (2026-10-24). NestJS was considered and rejected; do not reintroduce it.
- **Context:** The API needs HTTP routing, validation, error handling, auth middleware, logging and
  tests. The project is also a learning vehicle, so understanding the fundamentals matters as much as speed.
- **Options considered:**
  - **NestJS:** opinionated structure, built-in dependency injection, modules, guards and validation pipes.
    Faster to scale a codebase, but hides a lot of the HTTP and middleware mechanics behind decorators.
  - **Express:** minimal and the most widely used Node.js web framework. We design the structure ourselves,
    which takes more code but teaches how the request lifecycle actually works.
  - **Fastify:** faster and schema-first, but a smaller ecosystem and less familiar to employers than Express.
- **Decision:** Express 5 with TypeScript. Express 5 forwards rejected promises from async handlers to the
  error middleware, which removes the main async pitfall of Express 4.
- **Consequences:**
  - We must define and keep our own layering: `routes → controllers → services → repositories`.
  - No built-in DI: dependencies are wired explicitly in one place at startup,
    which also makes testing easy.
  - Validation, config checking, error format, request logging and OpenAPI docs are chosen per task
    (likely Zod, pino-http, helmet, cors, express-rate-limit, Supertest), each approved when introduced.
  - Discipline is the risk: without a framework enforcing structure, code review must catch drift.

### ADR-002 — Frontend: React + Vite + TypeScript single-page app
- **Status:** Accepted (2026-10-25). Chosen by the product owner.
- **Context:** The ForgeOps dashboard is used only after login and needs no SEO or public landing pages.
  The backend is already an Express API (ADR-003).
- **Options considered:**
  - **React + Vite SPA:** the browser loads static files and calls the Express API. One backend, a clear
    API boundary, static hosting. Routing and data fetching are chosen and wired by us.
  - **Next.js:** React framework with built-in routing and server rendering. Popular, but it runs its own
    Node server next to Express (two backends), and server rendering adds little for a logged-in dashboard.
- **Decision:** React + Vite + TypeScript, built as static files that talk to the Express API over HTTP/JSON.
- **Consequences:** Simple to deploy (any static host or a small container). Auth uses the API's mechanism
  (ADR-007), with CORS and cookie settings configured deliberately. The router and data-fetching libraries
  are chosen in Phase 1.2 tickets. Note: Next.js remains a supported **user** application type for
  automatic builds (PD-004). That is unrelated to ForgeOps' own frontend.

### ADR-004 — Primary database: PostgreSQL
- **Status:** Accepted (2026-10-25)
- **Context:** ForgeOps needs a durable source of truth for users, organizations, services and deployment
  state, with transactions (outbox, ADR-006) and unique constraints (idempotency).
- **Decision:** PostgreSQL: Docker locally, a managed service (e.g. RDS) in the cloud via `DATABASE_URL`.
- **Consequences:** Strong transactional guarantees and constraints we rely on for correctness. One more
  stateful service to back up and operate (Phase 11.4).

### ADR-005 — Data access and migrations: Prisma
- **Status:** Accepted (2026-10-25). Chosen by the product owner.
- **Options considered:** Prisma (schema file, generated type-safe client, built-in migrations); Drizzle
  (SQL-like TypeScript queries, lighter, closer to raw SQL).
- **Decision:** Prisma for schema definition, migrations and queries, used by both `apps/api` and `apps/worker`.
- **Consequences:**
  - One `schema.prisma` is the single definition of the database; migrations are versioned in Git.
  - Prisma calls stay inside each module's **repository** layer (ADR-003 layering); controllers and services
    never import the Prisma client directly.
  - The outbox (ADR-006) relies on Prisma transactions (`$transaction`) to write the deployment and its
    outbox row atomically.
  - Raw SQL is allowed where Prisma can't express something cleanly (e.g. row locking for job claiming),
    kept inside repositories.
  - Set up in ticket 1.4.3: Prisma 7.10.1 (CLI pinned; `latest` briefly resolved to an 8.0 release candidate),
    `prisma-client` generator writing to `src/generated/prisma` (git-ignored, regenerated on install),
    the `@prisma/adapter-pg` driver with a 2 s connection timeout, and `.env` loaded with Node's built-in
    `process.loadEnvFile` instead of the `dotenv` package. Prisma's install scripts are denied; the CLI works without them.

### ADR-023 — Repository layout: pnpm monorepo
- **Status:** Accepted (2026-10-25). Chosen by the product owner.
- **Decision:** One Git repository with pnpm workspaces:
  ```
  forgeops/
  ├─ apps/frontend/  React + Vite frontend
  ├─ apps/api/       Express modular monolith (src/modules/<feature>/)
  ├─ apps/worker/    deployment worker
  └─ packages/shared/  shared types and the Prisma client
  ```
- **Consequences:** Types and the Prisma schema are shared without publishing packages, and one PR can
  change API, worker and UI together. Module boundaries inside `apps/api` still have to be enforced by
  review and lint rules. Whether the Prisma schema gets its own `packages/db` package instead of living in
  `packages/shared` is decided in ticket 1.4.3. A build orchestrator (e.g. Turborepo) is not adopted unless
  justified later.
- **Update (2026-10-25, ticket 1.1.4):** the frontend folder is `apps/frontend` (renamed from `apps/web` at the
  product owner's request).
- **Update (2026-10-25, ticket 1.4.3):** Prisma lives in `apps/api/prisma` for now; it moves to a shared
  package when the worker needs database access.

### ADR-024 — Code-quality toolchain
- **Status:** Accepted (2026-10-25), approved by the product owner in ticket 1.1.3.
- **Decision:** TypeScript 6.0.x with a shared strict `tsconfig.base.json` that each app extends; ESLint
  (flat config) with `typescript-eslint` recommended rules; Prettier for formatting, with
  `eslint-config-prettier` so the two never disagree. Markdown docs are excluded from Prettier.
- **Why TypeScript 6.0, not 7:** TypeScript 7 (the new native compiler) is the latest release, but
  `typescript-eslint` 8.72 only supports TypeScript `<6.1`. Revisit when typescript-eslint supports 7.
- **Not yet:** type-aware lint rules (need per-app tsconfigs; add once apps exist) and pre-commit hooks (ticket 1.1.7).

### ADR-007 — Authentication: server-side sessions, not JWT
- **Status:** Accepted (2026-10-25). Approved by the product owner.
- **Context:** M1 needs real sign-up, login and logout (PD-010) for one browser app talking to one API with
  its own PostgreSQL database. ForgeOps can trigger deployments, so being able to cut off access instantly matters.
- **Options considered:**
  | | Server-side sessions | JWT (stateless tokens) |
  | --- | --- | --- |
  | Browser holds | Random opaque ID in a cookie | Signed token containing user data |
  | Logout / revoke | Delete the row: immediate | Valid until expiry unless you add a blocklist (a session table again) |
  | Per-request cost | One indexed DB lookup | Signature check only |
  | Fits | One app + one API + one DB | Many services verifying identity without a shared store |
  | Main risks | Session store availability | Token theft can't be revoked; key management; storing tokens in JS-readable storage |
- **Decision:** Server-side sessions stored in PostgreSQL.
  - **Token:** 32 random bytes (`crypto.randomBytes`), sent to the browser in a cookie. The database stores only
    its **SHA-256 hash**, so a leaked database can't be used to log in as anyone.
  - **Cookie:** `forgeops_session`, `HttpOnly` (JavaScript can't read it), `SameSite=Lax`, `Secure` in
    production, `Path=/`.
  - **Lifetime:** 7 days from login, fixed (not sliding). Logout deletes the row.
  - **Storage:** a `sessions` table in PostgreSQL, not Redis: no new infrastructure, and revocation is a `DELETE`.
  - **CSRF:** `SameSite=Lax` stops browsers from sending the cookie on cross-site POSTs, and state-changing
    endpoints only accept `application/json`, which cross-site forms can't send without a CORS preflight.
- **Consequences:** Every authenticated request does one DB lookup (fine at our scale; cacheable later).
  Sessions survive API restarts. A future mobile client or third-party API access would need tokens, which
  would be a new decision.
- **Deferred:** rate limiting on login and sign-up (ticket 2.2.9), "log out everywhere", sliding expiry.

### ADR-026 — Password hashing: Node's built-in scrypt
- **Status:** Accepted (2026-10-25)
- **Options considered:**
  - **argon2 (package):** OWASP's first choice, but a native add-on with install scripts. pnpm blocks those
    by default (ISS-005), and it adds a compiled dependency.
  - **bcrypt (package):** widely used, but also native, and truncates passwords at 72 bytes.
  - **scrypt (Node built-in `crypto.scrypt`):** OWASP-recommended memory-hard algorithm, zero dependencies.
- **Decision:** scrypt with OWASP's parameters N = 2^14, r = 8, p = 5, a random 16-byte salt per password,
  stored as `scrypt$N$r$p$salt$hash` so parameters can be raised later. Comparison uses `timingSafeEqual`.
- **Why these parameters:** OWASP lists several equally strong settings. N = 2^17, p = 1 needs 128 MiB of
  memory per hash, so a few simultaneous logins could exhaust a small server (a denial-of-service risk).
  N = 2^14, p = 5 uses 16 MiB and makes up the difference with CPU work.
- **Consequences:** No native dependencies and no install scripts. Each hash takes a noticeable fraction of a
  second by design, which slows brute-force attempts and also means sign-up and login are not instant.

### ADR-027 — API route prefix
- **Status:** Accepted (2026-10-25)
- **Decision:** Product endpoints live under `/api/...` (e.g. `/api/auth/login`, `/api/me`). Health checks stay
  at `/health/...` because infrastructure probes call them, not the product UI.
- **Why:** One prefix gives one Vite proxy rule in development and one routing rule behind a load balancer later.
- **Not yet:** a version prefix like `/api/v1`. Only our own frontend calls the API, so versioning would add
  ceremony with no consumer to protect. Revisit before any external client exists (ticket 1.3.8).

### ADR-028 — Error response format
- **Status:** Accepted (2026-10-25)
- **Decision:** Every error is JSON: `{ "error": { "code": "INVALID_CREDENTIALS", "message": "..." } }` with the
  matching HTTP status (400 validation, 401 not logged in or wrong credentials, 409 conflict, 404, 500).
  Unexpected errors return a generic 500 and are logged on the server; stack traces never reach the client.
- **Why:** The frontend can branch on a stable `code` instead of parsing English, and nothing internal leaks.
- **Update (2026-10-27):** `message` is plain sentences written for people ("Password must be at least 12
  characters"), not a library's formatted output. Zod's formatter added symbols like `✖` and `→`, which the
  frontend would show as-is and which break the no-emoji rule (ISS-022).

### ADR-029 — Identity data model
- **Status:** Accepted (2026-10-26)
- **Tables:** `User` (email, password hash) · `Organization` (name) · `Membership` (user + organization + role)
  · `Session` (token hash, user, expiry).
- **Choices and trade-offs:**
  - **Role lives on `Membership`, not `User`:** a person can own one organization and later be a viewer in
    another (PD-008). The `Role` enum has only `owner` today; V1.5 adds values, not tables.
  - **Composite primary key `(userId, organizationId)`** on `Membership`: the database itself prevents
    duplicate memberships. An index on `organizationId` serves "who is in this org?" lookups.
  - **UUIDv7 ids** (`uuid(7)`): not guessable like 1, 2, 3, and time-ordered so inserts stay index-friendly,
    unlike random UUIDv4. Trade-off: 16 bytes instead of 4–8 for an integer.
  - **Emails stored trimmed and lowercased**, enforced in the API before saving, with a unique index.
    Alternative: PostgreSQL `citext`, which needs an extension and is less portable.
  - **`Session` keyed by the SHA-256 of the token:** lookups need no extra index, and the raw token never
    touches the database (ADR-007).
  - **`ON DELETE CASCADE`** from users and organizations to memberships and sessions: deleting a user can't
    leave orphan sessions that still grant access.
  - **Prisma's default naming** (`"User"`, `passwordHash`) instead of mapping to snake_case. Fewer lines;
    the cost is double-quoting identifiers in hand-written SQL. Cheap to change now, expensive later.
- **Sign-up creates user, personal organization and owner membership in one nested write**, which Prisma
  runs as a single transaction, so a half-created account can't exist.

### ADR-030 — Integration tests against a real PostgreSQL database
- **Status:** Accepted (2026-10-26)
- **Options considered:** mocking Prisma (fast, but can't catch unique-constraint, transaction or SQL
  mistakes); SQLite in memory (different database, different behaviour); a real PostgreSQL test database.
- **Decision:** Tests that touch data run against `forgeops_test` in the same Docker container, set by
  `TEST_DATABASE_URL`. Vitest applies migrations once before the run (`prisma migrate deploy`), each test file
  empties the tables first, and test files run one at a time so they never share rows.
- **Consequences:** Tests need Docker running locally, and CI will need a PostgreSQL service (ticket 7.2.5).
  In exchange, the database's real constraints are part of what's tested.
- **Update (2026-10-26):** API tests allow 30 s per test instead of Vitest's default 5 s. Tests use the real
  scrypt settings (ADR-026), which take 0.6–0.8 s per hash on a busy laptop, and one login test hashes about
  five times. Weakening the settings in tests was rejected because then the tests wouldn't test what ships (ISS-019).

### ADR-031 — No health status in the dashboard
- **Status:** Accepted (2026-10-26). Product owner decision.
- **Decision:** The dashboard doesn't show API or database health; the status page code and its tests were
  removed. The API keeps `/health/live` and `/health/ready`, because Docker and Kubernetes use them to decide
  when to restart the API and when to send it traffic (Phase 9).
- **Trade-off:** One less screen to maintain; a developer checks health with `curl` or the logs instead.

### ADR-032 — Allow unused parameters prefixed with `_`
- **Status:** Accepted (2026-10-26)
- **Context:** Express recognises an error handler only by its four parameters `(error, req, res, next)`, so
  `next` must be declared even when unused, which the default lint rule rejects.
- **Decision:** `@typescript-eslint/no-unused-vars` ignores parameters starting with `_` (`_req`, `_next`).
- **Alternative:** a per-line lint-disable, rejected because the project avoids comments in code.

### ADR-033 — Frontend structure: feature folders, no extra libraries yet
- **Status:** Accepted (2026-10-27). Folder layout requested by the product owner.
- **Decision:** Frontend code is grouped by feature, mirroring the API's modules: `src/auth/` holds the form
  (`AuthForm.tsx`). API calls, hooks, stores and types live in shared folders (ADR-034, ADR-035). `App.tsx` shows the form when `/api/me` returns
  401 and the account view otherwise.
- **Not added (yet), and why:**
  - **Router** (React Router / TanStack Router): there is one screen. Add it with the second page (projects).
  - **Form library** (React Hook Form): two fields; the browser's `required` / `minLength` plus the API's
    messages are enough.
  - **Data-fetching library** (TanStack Query): one request on load; `useRequest` (ADR-034) covers loading and
    errors. Revisit when pages need caching or polling (deployment progress, ticket 5.6.5).
  - **Component tests** (Testing Library + jsdom): the API layer is unit-tested and the screens were checked in
    a real browser. Add component tests when screens get logic worth testing.
- **Security:** the session cookie is `HttpOnly`, so the frontend never sees or stores a token; the browser
  sends it automatically to the same origin.

### ADR-034 — Frontend API layer: one axios instance, one `useRequest` hook, one types folder
- **Status:** Accepted (2026-10-28). Requested by the product owner.
- **Decision:**
  - `src/api/index.ts`: one axios instance (`baseURL: "/api"`, 15 s timeout, fetch adapter) and an `api`
    object with every call (`signup`, `login`, `logout`, `getMe`). An interceptor turns any error into the
    API's plain message (ADR-028), so screens never parse responses.
  - `src/hooks/useRequest.ts`: `useRequest(api.login, { onSuccess })` returns `{ send, isLoading, error }`
    for every form and button that changes data.
  - `src/types/index.ts`: `User`, `Organization`, `Me`, `Credentials`.
- **Options considered:** plain `fetch` (no dependency, but base URL, JSON and error handling repeated per
  call); axios (one place to configure, interceptors, timeouts; about 13 KB gzipped); TanStack Query's
  `useMutation` (more features, but a bigger library and a name the owner found unclear).
- **Consequences:** Changing the base URL, timeout or error handling is a one-line edit. The single API file is
  split per feature if it grows past about 150 lines. Types are frontend-only for now; the long-term home is
  `packages/shared`, so the API and frontend use the same definitions.

### ADR-035 — Shared frontend state with Zustand
- **Status:** Accepted (2026-10-28). Requested by the product owner.
- **Decision:** `src/stores/session.ts` (`useSession`) holds who is logged in, plus `load` and `clear`.
  State owned by one component (e.g. log in vs sign up mode in `AuthForm`) stays in `useState`.
- **Options considered:** React Context (built in, but re-renders every consumer on any change and needs a
  provider); Redux Toolkit (powerful, heavy for this size); Zustand (about 1 KB, no provider, subscribe to
  just the field you need).
- **Rule:** if only one component needs it, `useState`; if several screens need it, a store.
- **Update (2026-10-28):** the session is a named-state union instead of `Me | null | undefined`:
  `{ status: "loading" } | { status: "guest" } | { status: "signed-in"; me: Me }`. Each state has a name,
  and TypeScript only allows reading `me` after checking `status === "signed-in"`. The store's type lives in
  `src/types/`.

### ADR-036 — Styling with Tailwind CSS
- **Status:** Accepted (2026-10-28). Requested by the product owner.
- **Decision:** Tailwind CSS 4 via `@tailwindcss/vite`, one `@import "tailwindcss"` in `src/index.css`. Repeated
  class lists are kept in a local constant (e.g. `input` in `AuthForm`).
- **Update (2026-10-28):** the product owner chose **shadcn/ui**: Radix base, Nova preset, Geist font, Lucide
  icons. Components are copied into `src/components/ui/` (we own and can edit them), `@/` imports point to
  `src/`. Considered daisyUI (fewer files, more generic look) and plain Tailwind (fine for two screens).
  shadcn wins for the dashboard ahead: accessible dialogs, tables and dropdowns. Cost: about 7 new packages
  and roughly +17 KB gzipped JavaScript and a self-hosted font.

### ADR-037 — Reference app: `forgeops-sample-api`
- **Status:** Accepted (2026-10-28). Repo name and private visibility approved by the product owner.
- **Decision:** A separate private GitHub repo plays the customer's app (PD-007). The API lives in `api/` so a
  frontend, worker and scheduled job can be added beside it later (PD-001 single-repo case).
- **Choices:**
  - **Separate repo, not a folder in ForgeOps:** ForgeOps must connect to a GitHub repo like a real customer's.
    Deploying ForgeOps with itself would mean a broken release takes down the tool that does the rollback.
  - **Private:** proves ForgeOps handles the real case (GitHub App access, ADR-008); no extra work because
    the GitHub connection is built before builds in M1 (slice S3 before S5).
  - **npm instead of pnpm:** looks like a typical customer app and keeps its Dockerfile plain (`npm ci`).
  - **Port 8080, `PORT` overridable:** the common container default.
  - **`FAIL_READINESS=true`:** keeps the process alive but makes `/health/ready` return 503, the deliberately
    unhealthy release for M1 criterion 14. **`APP_VERSION`** shows which release is serving, to see rollback.
  - **Multi-stage Dockerfile on `node:24-alpine`**, production dependencies only, non-root `node` user,
    graceful `SIGTERM` shutdown (stops in about 1 s). Image size 177 MB.

### ADR-008 — Repository integration: a least-privilege GitHub App
- **Status:** Accepted (2026-10-31). Created by the product owner in their GitHub account.
- **Options considered:** OAuth App (acts as the user, broad scopes like `repo` that grant write access to every
  repo the user can see); personal access tokens (tied to one person, manual rotation); **GitHub App**
  (fine-grained permissions, installed per repository, short-lived tokens, revocable by the user).
- **Settings:** Contents **read-only**, Metadata read-only, nothing else; installable **only on this account**;
  installed on `forgeops-sample-api` only; webhooks **off** until auto-deploy (Phase 4.3) because GitHub
  can't reach `localhost`; OAuth during installation **on** (ADR-039).
- **Secrets:** App private key at `~/.forgeops/github-app.pem` and client secret at
  `~/.forgeops/github-client-secret`, both outside the repo with `600` permissions. `.env` holds only their
  paths (ADR-016). The first private key was exposed in a chat and rotated before use (ISS-026).

### ADR-038 — GitHub API client: plain `fetch` + Node `crypto`
- **Status:** Accepted (2026-10-31)
- **Options considered:** Octokit (`@octokit/app`: handles JWTs, token caching, pagination, retries; several
  packages); plain `fetch` with a hand-signed RS256 JWT (about 15 lines with `crypto.sign`).
- **Decision:** `fetch` + `crypto`. ForgeOps needs four GitHub calls today, and signing the JWT ourselves keeps
  the authentication flow visible and testable (a unit test verifies the signature with a generated key).
- **Revisit when:** we need pagination beyond 100 repositories, rate-limit handling or token caching. Then
  Octokit earns its weight.

### ADR-039 — Verifying that a GitHub installation belongs to the user
- **Status:** Accepted (2026-10-31). Product owner chose the secure option.
- **Problem:** GitHub's redirect carries `installation_id` in the URL. Anyone can type someone else's id; trusting
  it would let one ForgeOps user attach another person's installation and read their private code.
- **Options considered:** trust the id when the user is logged in to ForgeOps (zero setup, exploitable as soon as
  there is a second user); **verify with GitHub** (the GitHub-documented approach).
- **Decision:**
  1. `GET /api/github/install` sets a random `state` in a 10-minute `HttpOnly` cookie scoped to `/api/github`,
     together with the organization id, and redirects to the App's install page with that `state`.
  2. GitHub returns to `/api/github/callback` with `code`, `installation_id` and `state`. The callback rejects a
     `state` that doesn't match the cookie (stops forged or replayed callbacks).
  3. It exchanges `code` for a user token and calls `GET /user/installations`; the installation is accepted only if
     it is in that list **and** belongs to our App id. The user token is used once and never stored.
  4. An installation already linked to another organization is refused.
- **Consequences:** the GitHub App needs a client ID and client secret. Callback errors redirect to the dashboard
  with a code (`?github_error=INSTALLATION_NOT_YOURS`) instead of showing a raw JSON page.

### ADR-040 — Service environment variables are encrypted at rest
- **Status:** Accepted (2026-10-31). Product owner accepted the recommended option.
- **Problem:** env vars often hold secrets (database passwords, API keys). Stored as plain text, anyone who sees
  the database, a backup or a careless log line sees every customer's secrets.
- **Options considered:** (a) encrypt every value; (b) store plain text and forbid secrets in M1; (c) leave env vars
  out until the full secrets design (3.5).
- **Decision:** (a). The whole env map of a service is JSON-encoded and encrypted with AES-256-GCM using Node's
  `crypto` (no new dependency). Stored as `iv.authTag.ciphertext` (base64) in `Service.envVars`, so even the names
  are hidden in the database. The 32-byte key lives in `~/.forgeops/env-encryption.key` (mode 600), its path in
  `ENCRYPTION_KEY_PATH`; the API refuses to start without it. The API returns `envVarNames` only, never values.
  `PATCH` merges: a string sets a value, `null` removes it, since clients can never read values back.
- **Trade-offs:** GCM detects tampering and a wrong key. No key rotation yet (would need a key id prefix and a
  re-encrypt job). The ciphertext isn't bound to its service row, so swapping two rows' blobs would go unnoticed;
  acceptable while only the API writes the table. Losing the key file loses every stored value.
- **Consequences:** AWS Secrets Manager or KMS can replace the key file in the cloud (ADR-016) without changing
  the storage format. The worker will decrypt values only when starting a container (M1-S6).

### ADR-041 — Projects and services model, checked against GitHub on save
- **Status:** Accepted (2026-10-31).
- **Decision:**
  - `Project`: name is a lowercase slug, unique per organization. `Service`: slug name unique per project,
    `type` enum (`web` only), `buildMethod` enum (`dockerfile` only), `repositoryId` (GitHub's stable id) plus
    `repositoryFullName`, `branch`, `sourceDirectory` (normalised, no `..`), `port` (1–65535, always explicit).
  - No `RepositoryConnection` table or environments table yet: one installation per organization and one
    environment in M1. Added when multi-repository projects or environments need them.
  - Before saving, ForgeOps asks GitHub: `GET /repos/{repo}/installation` (App JWT) must return **this
    organization's** installation, then the branch and `{folder}/Dockerfile` must exist on that branch.
  - Worker types and automatic builds are refused with plain messages until their decisions land (PD-003, ADR-017).
- **Trade-offs:** each save costs four GitHub calls, and checks can go stale (a Dockerfile deleted later), so the
  build step must check again. Slug names keep future URLs and container names safe.

### ADR-042 — GitHub OAuth settings are optional
- **Status:** Accepted (2026-10-31). Product owner deferred the OAuth step.
- **Decision:** the GitHub App settings (`GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY_PATH`) and the
  OAuth pair (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET_PATH`) are each all-or-nothing; OAuth needs the App settings.
  Without OAuth, the install callback answers `GITHUB_OAUTH_NOT_CONFIGURED`; everything else works.
- **Consequences:** while only the owner uses ForgeOps, the installation is linked by hand in the local database.
  OAuth must be configured before anyone else signs up (tracked in `CURRENT.md`).

### ADR-006 — Message queue: RabbitMQ locally, AWS SQS in the cloud
- **Status:** Accepted (2026-10-24)
- **Context:** Deployment requests must be processed asynchronously and survive crashes. The project runs
  locally first (free) and moves to AWS in Phase 8.
- **Options considered:** pg-boss (Postgres-backed, simplest, no outbox needed); BullMQ + Redis; RabbitMQ;
  AWS SQS.
- **Decision:** RabbitMQ in local development and Docker Compose; AWS SQS in the AWS environment. The
  application depends only on a `JobPublisher` / `JobConsumer` interface. An adapter per provider is
  chosen at startup by `QUEUE_PROVIDER=rabbitmq|sqs`.
- **Rules that keep providers swappable:**
  1. PostgreSQL is the source of truth. Messages carry only IDs (e.g. `{ type, deploymentId }`), never state.
  2. Only use features both providers have: at-least-once delivery, ack/delete on success, redelivery on
     failure, a dead-letter queue after N attempts. No RabbitMQ routing tricks, no SQS FIFO-only features.
  3. Workers are idempotent: a duplicate message must not cause a duplicate deployment.
  4. Publishing goes through a transactional outbox, so a DB write and a publish cannot drift apart.
  5. One shared contract test suite runs against every adapter (RabbitMQ in Docker, SQS via LocalStack)
     plus an in-memory adapter for unit tests.
- **Consequences:** Two adapters to build and test, and local and cloud are not byte-identical, so the
  contract tests are what stop them drifting. In return there is no AWS dependency before Phase 8, and a
  real-world provider migration story.

### ADR-043 — Deployment model and duplicate protection
- **Status:** Accepted (2026-11-01). Product owner chose "both protections" and a required key.
- **Problem:** a click on Deploy must create exactly one deployment, even when the request is retried after a lost
  response, sent twice by a double click, or sent while another deployment of the same service is still running.
- **Options considered:** (a) Idempotency-Key only; (b) one-active-deployment rule only; (c) both. For the key:
  required, or optional with no protection when missing.
- **Decision:** (c), with the key required. Tables: `Deployment` (status `queued | running | succeeded | failed`,
  `trigger` = `manual`, `triggeredById`, `idempotencyKey`, `commitSha`, `error`, timestamps), `DeploymentStep`
  (one row per worker step, unique per deployment and name) and `Outbox` (see ADR-046).
  - `@@unique([serviceId, idempotencyKey])`: the same key for the same service returns the existing deployment (202).
  - `activeServiceId` is set to the service id while a deployment is active and cleared when it finishes. It is
    `@unique`, so PostgreSQL itself refuses a second active deployment; the API answers 409
    `DEPLOYMENT_IN_PROGRESS` naming the active deployment.
  - A missing or malformed `Idempotency-Key` header is 400 (1–255 letters, digits, `-`, `.`, `:` or `_`).
  - The key is checked before the lock, so a retry of the click that started the running deployment gets 202, not 409.
  - Races are settled by the unique indexes: on a unique violation the API looks the key up again and returns that
    deployment, otherwise 409. No need to parse which constraint failed.
- **Trade-offs:** clients must send a key (our frontend always will). The lock column is simpler than a partial
  unique index, which Prisma cannot express. Keys are kept forever for now; expiring old keys is not needed yet.
- **Consequences:** `POST /api/services/:id/deployments` answers 202 with the deployment; `GET
  /api/services/:id/deployments` lists the latest 50 (pagination is 5.3.9); `GET /api/deployments/:id` includes the
  steps. All three are organization-scoped (404 for other organizations).

### ADR-044 — The worker lives in `apps/api` as a separate process
- **Status:** Accepted (2026-11-01). Product owner asked for the best option; this was the recommendation.
- **Options considered:** (a) a new `apps/worker` package; (b) a second entry point in `apps/api`; (c) run the
  worker inside the API process.
- **Decision:** (b). `src/worker.ts` starts the outbox relay and the queue consumer; `pnpm --filter @forgeops/api
  worker` runs it in development, `start:worker` after a build. It reuses the API's modules, Prisma client, config
  and GitHub client (`loadGitHubClient`, now shared with `server.ts`).
- **Trade-offs:** no duplicated config, schema or repositories, and ADR-001's "monolith + separate worker" holds
  because they still run as separate processes that scale and crash independently. The worker image will carry
  Express code it never uses, which is harmless. (c) would let a slow build starve HTTP requests.
- **Consequences:** if the worker grows heavy dependencies (Docker client, build tools), it can move to its own
  package later without changing its code.

### ADR-045 — RabbitMQ client and queue setup
- **Status:** Accepted (2026-11-01). Product owner chose amqplib.
- **Options considered:** `amqplib` (the standard low-level client), `rabbitmq-client` (built-in reconnects),
  `amqp-connection-manager` (a reconnect wrapper over amqplib).
- **Decision:** `amqplib` 0.10, wrapped in `src/queue.ts` (`connectQueue(url, queue)` returning `publish`, `consume`
  and `close`).
  - RabbitMQ 4 (`rabbitmq:4-management`) in Docker Compose on `127.0.0.1:5673`, management UI on `15673` (5672 and
    15672 are left for another local project). Local credentials `forgeops`/`forgeops`, local only.
  - `deployments` is a durable **quorum** queue (the RabbitMQ 4 default for durable data) with
    `x-delivery-limit: 5` and a dead-letter queue `deployments.dead`.
  - Publishing uses a **confirm channel**: `publish` resolves only after RabbitMQ has stored the message.
  - Consuming: `prefetch 1`; ack only after the handler returns; any thrown error is logged and the message is
    requeued, so after 5 deliveries it moves to the dead-letter queue instead of looping forever.
  - On a lost connection the worker exits with code 1 instead of reconnecting; whatever runs it restarts it and
    RabbitMQ redelivers unacked messages. SIGINT/SIGTERM stop the relay, close the connection and exit 0.
  - `RABBITMQ_URL` is optional in config (the API does not need it); the worker refuses to start without it, or
    without the GitHub App settings.
- **Trade-offs:** exit-and-restart is less code than reconnect logic and leaves no half-broken channel. ADR-006's
  `JobPublisher`/`JobConsumer` split and `QUEUE_PROVIDER` switch are not built yet: `connectQueue`'s small surface
  is that interface in practice, and the SQS adapter and shared contract tests come with Phase 8.
- **Consequences:** tests use the real RabbitMQ with a throwaway queue per test.

### ADR-046 — M1-S4 worker behaviour: outbox relay, claim, resolve commit, retries
- **Status:** Accepted (2026-11-01). Product owner chose "resolve commit" as the S4 step and asked for retries.
- **Outbox relay:** runs inside the worker every second. In one transaction it selects up to 50 unsent rows
  `FOR UPDATE SKIP LOCKED`, publishes each `{ type, deploymentId }` with confirms, then sets `sentAt`. If publishing
  fails, the transaction rolls back and the rows are retried next tick. If marking fails after publishing, the
  message is sent twice, which the idempotent worker absorbs. `SKIP LOCKED` keeps overlapping ticks or several
  workers from sending the same row at once.
- **Claim:** `UPDATE ... WHERE status IN ('queued', 'running')` sets `running`. Zero rows means the deployment is
  finished or does not exist, so the duplicate is skipped and acked. `running` is accepted so a deployment left
  half-done by a crashed worker is resumed.
- **Step `resolve-commit`:** reads the service's branch through the GitHub App installation token (new
  `branchCommit`) and stores the full commit SHA, so the deployment always means that exact code.
  - 404 (branch gone) is permanent: `failed` with "Branch X not found in Y".
  - Any other GitHub error is treated as transient: retried 3 times after 1 s, 2 s and 4 s, then `failed` with
    "GitHub did not respond. Try deploying again."
  - No GitHub installation for the organization: `failed`, "GitHub is not connected".
  - Finishing writes the step and the deployment in one transaction and clears `activeServiceId`. A failed
    deployment is still a finished job, so its message is acked.
- **Trade-offs and known limits:**
  - Resuming `running` is only safe with one worker; with several, two could work on the same deployment.
    Revisit with a lease (worker id + heartbeat) before running more than one worker.
  - If the handler keeps failing on something unexpected (for example the database is down) the message ends in
    `deployments.dead` and the deployment stays `running` with its lock held. A timeout / stale-deployment sweeper
    (5.5.7) fixes that; tracked in `CURRENT.md`.
  - The worker does not re-check that the installation still covers the repository; S5 will, before downloading
    code.
- **Consequences:** later slices add steps (`fetch-source`, `build`, `run`, ...) to the same handler, each with
  its own `DeploymentStep` row.

### ADR-047 — Small shared helpers moved for reuse
- **Status:** Accepted (2026-11-01).
- **Decision:** `isId` (UUID check) moves from the projects router to `http-error.ts`, because the deployments
  router needs it too. `loadGitHubClient(config.github)` reads the private key and optional client secret, shared
  by the API and the worker. A `Config` type is exported from `config.ts`.
- **Trade-offs:** none worth noting; it removes duplication instead of adding structure.

### ADR-048 — Build execution for M1: local Docker Engine with BuildKit
- **Status:** Accepted (2026-11-03). I recommended this, the alternatives below and the two decisions that follow
  (ADR-049, ADR-050); the product owner then said "write the code for all, till the part when we push to registry",
  which I took as approval of all three.
- **Context:** S5 must turn a commit into an image. Something has to run the Dockerfile (the builder), on some
  machine (the build environment). ADR-009 proposed CI-hosted builds for later; M1 needs the simplest thing that is
  free and runs on the owner's Mac.
- **Options considered:**
  - Docker Engine with BuildKit on the worker's machine (OrbStack locally): free, already installed, the same
    builder most platforms use. The worker effectively gets Docker's root-level access.
  - Rootless builders (Kaniko, Buildah, rootless BuildKit): safer for untrusted code, more setup.
  - Managed build services (AWS CodeBuild, Google Cloud Build): isolated machine per build, scales, but paid and a
    new cloud account (needs approval).
  - How the worker talks to the builder: the `docker` CLI as a child process, the Docker Engine API (`dockerode`),
    or `buildctl` straight to BuildKit.
- **Decision:** the worker runs `docker build --progress=plain -t <tag> <context>` and `docker push <tag>` as child
  processes (Node `child_process.spawn`, no new dependency). BuildKit is Docker's default builder, so no extra setup.
- **Trade-offs:** the CLI's output is the build log the user sees, exactly as in a terminal, and it needs no
  library. Parsing the digest from `docker push` output is a little brittle (a test guards it). The worker host's
  Docker access is close to root, so M1 only builds trusted repositories that the owner installed the GitHub App on
  (ROADMAP 6.5.7); before anyone else's code is built, move to rootless BuildKit or a managed builder.
- **Consequences:** the worker needs Docker on its machine and refuses to start if `docker version` fails, rather
  than failing every deployment later. Build caching works across deployments for free. After a successful push the
  local tag is removed (`docker image rm`), so tags don't pile up one per deployment; BuildKit's cache is separate
  and survives (checked: the next build still reported `CACHED`).

### ADR-049 — Fetching source code: GitHub tarball, system `tar`, path containment
- **Status:** Accepted (2026-11-03).
- **Options considered:** GitHub's tarball endpoint (one HTTP call, files only, no `git` needed, token never on disk)
  versus `git clone` (submodules and Git LFS, but needs `git`, downloads history unless tuned, and writes the token
  into `.git/config` unless handled carefully). For unpacking: the system `tar` versus the `tar` npm package.
- **Decision:** `GET /repos/{repo}/tarball/{commitSha}` with the installation token (GitHub redirects to a
  short-lived download link), saved to `$TMPDIR/forgeops/<deploymentId>/source.tar.gz`, then
  `tar -xzf … --strip-components=1` into `src/` of that folder.
  - The folder is deleted first and again when the deployment ends, success or failure.
  - System `tar` (bsdtar on macOS, GNU tar on Linux) refuses `..` paths and extracting through symlinks by default.
    Checked by hand with a crafted archive: the `..` entry and the write through a symlink were refused, and nothing
    landed outside the folder.
  - The source directory and its Dockerfile are resolved with `realpath` and must stay inside the unpacked code, so
    a repository cannot point the build context at `/` with a symlink.
  - The installation token only opens repositories the installation covers, so a repository removed from the
    installation fails here with "Commit X not found in Y". This is the S5 re-check ADR-046 promised.
- **Trade-offs:** no submodules or LFS yet; added if a real repository needs them. The download is retried like
  other GitHub calls; a 404 is permanent.
- **Consequences:** the build context is exactly the pinned commit's files, nothing else.

### ADR-050 — Image registry for M1: a local registry container
- **Status:** Accepted (2026-11-03).
- **Options considered:** a local `registry:3` container (free, the same push/pull and digest flow as any real
  registry), GitHub Container Registry (free for public images, small private quota), Docker Hub (limited free tier),
  AWS ECR (paid; natural once ForgeOps runs on AWS). Skipping the registry entirely would work while build and run
  share one machine, but loses the real flow and rollback by digest.
- **Decision:** `registry:3` in `docker-compose.yml` on `127.0.0.1:5001` (port 5000 is taken by macOS AirPlay),
  data in the `registry-data` volume. `REGISTRY_HOST=localhost:5001` configures the worker (required to start it).
  Images are named `<registry>/services/<serviceId>` and tagged with the deployment id. After the push, the deployment
  stores the immutable reference `<registry>/services/<serviceId>@sha256:…` in `Deployment.image`.
- **Trade-offs:** no authentication and plain HTTP, acceptable because it listens on localhost only. Docker allows
  plain HTTP to `localhost` registries without extra configuration.
- **Consequences:** S6 runs and S9 rolls back by digest, never by tag. Moving to ECR changes `REGISTRY_HOST` and adds
  credentials.

### ADR-051 — Build logs, time limits and stale deployments
- **Status:** Accepted (2026-11-03).
- **Logs:** each step's output is kept in a new `DeploymentStep.log` column, at most the last 64 KiB (the end of a
  log is where errors are). Alternatives: a separate log-lines table or object storage, both more than M1 needs;
  S8 (logs and history) can revisit. Service env vars are never passed to the build, so they cannot appear in build
  logs, and the GitHub token only travels in a request header that is never logged.
- **Time limits:** build 15 minutes, push 5 minutes, unpacking 1 minute, and every GitHub request now times out after
  2 minutes (it had no limit). A timed-out command is killed and the step fails with its log. The time-out is
  detected from ForgeOps' own timer, not from the exit code: the Docker CLI catches the stop signal and exits with
  130 (ISS-034).
- **Stale deployments (5.5.7):** the worker checks every minute for deployments `running` for more than 60 minutes
  (well above the worst case of all time limits and retries) and marks them and their running step `failed`
  ("Deployment timed out. Try deploying again."), releasing the lock. The claim resets `startedAt`, so a resumed
  deployment is measured from its latest attempt.
- **Trade-offs and known limits:**
  - If a worker still finishing a deployment after the sweeper failed it, its final write wins. The 60-minute
    margin makes that practically impossible with one worker; a lease (already deferred) removes it.
  - Stopping the worker mid-build leaves the `docker build` child running until it ends; the unacked message is
    redelivered and the deployment resumes on restart.
  - Deployments still `queued` are never swept (a queued deployment just waits for a worker).
- **Consequences:** the steps are now `resolve-commit`, `fetch-source`, `build`, `push`. Only the last step's finish
  writes the deployment's final status; earlier steps complete on their own row. A resumed deployment reuses the
  commit it already pinned instead of resolving the branch again.

### ADR-052 — A separate registry for tests
- **Status:** Accepted (2026-11-03). Product owner approved fixing the self-review findings.
- **Context:** the build tests push real images. After about six test runs the dev registry held 69 test images
  (65 MB, mostly shared layers), mixed in with real deployments, plus 69 local tags.
- **Options considered:** delete test images through the registry API (needs deletes enabled and garbage collection,
  and empty repository names stay in the catalog); write into the registry's storage behind its back (fragile); a
  second registry used only by tests, like the separate `forgeops_test` database.
- **Decision:** `registry-test` in `docker-compose.yml` on `127.0.0.1:5002`, storage on `tmpfs` (memory, emptied when
  the container restarts). Tests read `TEST_REGISTRY_HOST`; the worker keeps using `REGISTRY_HOST`.
- **Trade-offs:** one more small container. Test images still accumulate while it runs, in memory and tiny because
  layers are shared, and a restart clears them.
- **Consequences:** test runs never touch the dev registry. The 69 test images already in the dev registry stay
  until its volume is reset.

### ADR-053 — Local seed script
- **Status:** Accepted (2026-11-03). Deferred until the next local data loss; ISS-035 was that loss and the product
  owner said "do next".
- **Decision:** `apps/api/src/seed.ts`, run with `pnpm --filter @forgeops/api seed`. Safe to run any number of times:
  - creates `demo@forgeops.test` with sign-up's own `createUserWithPersonalOrg` only if it is missing, with a random
    password written to `~/.forgeops/demo-password` (file 600, folder 700) and never printed;
  - links the GitHub installation from `SEED_GITHUB_INSTALLATION_ID` (in the git-ignored `.env`) to that account's
    organization;
  - upserts project `sample-shop` and service `api` for the reference app (ADR-037): `demilade111/forgeops-sample-api`,
    branch `main`, source directory `api`, port 8080, env var `APP_VERSION` encrypted like the API does;
  - asks GitHub through the real `inspectSource` check first, so a wrong installation or a moved Dockerfile fails the
    seed instead of creating a broken service. Refuses to run in production.
- **Options considered:** SQL dump (breaks on every migration, can't encrypt with the local key); calling the HTTP API
  (needs the server running and still can't link an installation without OAuth); a script on the Prisma client.
- **Trade-offs:** like the test helpers, the script uses Prisma directly instead of going through module
  repositories, because it is tooling, not application code. The repository and installation are specific to the
  owner; another developer sets their own installation id.
- **Consequences:** losing the local volume costs one command (`docker compose up -d`, `prisma migrate deploy`,
  `seed`). Service port is now 8080, fixing the earlier hand-made service that used 3000.

### ADR-019 — Managed URLs and traffic routing for M1
- **Status:** Accepted (2026-11-05). The product owner approved the recommendation ("approve it").
- **Context:** M1-S6 must serve each web service at a ForgeOps-managed URL (`curl <managed URL>` returns the API).
  Several services run at once on one machine, each listening on its own port inside its container.
- **Options considered:**
  - URL scheme: `<service>.<project>.localhost` (host-based, no DNS setup: every `*.localhost` name points to this
    machine in browsers and curl); path-based `localhost/<project>/<service>` (breaks apps that use absolute paths);
    one host port per service (`localhost:49213`, nothing to remember, ports leak into the product).
  - Router: **Caddy** with its JSON admin API (routes change at runtime, no reload, single binary, automatic HTTPS
    later); Traefik with Docker labels (routes follow containers automatically, but more config and a Docker socket
    in the proxy); nginx (config file reload per change, templating to write).
- **Decision:** host `<service>.<project>.localhost`, URL `http://<host>`, stored on `Deployment.url`. Caddy 2.10
  runs in `docker-compose.yml` on `127.0.0.1:80`, admin API on `127.0.0.1:2019`. The worker adds one route per
  service (`@id` `svc-<serviceId>`, match the host, `reverse_proxy` to `fo-<deploymentId>:<port>`), replacing it with
  `PATCH /id/...` on redeploy or inserting it before the 404 catch-all on first deploy. A host already routed by
  another service is refused ("... is already used by another service"), because project names are only unique per
  organization. Caddy runs with `--resume`, so routes added through the API survive a Caddy restart.
- **Trade-offs:** the router's state lives in Caddy (autosaved in the `caddy-config` volume), not in PostgreSQL; if
  that volume is lost, each service needs one redeploy. Changing `caddy/caddy.json` needs that volume reset, because
  `--resume` prefers the autosave (ISS-037). No HTTPS yet.
- **Consequences:** the admin API has no authentication: it only listens on localhost on the Mac, but deployed
  containers share the `forgeops-apps` network with Caddy and could reach it. Fine for M1's trusted repos (same
  stance as ADR-048); before running anyone else's code, the admin API must be unreachable from app networks. Two
  organizations can't both use the same project and service name until URLs include something globally unique.

### ADR-054 — Where web services run in M1
- **Status:** Accepted (2026-11-05). The product owner approved Docker on the Mac.
- **Context:** M1-S6 needs a "controlled environment" to run the pushed image. Kubernetes (ADR-010) is proposed, not
  accepted, and is a large step.
- **Options considered:** the host's Docker Engine via the `docker` CLI (already used for builds, free); local
  Kubernetes (kind or k3d: the eventual target, much more setup); a cloud service such as ECS (paid).
- **Decision:** two new steps after `push`:
  - **run:** decrypts the service's env vars into a file readable only by the worker (mode 600, deleted with the
    workspace), then `docker run -d --name fo-<deploymentId> --network forgeops-apps --restart unless-stopped
    --label forgeops.service=<serviceId> --env-file ... <image by digest>`. A rerun removes a container of the same
    name first, so a resumed deployment is safe. Pull and start have a 5-minute limit.
  - **route:** points the Caddy route at the new container, then removes the service's other containers (found by
    label). If routing fails, the new container is removed and the live one keeps serving.
- **Trade-offs:** containers are named by deployment id, not by service and project, so names never clash and stay
  short enough for Docker's DNS. Env file instead of `-e NAME=value` so values never appear in the process list;
  values may not contain line breaks (the API now refuses them), because Docker env files are one variable per line.
  No readiness check yet (M1-S7): a release that crashes on start is routed and returns 502. No CPU or memory limits
  and no connection draining when the old container is removed.
- **Consequences:** the worker refuses to start without `CADDY_ADMIN_URL`, without the `forgeops-apps` network or if
  Caddy is unreachable. Moving to Kubernetes later replaces `startContainer` and `routeTo`, not the step model.

### ADR-055 — Runtime tests
- **Status:** Accepted (2026-11-05).
- **Decision:** tests run real containers on `forgeops-apps` and route them through a second Caddy, `caddy-test`
  (admin `127.0.0.1:2020`, HTTP `127.0.0.1:8081`, no autosave volume; `TEST_CADDY_ADMIN_URL`). Before each test the
  test Caddy is reset to `caddy/caddy.json` and only containers of services in the test database are removed, so the
  developer's own running services are never touched. Requests go through `curl` with a `Host` header.
- **Options considered:** mocking Docker and Caddy (fast, but would not have caught ISS-038); using the dev Caddy
  (tests would delete real routes).
- **Consequences:** the test suite needs `docker compose up -d` and takes about 2 minutes.

### ADR-056 — Frontend routing
- **Status:** Accepted (2026-11-06). Needed once the app had a landing page, login and several dashboard screens.
- **Options considered:** `react-router` (the standard, nested layouts, URL params); TanStack Router (typed routes,
  more setup); a hand-written router on `history.pushState` (no dependency, but code to own and test).
- **Decision:** `react-router` 7 in library mode. `/` landing, `/login`, `/signup`, and `/app` with nested routes for
  projects, a project, adding a service and a service. The landing page renders without the API; only `/login`,
  `/signup` and `/app` wait for the session. GitHub's install callback now returns to `/app` instead of `/`.
- **Consequences:** refreshing any page keeps its place; links are shareable. Supersedes "no router yet" in ADR-033.

### ADR-057 — Visual design
- **Status:** Accepted (2026-11-06). The product owner asked for Vercel's look ("reclone Vercel") with ForgeOps' own
  words and content, after rejecting a lighter first version as plain.
- **Decision:** pure black background, light grey text, white pill buttons; Geist and Geist Mono (open source); the
  landing page sits in a framed column with guide lines and corner marks. Amber, green and red appear only for
  deploy status. The hero shows a real ForgeOps deploy replaying its six actual steps and logs. No Vercel logo, mark,
  wording or artwork.
- **Update (2026-11-06):** the product owner asked for white and grey instead of black. Now a light theme (Vercel's
  light mode): `#fafafa` page, white cards, `#171717` text, `#666` secondary text, `#e6e6e6` borders, black primary
  buttons; status colors darkened to stay readable on white. Only the colour tokens and a few surfaces changed.
  The product owner then asked for a different font: IBM Plex Sans and IBM Plex Mono replaced Geist (open source,
  engineering feel, clearer code text). Later the product owner pointed at featurebase.app: headings now use Geist, body text
  Inter and code Geist Mono, the fonts that site uses (all open source; its paid serif, ABC Arizona Flare, is not
  used). The landing hero follows that site's look: near-black with a steel-blue glow, the second half of the
  headline in grey, a cream pill and a navy pill, and the live deploy window inside. A `.dark` token set scopes the
  dark colours to the hero; the rest of the page and the app stay light. The product owner then shared a reference with a wide, bold
  headline: headings now use Archivo (open source) stretched to 112% width at semibold, and the hero title is
  "Every push becomes a live URL." Finally the product owner asked for render.com's layout "the way it is": the landing page is
  now fully dark with fine grid lines, grainy purple gradients, square white buttons, a project map with a streaming
  deploy terminal, "Click, click, live." numbered steps, a stack band, a gradient headline, four feature blocks and a
  purple call to action. Headings use Inter Tight (Render's Roobert is commercial). ForgeOps wording only, no Render
  logo or brand icons, and planned features (workers, scheduled jobs, auto-deploy on push) are labelled "Coming".
  Then the product owner asked for white and purple and for a "video" of the product: the landing page is now white
  with purple (`#6d4aff`) buttons and accents, lavender gradients, and no announcement bar. A new product tour is a
  coded animation, not a video file: a browser frame loops through log in (typing), projects, the service page,
  Deploy with step timing, and Live with the curl response, with play/pause, clickable progress segments and a moving
  cursor. Being code, it stays in step with the real UI, weighs nothing and respects reduced motion (it starts on the
  final scene, paused). The product owner then asked to remove the tour; it was deleted. The product owner then asked to remove the tour; it was deleted.
- **Trade-offs:** borrowing a well-known look is fast and polished, but less distinctive; the product owner plans to
  refine it later. Mono text is used only for real code (commits, URLs, logs, repositories).

### ADR-058 — Mini frontend data flow
- **Status:** Accepted (2026-11-06). Delivers PD-013's mini frontend (service setup, Deploy, status).
- **Decision:** a small `useLoad(load, deps)` hook for reads (data, error, reload). The service page polls
  `GET /deployments/:id` every 1.5 s while the open deployment is queued or running, then reloads the list. The
  Deploy button keeps one `Idempotency-Key` per attempt in memory and makes a new one only after a 202, so a retry
  after a lost response cannot start a second deploy. The newest succeeded deployment is shown as Live.
- **Options considered:** polling vs server-sent events or WebSockets (live push, but a new endpoint and connection
  handling); a data library such as TanStack Query (caching and refetching, another dependency).
- **Consequences:** simple and enough for one user; S8 (logs) can switch to streaming if polling becomes heavy.

### ADR-086 — CodeQL code scanning in the security workflow (DevOps 7.3, 2026-11-09)
- **Status:** Accepted (2026-11-09). The product owner made the repository public and approved CodeQL.
- **Decision:** a `codeql` job in `security.yml` runs `github/codeql-action` v4 (`init` then `analyze`) for
  `javascript-typescript` with `build-mode: none`, on every push and every Monday. It needs `security-events: write`
  to upload results, given to that job only. Findings appear under the repository's Security tab.
- **Options considered:** GitHub's default setup (a switch in Settings, but the configuration lives outside the
  repository and is not reviewed in pull requests); Semgrep (fast, many rules, another account and app); ESLint
  security plugins (only single-file patterns, no tracking of user input across files).
- **Consequences:** free because the repository is public. It reads source only, so it adds no install or build
  time. The job fails only if the analysis itself fails; findings are reviewed in the Security tab, not by a red X.
  Replaces the "CodeQL not added yet" note in ADR-084.

### ADR-085 — One image push at a time per workflow (DevOps 7.3, 2026-11-09)
- **Status:** Accepted (2026-11-09). The product owner approved the fix after ISS-063.
- **Decision:** the `image` job in `ci-backend.yml` and `ci-frontend.yml` has a job-level `concurrency` group
  (`image-backend`, `image-frontend`) with `cancel-in-progress: false`. Two pushes to `main` close together now
  push their images one after the other instead of at the same moment.
- **Options considered:** no change and rerun by hand (a rerun rebuilds the image and cannot overwrite a tag it
  already pushed, so it never recovers); `cancel-in-progress: true` (the newest commit always wins, but a push could
  be stopped halfway and leave a partial set of images); a workflow-level group (would also queue the tests, which
  are safe to run in parallel).
- **Consequences:** a second push waits for the first one's image job. GitHub keeps only one waiting job per group,
  so with three quick merges the middle commit's image job is cancelled and only the newest is pushed, which is the
  one that matters. A failed push is fixed by the next commit, not by a rerun.

### ADR-084 — Grouped CI workflows, format check and security scans (DevOps 7.3, 2026-11-09)
- **Status:** Accepted (2026-11-09). The product owner asked for all the workflows, grouped.
- **Decision:** GitHub only reads workflows directly inside `.github/workflows/` (subfolders are ignored), so
  workflows are grouped by name prefix: `ci-frontend.yml`, `ci-backend.yml`, `ci-format.yml`, `security.yml`. The
  repeated pnpm + Node setup moved into a local composite action, `.github/actions/setup/action.yml`, used by every
  job that needs Node. New checks:
  - `ci-format.yml`: `prettier --check .` on every push (installs the root only).
  - `security.yml` on every push and every Monday 06:00 UTC: `secrets` runs **gitleaks** over the whole git history
    (`fetch-depth: 0`, findings redacted); `dependencies` runs `pnpm audit --prod --audit-level high`.
  - **Trivy** in both image jobs: every image is scanned after `docker build` and before `docker push`; a HIGH or
    CRITICAL vulnerability that has a fix fails the job, so the image never reaches GHCR. The backend builds and
    scans all three images before pushing any, so GHCR never holds half a set.
  - `.github/dependabot.yml`: weekly update pull requests for npm packages (minor and patch grouped), GitHub
    Actions and the two Dockerfiles' base images, each waiting 7 days after a release (`cooldown`).
- **Choices inside it:** gitleaks and Trivy run from their official images pinned by version and digest, as plain
  `docker run` commands (no third-party wrapper actions that could change under us; Trivy's own action had a
  supply-chain compromise on 19 March 2026: 76 of 77
  `trivy-action` tags were rewritten to steal CI secrets and a malicious Trivy 0.69.4 was published; we run 0.76.1). Trivy uses `--ignore-unfixed`, so a vulnerability with no fix yet does not
  block every build. `pnpm audit` blocks only high and critical; today it reports one low and one moderate issue in
  `deepmerge` under shadcn. The weekly schedule catches vulnerabilities published after the code last changed.
- **Not added yet:** CodeQL (code scanning on a private repository needs paid GitHub Code Security; add it when the
  repository goes public); OWASP ZAP (needs a running server, phase 8); `infra.yml` for Terraform (no Terraform
  code, AWS account, OIDC role or state bucket exist yet, so its values would be invented; it comes with phase 8).
- **Options considered:** subfolders for workflows (not supported by GitHub); one big workflow with every job
  (one red X hides which part failed and every push runs everything); Snyk or SonarQube (outside accounts and
  tokens); the gitleaks and Trivy GitHub actions (shorter, but more code we do not control).
- **First run (2026-11-09):** format, gitleaks (whole history, no secrets) and `pnpm audit` passed; Trivy failed
  both image jobs, as designed, before anything was pushed. Web: 37 HIGH/CRITICAL in the Alpine packages and 68 in
  the Caddy binary of `caddy:2.10`, fixed by moving to `caddy:2.11` (also in `docker-compose.yml`, one version
  everywhere). API: 24, all in npm (bundled with the Node image) and the global pnpm, none in our dependencies or
  the OS. The app runs with `node` alone, so the runtime images now delete npm, pnpm, corepack and yarn after
  installing, and `migrate` runs `node_modules/.bin/prisma migrate deploy` instead of `pnpm exec`. Fewer tools in
  the image also means fewer tools an attacker can use inside it.
- **Second run (2026-11-09):** the API image was clean. `caddy:2.11` left one HIGH, CVE-2026-78661 in
  `golang.org/x/net` inside the Caddy binary, fixed upstream but in no Caddy release yet. It is accepted in
  `.trivyignore.yaml` for that file only, with the reason and an expiry date (2026-12-09), after which the scan
  fails again; the web Caddy never parses untrusted HTML. Caddy 2.11 also changed behaviour: since 2.11.1
  (CVE-2026-27589, a cross-site request forgery fix) the admin API rejects calls without an `Origin` header, so
  every admin call from the worker and the tests now sends the admin address as `Origin`. Dependabot no longer
  proposes major versions of the `node` image (only even, long-term-support versions are used) or of `@types/node`
  (it must match the Node version).
- **Consequences:** a push now starts up to five workflow runs. A new CVE in a base image can turn a previously
  green image job red with no code change; the fix is a base image update (Dependabot opens it).

### ADR-083 — Every API module split into layer folders with controllers (2026-11-09)
- **Status:** Accepted (2026-11-09). The product owner asked for routes, controllers, services and repositories as
  folders in every module. Replaces the "no controller files" and "services only where there are rules" choices of
  ADR-082; the rest of ADR-082 stands.
- **Decision:** `modules/<feature>/` holds one folder per job: `routes/` (URL, method, middleware, which handler),
  `controllers/` (read `req`, call the service, write `res`: status codes, cookies, redirects), `services/`
  (rules and validation, no `req`/`res`), `repositories/` (the only Prisma code), plus `middleware/`, `schemas/`,
  `clients/`, `jobs/` and `tests/` when the module has that kind of file. Request flow:
  route → middleware → controller → service → repository → database. New: an auth service (signup, login, logout,
  `authenticate`) that the auth middleware now calls instead of the repository; an alerts service; the GitHub
  callback's installation choice moved into `githubService.connect`; a `requireGitHub` middleware. Frontend: each
  feature's `<feature>.types.ts` moved into `types/`, `session.store.ts` into `stores/`, `deployment-state.ts`
  into `lib/`, so a feature root holds only folders and `index.ts`.
- **Choices inside it:** folders are created only when they hold a file (no empty folders kept with placeholder
  files): only auth and github have `middleware/`, only projects, auth and alerts have `schemas/`. Controllers are
  factories returning plain handler functions, matching the existing `xService(db)` and `xRepository(db)` style,
  with no classes or dependency-injection container. `alerts.raise.ts` sits in `repositories/` (it writes through
  the caller's transaction) and `alerts.sender.ts` in `jobs/` (the worker runs it). The GitHub install handler
  still answers 404 JSON for a non-member and redirects only GitHub errors, as before.
- **Options considered:** one file per layer at the module root (ADR-082: fewer folders, but the product owner
  finds layer folders easier to scan); routes as controllers (fewer files, but HTTP wiring and request handling
  mix); classes with dependency injection (testable but more ceremony than this codebase needs).
- **Consequences:** more files and one more hop per request; each file has one job and each layer is found by
  folder name. Behaviour unchanged (see evidence in `docs/CURRENT.md`).

### ADR-082 — Feature-based structure: layered API modules and self-contained frontend features (2026-11-08)
- **Status:** Accepted (2026-11-08). The product owner asked for a clear structure and approved all four steps.
- **Problem:** loose files at the API root (`config.ts`, `http-error.ts`, `secrets.ts`, `queue.ts`, `seed.ts`); the
  auth middleware lived in `auth.router.ts`, so four modules imported a router; `requireJson` ran for every `/api`
  request but was hidden in the auth router; routers held schemas, HTTP and business rules together (projects
  247 lines); `deployments/` mixed API and worker code; three modules used other modules' repositories; unclear
  names (`generated/`, `acceptance/`, `test/`). Frontend: one file for all 23 API calls, one for all types.
- **Decision:** the layout and dependency rules in `docs/ARCHITECTURE.md` (Code layout). API: `config/`, `lib/`,
  `middleware/`, `database/`, `modules/<feature>/` with `routes → service → repository`, worker code in `jobs/`,
  tests and the e2e run in `apps/api/tests/`. Frontend: `features/<feature>/{pages,components,api}` plus
  `<feature>.types.ts` and an `index.ts` public interface; generic code in `components/`, `hooks/`, `lib/`.
  Naming: kebab-case folders, PascalCase components, suffixes `.routes .service .repository .schema .api .types
  .store`.
- **Choices inside it:** services only where there are rules (projects, deployments, github); alerts routes stay
  thin, so no forwarding service. No controller files: in Express the route handler already is the controller.
  Deployments became its own frontend feature so projects and services do not depend on each other in a circle.
  Request bodies for services are still validated after the ownership check, keeping existing error behaviour.
  `lib/utils.ts` keeps its name because shadcn expects that path.
- **Options considered:** keep the flat layout (no churn, but the coupling above stays); full Clean Architecture
  with controllers, interfaces and dependency injection (more files that only forward calls); this structure
  (chosen: clear ownership with the fewest new files).
- **Left out:** TanStack Query, React Hook Form (new dependencies; `useLoad`/`useRequest` suffice), a shared
  `packages/api-contracts` (later improvement), renaming `apps/frontend` to `apps/web` (churn for no gain).
- **Evidence:** behaviour unchanged: lint, typecheck, 150 API tests, 5 frontend tests, the api, worker, migrate and
  web images build, and the full stack started from them: sign up, dashboard, project, new service form,
  settings, test alert and log out all worked in the browser.
- **Consequences:** new code follows the rules above; a cross-feature need goes through `index.ts` or a service.

### ADR-081 — Images built after green CI and pushed to GHCR, tagged with the commit (DevOps 7.2, CD part 1)
- **Status:** Accepted (2026-11-08). The product owner approved the image job.
- **Decision:** each app workflow gets an `image` job with `needs:` on its test job and `if: github.ref ==
  'refs/heads/main'`, so only green commits on `main` produce images. It checks out again (a new runner), logs in to
  GHCR with the run's automatic `GITHUB_TOKEN` (`--password-stdin`, never echoed), runs `docker build` with the
  app's Dockerfile and pushes `ghcr.io/<owner>/forgeops-<image>:<commit SHA>`. Only this job has
  `packages: write`; test jobs keep `contents: read`. The image carries the
  `org.opencontainers.image.source` label so GHCR links the package to the repository. `frontend.yml` pushes
  `forgeops-web`; `backend.yml` pushes `forgeops-api`, `forgeops-worker` and `forgeops-migrate` from the one
  Dockerfile by `--target`, in one job so the shared build stage is built once and reused from the cache.
- **Why:** build once, run everywhere: the image is the artifact, so every server and every rollback runs the same
  bytes instead of rebuilding (slow, uses the live server's CPU, depends on npm, may differ from what was tested).
  The commit tag is never overwritten, so a rollback is running an older tag and any server traces to one commit.
- **Options considered:** Docker Hub (a second account and a stored token; free private repos are limited); AWS ECR
  (comes with phase 8 and costs money); a personal access token (long-lived secret to leak and rotate);
  `GITHUB_TOKEN` (chosen: exists only for the run); tagging `latest` (overwritten, no rollback, no traceability);
  `docker/build-push-action` (layer caching and multi-platform builds, but hides the plain commands while learning;
  can replace them later).
- **Consequences:** the code is built twice (a check in CI, the real build inside the Dockerfile); testing inside
  the built image is a later improvement. Images accumulate in GHCR and will need a retention rule. Packages from a
  private repository are private, so the phase 8 server needs read access to pull.

### ADR-080 — Backend CI runs the real test services from docker-compose.yml (DevOps 7.2.3)
- **Status:** Accepted (2026-11-07).
- **Decision:** `backend.yml` starts the test services with the same compose file used locally:
  `docker compose up -d --wait postgres rabbitmq registry-test caddy-test mailpit-test`, creates `forgeops_test`,
  copies `apps/api/.env.example` to `.env`, then installs the root and the API only and runs lint, typecheck,
  `tsc` build and the 150 tests. The runner's own Docker engine runs the deploy tests (build, push, run, route). No
  secrets: the tests use a random encryption key and a fake GitHub client. Triggered by `apps/api/**`, `caddy/**`,
  `docker-compose.yml`, the shared root files and the workflow itself; 20-minute timeout; read-only token.
- **Options considered:** GitHub `services:` containers (built in, but they start before checkout, so the test Caddy
  cannot mount `caddy/caddy.json`, and the ports and versions would be a second copy of compose that can drift);
  mocking Docker and Caddy (fast, but the deploy path is exactly what must be tested for real); the compose file
  (chosen: one source of truth, CI matches the laptop).
- **Evidence:** in a clean clone with only `.env.example`, against freshly created services: 13 files, 150 tests
  passed.
- **Consequences:** the job needs Docker, so it stays on Linux runners. The worker image is not built here; image
  builds come in the next step.

### ADR-079 — ForgeOps' frontend is served from our own infrastructure, not Vercel (DevOps 7)
- **Status:** Accepted (2026-11-07). The product owner chose option 2.
- **Decision:** production serves the frontend from the same `web` image used locally (Caddy serving `dist` and
  passing `/api` to the API), on our own server in phase 8 and in Kubernetes in phase 9. No Vercel.
- **Options considered:** Vercel for the frontend (free, worldwide CDN, no server to run; but a second hosting place,
  its build is not the image tested locally, and the API would need a rewrite to keep `/api` on the same address
  for session cookies); our own infrastructure (chosen: one image from laptop to production, fits the Kubernetes
  phase, and the ops work is the point of the project).
- **Consequences:** the frontend Dockerfile stays and is the production artifact. No worldwide CDN for now; one can
  be put in front later. A marketing page could still live elsewhere if ever needed.

### ADR-078 — CI on GitHub Actions, one workflow per app (DevOps 7.2.1, 7.2.2)
- **Status:** Accepted (2026-11-07). The product owner chose one workflow file per app.
- **Decision:** CI runs on GitHub Actions (the repository is already on GitHub; no extra service). Each app has its
  own workflow in `.github/workflows/`, triggered by a `paths` filter on its own folder plus the shared root files
  (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.nvmrc`) and
  the workflow file itself. `frontend.yml` is first: checkout, pnpm from `packageManager`, Node from `.nvmrc`,
  `pnpm install --frozen-lockfile` for the root and the frontend only, then lint, typecheck, test and `vite build`.
  The token is read-only (`permissions: contents: read`) and the job stops after 10 minutes. Actions are pinned to
  major versions (`checkout@v7`, `setup-node@v7`, `pnpm/action-setup@v6`).
- **Options considered:** one `ci.yml` with a job per app (one file, skips cleanly under branch protection, but every
  push runs both apps unless a change-detection job is added); one workflow per app (chosen: matches how the apps
  ship separately, and an unrelated change starts no runner). Other CI services such as CircleCI or GitLab CI were
  not considered further: a second account and integration for no gain at this size.
- **Consequences:** when branch protection makes these checks required (7.1.2), a workflow skipped by its `paths`
  filter reports nothing and can leave the merge waiting; that step must handle it. Major-version tags can move;
  pinning to commit SHAs is part of 7.4.7. A `format.yml` and `backend.yml` follow. The repository is private, so
  runs use the 2,000 free minutes a month.

### ADR-077 — Migrations: the image says what runs, the orchestrator says when and where (DevOps 6.2)
- **Status:** Accepted (2026-11-07). Records the split behind ADR-076's migrate job.
- **Decision:** the `migrate` stage in `apps/api/Dockerfile` defines only the contents and the command: it starts
  `FROM build` (Prisma CLI and `prisma/migrations` already inside) and runs `prisma migrate deploy`. Everything about
  running it lives in `docker-compose.yml`: `target: migrate`, the `DATABASE_URL` to use, `depends_on` Postgres being
  healthy, and `api` and `worker` waiting on `service_completed_successfully`. One Dockerfile builds three images by
  stage: `api`, `worker` and `migrate`.
- **Why:** the image never knows which database it will touch, so the same `migrate` image can run against the local
  database from compose, and later from CI/CD or Kubernetes with a different `DATABASE_URL`, without a rebuild. On a
  server nobody types `prisma migrate deploy` by hand, so the step has to be part of the start order, before any code
  that reads the tables, and a failed migration has to stop the rollout.
- **Options considered:** run migrations by hand before each start (no automation; impossible at 3am or from CI);
  bake the database address into the image (simple, but one image per environment and a secret in the image); a
  separate `Dockerfile.migrate` (clearer file name, but duplicates the build stage and can drift from the API's
  code); run on API start (rejected in ADR-076: races between copies, Prisma CLI in the internet-facing image).
- **Consequences:** whatever runs ForgeOps must reproduce the order: database ready, migrate exits 0, then api and
  worker. Migrations must stay backward compatible, because the old version keeps running while they apply.

### ADR-076 — Frontend image, migrations and one-command start (DevOps 6.2)
- **Status:** Accepted (2026-11-07). The product owner asked for the whole platform in containers.
- **Frontend:** `apps/frontend/Dockerfile` builds the Vite app in a Node stage and serves `dist` from `caddy:2.10`
  (already in the stack, so no new tool). `apps/frontend/Caddyfile` serves files, falls back to `index.html` for app
  routes like `/app/settings`, and passes `/api` and `/health` to `api:4000`, the same paths the Vite dev proxy
  uses, so the frontend code is unchanged. Its admin API is off. Image: 59.7 MB. Published on `127.0.0.1:8080`;
  `APP_URL` for the containers is `http://localhost:8080`.
- **Migrations:** a `migrate` stage (the build stage, which has the Prisma CLI) runs `prisma migrate deploy` once as
  the `migrate` service and exits. `api` and `worker` wait for it with `service_completed_successfully`; it waits
  for Postgres with a `pg_isready` health check. The worker also waits for RabbitMQ to pass `rabbitmq-diagnostics
  ping`. `api`, `worker` and `web` restart unless stopped.
- **Why a separate step:** running migrations inside the API's start would race when two API copies start, and puts
  the Prisma CLI in the internet-facing image. A one-shot job runs once, before anything that needs the tables.
- **Options considered:** nginx for the frontend (common, but a second web server to learn); serving the files from
  Express (one less container, but couples frontend releases to the API); migrations on API start (simplest, races).
- **Evidence:** from empty volumes (a separate `fofresh` compose project), one `docker compose up` applied 14
  migrations, a new account signed up through the web container and the worker started; then the M1 acceptance run
  passed 15/15 through web, api and worker containers (`docs/evidence/containers-acceptance.md`).
- **Consequences:** the migrate image is large (it is the build stage) but never serves traffic. GitHub sends the
  OAuth callback to the URL registered on the GitHub App (the dev frontend on 5173), so Connect GitHub from the
  container frontend needs that URL added on GitHub.

### ADR-075 — Caddy's admin API only on a private admin network (DevOps 6.2)
- **Status:** Accepted (2026-11-07). Security fix found while containerising.
- **Problem:** Caddy's admin API listened on `0.0.0.0:2019` and Caddy shares the `forgeops-apps` network with every
  deployed app, so any user's app could read and rewrite all routing (proved with a container on that network).
- **Decision:** a new `forgeops-admin` network holds only Caddy and the worker. Caddy's admin listens on the alias
  `caddy-admin:2019` (`CADDY_ADMIN` env), which exists only on that network, and `caddy.json` lists the allowed admin
  host names. Port 2019 is no longer published to the Mac. The worker leaves `forgeops-apps` (it never needed it;
  the engine places user containers there). The live config was switched with one admin API call so routes kept.
- **Test Caddy:** stays on `0.0.0.0:2019` and published on `127.0.0.1:2020`, because tests on the Mac need it. It only
  routes throwaway test apps.
- **Options considered:** bind admin to the control-side IP and keep the Mac port (Docker on the Mac forwarded the
  port to a different network after some restarts, so it was unreliable, ISS-056); admin over a Unix socket (Node
  `fetch` cannot use one, and the Mac cannot reach it); Caddy's origin check alone (an attacker sets any Host header).
- **Evidence:** from a container on `forgeops-apps`, `caddy:2019` now refuses the connection; the worker reaches
  `caddy-admin:2019`; user apps still answer on port 80; acceptance 15/15.
- **Consequences:** the worker must run in its container to manage routes; `pnpm worker` from source on the Mac can
  no longer reach the real Caddy.

### ADR-074 — App logs collected by the worker, read from the database (DevOps 6.2)
- **Status:** Accepted (2026-11-07). The product owner chose this option.
- **Problem:** the Logs tab made the API run `docker logs`. In a container the API has no Docker access, and giving
  the internet-facing API the Docker socket would make one API bug a takeover of the machine.
- **Decision:** only the worker touches Docker. Every 3 seconds it lists `fo-` containers (`docker ps -a`), reads the
  last 1000 lines of each live deployment's container and upserts one `AppLog` row per live deployment (`running`,
  `log`), deleting rows for deployments that are no longer live. `GET /services/:id/logs` reads that row and returns
  the last `lines` lines; the response shape is unchanged. A missing container is saved as not running with no log;
  a stopped one keeps its last output.
- **Options considered:** give the API the socket (one line, but the riskiest); ask the worker over RabbitMQ and wait
  for a reply (no lag, but a new request-reply path that fails when the worker is busy).
- **Consequences:** logs are up to about 3 seconds behind; one `docker logs` call per live service every 3 seconds;
  at most one row per service. Same pattern as metrics (ADR-069).

### ADR-073 — Worker container with the host's Docker engine (DevOps 6.2)
- **Status:** Accepted (2026-11-06). The product owner approved mounting the socket.
- **Decision:** a `worker` stage extends the `api` image with `docker-cli` and `docker-cli-buildx` and runs
  `node dist/worker.js`. Compose mounts `/var/run/docker.sock`, so the worker drives the host's engine and user
  containers start next to ForgeOps, not inside it. The worker runs as root because the socket is root-only on
  this host (access to the socket is root-equivalent anyway). Config comes from `apps/api/.env` with container
  addresses and secret file paths overridden; the three secret files are mounted one by one, read-only. The API
  image does not get the Docker tools.
- **Options considered:** Docker-in-Docker (a separate engine inside the container: needs privileged mode, which is as
  powerful, plus no shared build cache); one image for API and worker (the internet-facing API would carry Docker).
- **Consequences:** whoever controls the worker controls every container on the host; real isolation comes later
  with separate build machines or Kubernetes. Images: api 522 MB, worker 632 MB.

### ADR-072 — ForgeOps API image (DevOps 6.2, step 1)
- **Status:** Accepted (2026-11-06). The product owner asked to Dockerize ForgeOps step by step.
- **Decision:** `apps/api/Dockerfile`, built from the repository root (`docker build -f apps/api/Dockerfile .`)
  because the pnpm lockfile and workspace file live there. Two stages: `build` installs all dependencies, runs
  `prisma generate` and `tsc`; the final stage installs production dependencies only (`--prod`, `--ignore-scripts`
  because the Prisma CLI is a dev dependency) and copies `dist`. It runs as the `node` user, not root, with
  `NODE_ENV=production`. pnpm is installed with `npm install -g pnpm@11.5.2` (pinned to `packageManager`) rather than
  Corepack, which is leaving Node. A root `.dockerignore` keeps `node_modules`, `dist`, generated code, `.env` files,
  `.git` and docs out of the build context.
- **Compose:** an `api` service builds and runs this image. Inside the compose network it reaches `postgres:5432`,
  `rabbitmq:5672` and `mailpit:1025` by service name. It publishes on `127.0.0.1:4001` so the dev API on 4000 keeps
  working. The encryption key is mounted read-only as one file (not the whole `~/.forgeops` folder). GitHub settings
  are left out for now (all-or-none, so GitHub is off in this container).
- **Options considered:** one-stage image (simpler, but ships TypeScript, tsx and vitest); `pnpm deploy` (copies a
  pruned package, but its file rules skip the git-ignored `dist`). The worker and the migration runner are later
  stages of the same Dockerfile (ADR-073, ADR-076), so all three come from the same build of the same code.
- **Consequences:** migrations are not run by the container yet (the Prisma CLI is not in the final image). The
  image was 1.21 GB, of which about 690 MB was pnpm's store and cache; deleting them in the same `RUN` as the
  install brought it to 522 MB. The Prisma CLI still comes along as a peer of `@prisma/client` (about 200 MB). The worker container (Docker access) is a separate decision.

### ADR-071 — Scripted M1 acceptance run (M1-S13)
- **Status:** Accepted (2026-11-06). The product owner asked for everything to be done and for maintainable code.
- **Decision:** `pnpm --filter @forgeops/api acceptance` signs in as a real account (default the demo account, or
  `ACCEPTANCE_EMAIL` with `ACCEPTANCE_PASSWORD_FILE`) and drives the running stack through its public API, like a
  user would: it creates a fresh project, deploys `demilade111/forgeops-sample-api`, and proves the 15 M1 criteria
  in order. It writes `docs/evidence/m1-acceptance.md` with a pass or fail and real proof for each (IDs, step
  timings, image digests, the URL's answer, logs, metric samples, the alert email from Mailpit, rollback records)
  and exits non-zero if any criterion fails. Files: `client.ts` (talking to ForgeOps, the router and the inbox),
  `criteria.ts` (the 15 checks), `report.ts` (results and the evidence file), `index.ts` (runs them).
- **Unhealthy releases:** criterion 8 uses the sample API's `FAIL_READINESS=true` (blocked before go-live).
  Criterion 14 uses the new `FAIL_READINESS_AFTER_SECONDS=25` (sample API commit `caaafb9`): healthy at go-live,
  then failing, so the watcher rolls it back.
- **Finding:** rollbacks start the old image with the service's current environment variables (ADR-063). If the
  breaking change is itself an environment variable, the rollback carries it along and does not recover. The run
  removes the variable right after go-live to model a code bug. Snapshotting env vars per deploy is the follow-up.
- **Options considered:** a Playwright browser script (closer to a user, but slow and brittle for 15 criteria);
  a manual checklist with screenshots (no repeatable proof).
- **Consequences:** each run leaves a project `m1-run-<time>` with real deploys, which is the evidence; delete it
  from the dashboard when no longer needed.

### ADR-070 — Alerts by email and Slack (M1-S12, closes ADR-020)
- **Status:** Accepted (2026-11-06). The product owner chose email and Slack.
- **What raises an alert:** a failed deploy, rollback or automatic rollback (`deploy_failed`), a live version that
  breaks during its watch window (`broke_after_live`), and the Settings "Send test alert" button (`test`). Each one
  is an `Alert` row written in the same transaction as the failure itself, with an `alert.requested` outbox
  message, so an alert cannot be lost between "it failed" and "tell someone". The text is built then: which service,
  which commit, which step, the reason, and whether the old version is still live.
- **Delivery:** the worker consumes `alert.requested`. Email goes to every member of the workspace through
  **nodemailer** over SMTP (`SMTP_URL`); locally that is **Mailpit**, a fake inbox at `localhost:8025` that catches
  everything (a second one on 1026/8026 for tests). In the cloud the same setting points at a real SMTP service
  such as Amazon SES. Slack gets `{"text": ...}` posted to the workspace's incoming webhook URL. Each channel is
  marked when it succeeds (`emailedAt`, `slackedAt`), so a retried message never sends twice; a failure throws, the
  queue retries up to 5 times, then the message goes to the dead-letter queue.
- **Security:** the webhook URL is a secret (anyone with it can post to the channel), so it is stored encrypted like
  env vars and never returned. Only `https://hooks.slack.com/services/...` is accepted, checked when saved and again
  before sending, and redirects are refused, so a user cannot make the worker call internal addresses such as
  Caddy's admin API (server-side request forgery). Only members can see or change a workspace's alerts.
- **Options considered:** in-app notifications only (seen only when you open ForgeOps); a hosted email API (needs
  an account and a key now); generic webhooks to any URL (needs full SSRF protection such as blocking private IP
  ranges after DNS lookup; later).
- **Consequences:** two new local containers (Mailpit) and one dependency (nodemailer). Deploys that time out in the
  stale sweeper do not alert yet. Alerts go to all members; per-person settings come with roles later.

### ADR-069 — CPU and memory metrics per service (M1-S11, closes ADR-021)
- **Status:** Accepted (2026-11-06). The product owner chose option B: users see their own app's usage; watching
  ForgeOps' own servers is a separate job for the cloud phase.
- **Decision:** a timer in the worker runs `docker ps` (containers labelled `forgeops.service`) and
  `docker stats --no-stream` every 15 seconds. Docker reads these numbers from the Linux kernel's control groups,
  which count each container's CPU time and memory. Only each service's live container is recorded, as a
  `MetricSample` row (service, deployment, CPU percent, memory bytes, memory limit, time); rows older than 24 hours
  are deleted on each run. `GET /api/services/:id/metrics?minutes=60` (5 to 1440, member-only like logs) returns
  the samples oldest first. The service page has a Metrics tab with two charts, CPU and memory, each on its own
  scale (never one chart with two axes), a 1h, 6h or 24h switch, the current value in large type, and a hover
  read-out.
- **Options considered:** ask Docker on every page view (no history); Prometheus with cAdvisor (the standard at scale,
  but two new services to run now; the planned upgrade for the cloud phase); a chart library (more code to ship for
  two simple line charts).
- **Consequences:** about 5,760 rows per service per day, pruned daily. CPU is a share of one core, so it can pass
  100% on a multi-core machine. No memory limit is set per app yet, so the memory "limit" is the whole machine's;
  the chart says so. Setting limits (`docker run --memory`) is a later step, after which the chart can show usage
  against the plan's limit like Render or Railway do.

### ADR-068 — Dark mode by default, and a deploy progress card
- **Status:** Accepted (2026-11-06). The product owner asked for a clearer view while deploying and for dark and light
  mode across the whole app, with dark as the default.
- **Decision:**
  1. **Theme:** a small Zustand store (`stores/theme.ts`) holds Light, Dark or System, saved in `localStorage`
     (`forgeops-theme`), default Dark. It toggles the `dark` class on `<html>`, and a few lines in `index.html` do the
     same before the app loads so there is no white flash. The dark palette is purple-tinted (primary `#8b70ff` on
     `#0c0b12`). The landing and login pages now use theme tokens instead of fixed colours; dark brand logos (GitHub,
     Rust, Bun, Deno, Java, Django) use the text colour so they stay visible. One `ThemeToggle` sits in the landing
     and dashboard headers; Settings has Light, Dark and System.
  2. **Deploy progress card:** while a deploy runs, the top of the service page shows "Deploying f2edcd7", "Step 3 of
     7: Build image, 12s so far", a seven-part progress bar, and the live output of the current step. It ends as "Live
     in 18.7s" with a Visit link, or "Deploy failed at Start app" with the error and that step's output. It says that
     visitors keep the current version until the new one is healthy.
  3. The dashboard logo links to the home page.
  4. The landing heading "Deploy web services with every step on the record" is plain text with a muted second
     half instead of a purple-to-pink gradient, which the product owner felt looked generated rather than designed.
- **Options considered:** follow the system setting by default (the product owner wanted dark first); CSS-only
  `prefers-color-scheme` (no manual switch); keep progress only in the history list (the reason for this change).
- **Consequences:** the theme is per browser. The progress card polls every 1.5 s while open, the same as the
  history list.

### ADR-067 — Automatic rollback after go-live (M1-S10, closes ADR-022)
- **Status:** Accepted (2026-11-06). The product owner chose option A ("watch window") and asked for the best
  version of it.
- **Problem:** the health check before go-live (ADR-061) proves a version worked at that moment. Some releases break
  minutes later, under real traffic, while nobody is watching.
- **Decision (the ADR-022 criteria):**
  1. A deploy started by a person (`trigger = manual`) gets `watchUntil` = go-live + 5 minutes. Rollbacks, manual or
     automatic, are not watched: they go back to a version that already worked, and watching them could loop.
  2. A timer in the worker checks every watched deploy every 10 seconds, without blocking deploys. The check is the
     S7 probe through a temporary Caddy route (`watch-<id>`, with the `X-Forgeops-Probe` header) plus a container
     check.
  3. **Broken** means 3 failed health checks in a row (a good answer resets the count), or the container stopped or
     restarted (a crash counts at once).
  4. The target is the newest earlier deploy that succeeded, has an image and did not itself break after going live.
     ForgeOps creates a normal rollback deploy (`trigger = auto_rollback`, no person, idempotency key
     `auto-rollback-<id>`), which runs the S9 steps: start, check health, go live. The broken deploy keeps its history
     and gets `failedAfterLive` with the reason.
  5. With no earlier version, the reason says so and nothing is rolled back. If a deploy is already running, the
     watcher waits for the next tick. A newer live version, or the window ending while healthy, stops the watch and
     removes the route.
- **Options considered:** watch forever (catches late failures, but replacing a version that ran fine for hours is
  risky and belongs to alerts, S12); crashes only (misses an app that is up but answers with errors); a separate
  watcher service or delayed queue messages (more moving parts for the same result).
- **Consequences:** a version that breaks in the first 5 minutes is replaced within about 30 seconds (12 seconds in
  the real crash test). The database is never rolled back. Watching happens in the single worker; with several
  workers it would need a lock (for example `FOR UPDATE SKIP LOCKED` on the watched rows). Also in this change: a
  failed deploy now keeps its built image digest, so the deploy page no longer says "Not built" when it was built.

### ADR-066 — A crash on start fails "Start app", not "Check health"
- **Status:** Accepted (2026-11-06). The product owner pointed out that a crash showed as a health problem.
- **Problem:** `docker run -d` succeeds as soon as the program launches, so "Start app" went green even when the app
  crashed a second later. The crash was only noticed inside the health step, which then reported "Your app stopped
  while starting" under "Check health". The Rollout and Health outcomes no longer meant what they said.
- **Decision:** after `docker run`, the start step watches the container for 3 seconds (`startupMs`, 1 s in tests).
  If it stops or restarts, "Start app" fails with "Your app stopped while starting" and the app's last 100 log lines,
  the container is removed and the health step never runs (Rollout: Failed, Health: Not reached). The health step
  keeps its own check as a safety net for apps that stop later (for example after a failed database connection)
  and says "Your app stopped during its health check". When a stopped app printed nothing, the log explains that
  the Dockerfile may be missing a `CMD` or `ENTRYPOINT`.
- **Options considered:** keep one combined step (less code, misleading); rename the step (still hides where it
  broke); a longer watch such as 10 s (catches more slow crashes, but every deploy waits longer, and the health step
  already covers them).
- **Consequences:** every deploy and rollback takes about 3 seconds longer. An app that crashes after 3 seconds is
  still caught, by the health step.

### ADR-065 — Connect GitHub starts with GitHub sign-in; one install can serve several workspaces
- **Status:** Accepted (2026-11-06). The product owner asked that a new person can always connect easily, and chose
  option (a) for people with several installs. Replaces rule 4 of ADR-039.
- **Problem:** Connect sent people straight to the App's install page. When the App was already installed on their
  GitHub account, GitHub showed its settings page and never came back. And an install linked to one workspace was
  refused for any other, so a second workspace (or a teammate's) could never connect.
- **Decision:**
  1. `GET /api/github/install` redirects to GitHub's OAuth sign-in (`/login/oauth/authorize`) with the same `state`
     cookie as before. An optional `installationId` (digits only) is stored in the cookie when the person picked
     an account.
  2. The callback swaps the `code` for the person's installs of our App (`GET /user/installations`, as in ADR-039).
     If GitHub sent an `installation_id` (just installed) or the cookie holds a pick, that install must be in the
     list, or `INSTALLATION_NOT_YOURS`. Otherwise: one install is linked at once; none sends them on to the install
     page with a fresh `state`; several redirect to `/app?github_choose=id:account,...`, where the dashboard asks
     "Which GitHub account should this workspace use?". Each button starts Connect again with that pick, so the
     choice is checked with GitHub again and the list in the URL is never trusted.
  3. `GitHubInstallation` is keyed by install plus workspace, so the same install can be linked to several
     workspaces. Safe because linking still needs GitHub to confirm the person can reach that install.
  4. `GET /api/github/repositories` returns `manageUrl` (the App's page on GitHub). The new-service form and
     Settings link to it, and the repo list reloads when the tab regains focus.
- **Options considered:** keep the install page and tick "Redirect on update" (GitHub returns only after the person
  presses Save, and the second-workspace refusal stays); link every install a person has (a repo would then need to
  remember its install; more work); a signed cookie holding the choices (needs a new secret; re-checking with
  GitHub is simpler).
- **Consequences:** needs the App's Client ID, a client secret, the callback URL and "Request user authorization
  (OAuth) during installation" on GitHub; without them Connect returns `GITHUB_OAUTH_NOT_CONFIGURED`. The person
  authorizes ForgeOps on GitHub once; later connects pass straight through. The user token is still used once and
  never stored.

### ADR-064 — Brand logos on the landing page
- **Status:** Accepted (2026-11-06). The product owner asked for real logos and clearer pictures on the landing page.
- **Decision:** use the `simple-icons` package (CC0 SVG paths with each brand's colour) for the stack tiles (Node.js,
  Python, Go, Rust, Ruby, PHP, Java via OpenJDK, Bun, .NET, Elixir, Deno, Django) and the GitHub and Docker marks
  in "Point it at your code". Named imports, so Vite bundles only the dozen icons used. The header menu keeps only
  "How it works". The three "Click, click, live." steps each show a product window inside the same purple stage as
  the hero, alternating sides: the new service form, the source settings with GitHub checks, and a finished deploy
  with all seven steps timed.
- **Options considered:** hand-copied SVG paths (no dependency, but hundreds of lines of path data in the source);
  logo image files from each project's site (inconsistent sizes and licences); keeping text-only tiles (no new
  dependency, but the product owner wanted logos).
- **Consequences:** one dev-time dependency in the frontend, shipped as about 12 small paths. Logos show that a
  stack runs, not an endorsement. The dashboard's "New project" and "Add service" tiles also now show their dashed
  border all the time and turn purple on hover, instead of the border only standing out on hover.

### ADR-063 — Manual rollback (M1-S9)
- **Status:** Accepted (2026-11-06). The product owner approved the three recommended options.
- **Decision:** `POST /api/deployments/:id/rollback` (with an `Idempotency-Key`, like Deploy) creates a new deployment
  with `trigger: rollback` and `rollbackOfId` pointing at the target. It copies the target's image digest and commit.
  The worker sees the trigger and runs only `run`, `health` and `route`: no GitHub calls, no build, no push. History
  keeps both: the bad deploy stays as it was and the rollback says what it went back to.
- **Rules:** only a successful deploy with an image can be a target (409 `NOT_ROLLBACK_TARGET`); not the live one
  (409 `ALREADY_LIVE`); not while another deploy is queued or running (409 `DEPLOYMENT_IN_PROGRESS`, the same lock as
  Deploy); other organizations get 404. Live is the latest successful deployment, so a successful rollback becomes
  the new live version.
- **Settings:** every deployment now stores the `port` and `healthCheckPath` it was created with (cheap, not
  secret), and the worker uses those instead of the service's current values. A rollback reuses the target's, so an
  old image still starts on the port it was built for even if the setting changed since. Environment variables use
  today's values; the confirm text says so.
  - Rejected: storing an encrypted copy of the env vars per deployment (exact rollback, but every deploy keeps
    another copy of the secrets).
- **UI:** "Roll back to this" on any earlier successful deploy in the history and on its deploy page, with a simple
  confirm ("Put f2edcd7 back live? Environment variables keep their current values."). Rollbacks have a "Rollback"
  label in history, and the deploy page links to the version they went back to.
- **Consequences:** a rollback is an attempt: if the old image fails its health check, the rollback fails and the
  current version stays live. Rollback needs the image to still be in the registry (no garbage collection yet). The
  database is never rolled back; schema changes must stay backward-compatible.

### ADR-062 — Logs and history (M1-S8)
- **Status:** Accepted (2026-11-06). The product owner approved the recommended options and asked to revisit the
  details after M1.
- **Live build logs:** `run` reports output as it arrives; the worker saves the latest output of the build and push
  steps at most once per second (`saveStepLog`, which only writes while the step is still running, so a late write
  never overwrites the final log). The page already polls every 1.5 s, so the log grows while you watch.
  - First version saved only when new output arrived, so output followed by silence (a slow `RUN` step) stayed
    unsaved until the step ended. A test caught it (ISS-043); the fix saves the latest output one second after it
    arrives.
- **App logs:** `GET /api/services/:id/logs?lines=1..1000` (default 200; the UI asks for 500). The API finds the
  service's latest successful deployment and runs `docker logs --tail N --timestamps fo-<deploymentId>`. The
  container name always comes from the database, never from the request. Membership is checked like every other
  service route. If the container is gone it answers `running: false`; if Docker can't be reached, 503
  `LOGS_UNAVAILABLE`. The Logs tab polls every 3 seconds and follows the newest line.
  - Options: (1) the API reads Docker directly (chosen for M1: simplest, no new tool); (2) the worker copies logs into
    PostgreSQL every few seconds (database growth, delay); (3) a log tool such as Loki (new infrastructure, needs
    approval).
  - Trade-off accepted: the API process now needs access to Docker on this machine. In the cloud this becomes a call
    to the log service (for example CloudWatch Logs) and the API needs no Docker access.
- **History and detail:** `GET /api/deployments/:id` also returns who triggered it (email) and the service, project,
  branch and repository. A deploy page at `/app/deployments/:id` shows the commit (linked to GitHub), branch,
  repository, image digest, total time, URL, the three outcome badges and every step with its log. History rows and
  the Production card link to it; the Production card now shows the image too.
- **Consequences:** logs are only for the live container and only what Docker keeps (no search, no history after a
  redeploy replaces the container). Old app logs disappear with the old container. Long-term storage and search are
  a later observability decision (ADR-013).

### ADR-061 — Readiness check before go-live (M1-S7)
- **Status:** Accepted (2026-11-06). The product owner approved the three recommended options.
- **Problem:** a deploy counted as live as soon as `docker run` returned, so a release that crashed a second later,
  or answered every request with errors, still took over the URL.
- **Decision:**
  - Each service has a **health check path**, default `/health/ready`, editable in Settings and in the new-service
    form. Empty means any HTTP answer from the app counts (for apps without a health endpoint). Validated: empty or
    starting with `/`, no spaces, at most 255 characters.
  - A new `health` step runs between `run` and `route`. It calls the path every second for up to 60 seconds, each
    call with a 5-second limit. A 2xx or 3xx answer passes. Before each call it checks the container is still
    running with no restarts, so a crashing app fails at once with "Your app stopped while starting" instead of
    waiting the full minute.
  - On failure the step log holds the last answer (for example `GET /nope returned 404`) and the last 100 lines of
    the app's own output, the new container is removed, and the route is never switched, so the old version keeps
    serving.
- **How the worker reaches the container:** apps live on a private Docker network the worker cannot reach. The
  worker adds a temporary Caddy route for an internal name (`check-<deploymentId>.forgeops.internal`) to the new
  container, calls Caddy's HTTP port with that `Host` header, then deletes the route.
  - Options considered: (1) temporary Caddy route (chosen: reuses what exists, works on any Docker); (2) a
    throwaway checker container on the app network per deploy (slower, another image); (3) calling the container's
    IP directly (works on OrbStack, not on Docker Desktop).
  - Caddy adds a response header (`X-Forgeops-Probe: app`) only to answers that come from the app, so Caddy's own
    502 when the app is not listening yet is never mistaken for an answer.
  - New setting `CADDY_HTTP_URL` (dev `http://127.0.0.1:80`, tests `http://127.0.0.1:8081`).
- **Outcomes in the UI:** each deployment shows three badges: **Build** (find commit to save image), **Rollout**
  (start app and go live) and **Health** (the check). A rollout that ended early reads "Stopped", so a failed health
  check shows Build Passed, Rollout Stopped, Health Failed.
- **Consequences:** a slow-starting app needs to answer within 60 seconds (configurable later). If the worker crashes
  during a check, the temporary route stays in Caddy pointing at a removed container (harmless, internal name).
  Health after go-live (an app that breaks an hour later) is not watched yet; that is the trigger for automatic
  rollback in M1-S10 and alerts in M1-S12, and the exact failed-rollout criteria remain ADR-022.

### ADR-060 — Deleting services and projects
- **Status:** Accepted (2026-11-06). The product owner asked for the recommended option ("do the best thing").
- **Options:** (1) simple delete: remove the database rows only; (2) clean delete: also take the app offline and
  free its URL, run by the worker.
- **Why not (1):** the container keeps running and answering at its URL with nothing left to track it, and a new
  service with the same name fails its first deploy because Caddy still routes that host to the old service.
  Render, Heroku, Vercel and Railway all tear the app down on delete.
- **Decision:** `DELETE /api/services/:id` and `DELETE /api/projects/:id` return 202. In one transaction the API
  locks the service rows (`FOR UPDATE`), refuses with 409 `DEPLOYMENT_IN_PROGRESS` if any deploy is queued or
  running, sets `deletingAt` (on the project and every service for a project delete) and writes a
  `deletion.requested` outbox row. Rows with `deletingAt` are hidden from every read, so the delete looks instant.
  The worker removes the Caddy route (`DELETE /id/svc-<id>`, 404 counts as done), removes the containers by label,
  then deletes the rows; deployments and steps go by cascade. Every step is safe to repeat, and the worker only
  deletes rows whose deletion was requested, so a stray message cannot remove a live service.
- **Deploy race:** creating a deployment now locks the service row and checks `deletingAt` in the same
  transaction, so a deploy and a delete cannot both win.
- **Retries:** a failed teardown is redelivered by RabbitMQ (up to 5 times). The worker's one-minute sweeper
  requests again any deletion older than 10 minutes, so a router or Docker outage only delays it.
- **Choices taken:** project delete removes its services (one confirmation, like Vercel and Render); rows are
  removed after teardown (no tombstone; an audit log can come later); only owners can delete, which today is
  every member because `owner` is the only role (PD-008), so no extra check yet.
- **UI:** a "Delete service" section at the bottom of the service Settings tab and "Delete project" at the bottom
  of the project page; the button stays disabled until the exact name is typed.
- **Consequences:** a name stays taken until the worker finishes (seconds, longer if a long build is ahead in the
  queue). Pushed images stay in the local registry (registry garbage collection is not set up). A service
  created in the same instant as its project is deleted is still removed, because the worker tears down every
  service in the project, not only the marked ones.
- **Also changed:** removing old containers after a successful deploy now reports failures to the log instead of
  ignoring them, without failing the deploy.

### ADR-059 — Settings in the dashboard
- **Status:** Accepted (2026-11-06). The product owner asked for settings in the dashboard.
- **Decision:** each service page has Overview and Settings tabs (`?tab=settings`). Settings edits the branch, root
  directory and port, and adds, replaces or removes environment variables, through the existing
  `PATCH /api/services/:id` (it re-checks the source with GitHub and merges env vars; `null` removes one). Values are
  never shown: to change one, add it again with the same name. After saving, the page says "Deploy to apply the
  change", because the running version keeps its old settings until the next deploy. An account Settings page
  (`/app/settings`, linked from the header) shows the email, workspace and role, the GitHub connection with a link to
  manage repositories, and log out.
- **Not included:** deleting a service or project and changing the password (no API yet).
- **Also in this change:** the dashboard, login and sign-up use the landing page's white and purple (primary
  `#6d4aff`); login and sign-up are split screens with a purple panel; the service page shows a live preview of the
  app at its URL (sandboxed iframe) instead of internal routing details, and labels use product words ("Root
  directory", "Environment variables", "Build time").

