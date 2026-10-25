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
| ADR-007 | Authentication mechanism | Leaning: server-side sessions in httpOnly cookies + email/password (not decided; Phase 2.1). Must support PD-010 in M1 | Open |
| ADR-008 | Repository integration | GitHub App with least-privilege permissions; must support many repositories per project (PD-001) | Proposed |
| ADR-009 | Build execution | Controlled CI-based builds before self-hosted runners; applies to both build methods (PD-002) | Proposed |
| ADR-010 | Workload orchestration | Local Kubernetes first; managed cluster later if justified | Proposed |
| ADR-011 | Cloud | AWS for the production-style environment | Proposed |
| ADR-012 | Infrastructure as code | Terraform | Proposed |
| ADR-013 | Observability | Structured logs, metrics and traces introduced progressively; basic CPU/memory metrics and alerts are V1 (PD-006) | Proposed |
| ADR-014 | Tenant isolation | Authorization side settled by PD-008 (org-scoped). Workload side: one trusted workload environment initially | Proposed |
| ADR-015 | Deployment strategy | Rolling deployments with manual rollback **and automatic rollback on failed rollout** (PD-006) | Proposed (updated 2026-10-25) |
| ADR-016 | Secret management | Local `.env` (git-ignored) in development; AWS Secrets Manager for ForgeOps' own secrets in the cloud. App reads secrets only from env/config | Proposed (direction agreed 2026-10-24) |
| ADR-017 | Automatic build engine | Not selected (PD-002) | **Open** |
| ADR-018 | Scheduled job execution mechanism | Not selected (PD-003) | **Open** |
| ADR-019 | Managed URL scheme and traffic routing for web services | Not selected | **Open** |
| ADR-020 | Failure alert delivery channel(s) | Not selected | **Open** |
| ADR-021 | Source of basic CPU/memory metrics | Not selected (relates to ADR-013) | **Open** |
| ADR-022 | Failed-rollout criteria that trigger automatic rollback | Not selected (relates to ADR-015) | **Open** |
| ADR-023 | Repository layout | One Git monorepo with pnpm workspaces: `apps/web`, `apps/api`, `apps/worker`, `packages/shared` | **Accepted** (2026-10-25) |
| ADR-025 | Test tooling | Vitest (runner) + Supertest (HTTP tests against the Express app, no open port) | **Accepted** (2026-10-25) |
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
  - Prisma version and generator settings are pinned when the database is set up (ticket 1.4.3).

### ADR-023 — Repository layout: pnpm monorepo
- **Status:** Accepted (2026-10-25). Chosen by the product owner.
- **Decision:** One Git repository with pnpm workspaces:
  ```
  forgeops/
  ├─ apps/web/       React + Vite frontend
  ├─ apps/api/       Express modular monolith (src/modules/<feature>/)
  ├─ apps/worker/    deployment worker
  └─ packages/shared/  shared types and the Prisma client
  ```
- **Consequences:** Types and the Prisma schema are shared without publishing packages, and one PR can
  change API, worker and UI together. Module boundaries inside `apps/api` still have to be enforced by
  review and lint rules. Whether the Prisma schema gets its own `packages/db` package instead of living in
  `packages/shared` is decided in ticket 1.4.3. A build orchestrator (e.g. Turborepo) is not adopted unless
  justified later.

### ADR-024 — Code-quality toolchain
- **Status:** Accepted (2026-10-25), approved by the product owner in ticket 1.1.3.
- **Decision:** TypeScript 6.0.x with a shared strict `tsconfig.base.json` that each app extends; ESLint
  (flat config) with `typescript-eslint` recommended rules; Prettier for formatting, with
  `eslint-config-prettier` so the two never disagree. Markdown docs are excluded from Prettier.
- **Why TypeScript 6.0, not 7:** TypeScript 7 (the new native compiler) is the latest release, but
  `typescript-eslint` 8.72 only supports TypeScript `<6.1`. Revisit when typescript-eslint supports 7.
- **Not yet:** type-aware lint rules (need per-app tsconfigs; add once apps exist) and pre-commit hooks (ticket 1.1.7).

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
