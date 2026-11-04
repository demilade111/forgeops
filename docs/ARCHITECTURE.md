# ForgeOps — Architecture

## Current state (2026-10-25)

**Nothing is implemented yet.** The repository contains only documentation. This document describes the
architecture we are designing towards. Each part is labelled **Confirmed** (product decision PD-xxx or
accepted ADR) or **Under evaluation** (proposed or open). See `docs/DECISIONS.md`.

## Confirmed vs under evaluation

| Area | Confirmed | Under evaluation |
| --- | --- | --- |
| Application shape | Modular monolith with feature-based modules + separate deployment worker (ADR-001) | Exact module list and boundaries (Phase 0.3.4) |
| Backend | Node.js + Express 5 + TypeScript (ADR-003) | Validation, logging and docs libraries (chosen per task) |
| Queue | RabbitMQ locally, SQS in the cloud, behind one interface (ADR-006) | — |
| Repositories | Many repositories per project; services reference repo + branch + directory (PD-001) | GitHub App permission set (ADR-008, proposed) |
| Builds | Dockerfile builds + automatic builds feeding one pipeline (PD-002, PD-004) | Automatic build engine (ADR-017, open); cloud build execution (ADR-009, proposed). M1: local Docker with BuildKit on the worker machine (ADR-048), local registry `registry:3` (ADR-050) |
| Service types | Web services, workers, scheduled jobs (PD-003) | Scheduled-job mechanism (ADR-018, open) |
| Operations | Logs, history, commit/image tracking, health, manual + automatic rollback, CPU/memory metrics, alerts (PD-006) | Metrics source (ADR-021), alert channel (ADR-020), failed-rollout criteria (ADR-022) |
| Frontend | React + Vite + TypeScript SPA calling the Express API (ADR-002) | Router and data-fetching libraries (Phase 1.2) |
| Database | PostgreSQL as the source of truth (ADR-004); Prisma for schema, migrations and queries (ADR-005) | — |
| Repository layout | pnpm monorepo: `apps/frontend`, `apps/api`, `apps/worker`, `packages/shared` (ADR-023) | Separate `packages/db` for Prisma? (ticket 1.4.3) |
| Workload environment | One controlled deployment environment in V1 | Kubernetes, local first (ADR-010, proposed); managed URLs and routing (ADR-019, open) |
| Access control | Org-scoped authorization, single `owner` role in V1, several orgs per user (PD-008); real accounts in M1 (PD-010) | Authentication mechanism (ADR-007); workload-side isolation (ADR-014) |

## System overview

```
                         ┌──────────────── Control plane (ForgeOps) ────────────────┐
Browser ──> React SPA ─> │ API (Express, modular monolith) ──> PostgreSQL (truth)   │
            (Vite,       │        │                                  ▲              │
            static)      │        └─ outbox ─> Queue ─> Deployment worker ─────────┘│
                         └───────────────────────────────────┬──────────────────────┘
                                                             │
GitHub (repos, webhooks) ─────────────────────────────> Build execution
                                                             │  Dockerfile build │ Automatic build (engine TBD)
                                                             ▼
                                                      Image registry (image + digest)
                                                             │
                         ┌──────────── Workload plane ───────▼──────────────────────┐
                         │ Controlled deployment environment (Kubernetes proposed)  │
                         │   web services (managed URL) · workers · scheduled jobs  │
                         └──────────────────────────┬───────────────────────────────┘
                                                    │ logs · CPU/memory metrics · health
                                                    ▼
                                    Observability → status, alerts, failure reports
```

- **Control plane:** ForgeOps frontend, API, deployment worker and PostgreSQL. Decides *what should run*.
- **Workload plane:** the environment running user services. *Actually runs* them.
- **Async boundary:** the API records intent and returns quickly; the worker does slow work (build, rollout,
  rollback) and records every state change in PostgreSQL.

## Domain model (conceptual; schema designed in Phase 3.1)

```
Organization ─1:N─> Project ─1:N─> Service ─1:N─> Deployment ─1:N─> DeploymentStep / log references
                       │              │
                       │              ├─ type: web | worker | scheduled_job
                       │              ├─ source: repositoryId + branch + sourceDirectory
                       │              ├─ build: method (dockerfile | automatic) + detected/overridden settings
                       │              ├─ runtime: start command, port (web), schedule (scheduled_job)
                       │              └─ environment variables / secrets
                       │
                       └─1:N─> RepositoryConnection (GitHub repo linked to the project)

Scheduled job ─1:N─> JobExecution (start, end, status, logs)
```

Rules that follow from PD-001:

- A project can link **many** repositories.
- **Each service chooses its own** repository, branch and source directory.
- **Several services can point at the same repository** (monorepo: `frontend/`, `api/`, `worker/`).
- A webhook for one repository may therefore affect several services.

## Code layout (ADR-001, ADR-003, ADR-005, ADR-023)

```
forgeops/                         pnpm workspace
├─ apps/frontend/                 React + Vite SPA (static files)
├─ apps/api/                      Express modular monolith
│   └─ src/
│       ├─ server.ts              builds the app; listens only when run directly
│       ├─ config.ts              validated settings
│       └─ modules/               (added with the first real feature)
│           ├─ auth/              routes → controllers → services → repositories
│           ├─ organizations/
│           ├─ projects/
│           ├─ services/
│           ├─ integrations/      (GitHub)
│           └─ deployments/
├─ apps/worker/                   consumes queue jobs, runs build / rollout / rollback
└─ packages/shared/               shared types, Prisma schema + client
```

- **Feature-based modules:** each module owns its routes, logic and data access. Other modules call its
  public service functions and never query its tables directly.
- **Prisma only in repositories:** keeps database access in one layer per module and testable with fakes.
- The module list above is the starting point; final boundaries are set in ticket 0.3.4.
- **Start minimal:** today the API is one `server.ts` with the health routes. Feature modules, and a
  separate app factory if dependencies need wiring, are added when the first real feature arrives.

## Access control (PD-008, PD-010, PD-012)

- Every resource row carries (directly or through its parent) an `organizationId`.
- Every API request resolves the user, then their membership in the target organization, **before** loading
  data. Queries are always filtered by organization, so another organization's resource is "not found".
- Memberships store a `role`; V1 only uses `owner`. Adding admin / developer / viewer in V1.5 adds rules,
  not tables.
- Automated actors (webhooks, worker, auto-rollback) act with their own verified identity and are recorded
  as the trigger of what they start (PD-011).
- There is no cross-tenant admin API in V1 (PD-012).

## Build pipeline: two methods, one output

```
Service config + commit SHA
        │
        ├── build method = dockerfile  ──> build from the developer's Dockerfile ──┐
        │                                                                          ├──> container image
        └── build method = automatic   ──> detect JS/TS/Python conventions ────────┘    (digest recorded)
                                           → build engine (ADR-017, open)                     │
                                                                                              ▼
                                                                         shared deployment pipeline
```

- The build stage's only contract with the rest of the system is: **input** = service config + exact commit
  SHA; **output** = an image reference and digest, plus build logs and a build result.
- **Detection only suggests.** Detected settings are stored as suggestions and the developer confirms them.
  If detection is ambiguous, the service cannot deploy until required settings are provided explicitly (PD-005).
- The build engine sits behind an interface so the ADR-017 choice doesn't leak into the deployment pipeline.

## Shared deployment pipeline and status model

One pipeline for every build method and service type. **Three outcomes are tracked separately** (PD-006):

```
Deployment
  1. Build      → succeeded | failed            "Do we have an image?"
  2. Rollout    → succeeded | failed            "Did the new version start and become ready?"
  3. Health     → healthy | unhealthy           "Is it actually working, and does it stay working?"
        │
        └── rollout failed (criteria: ADR-022)
                  → automatic rollback attempt to the last successful deployment
                  → rollback outcome recorded: recovered | rollback failed
```

- Every deployment records its **commit SHA** and **image digest**, so "what is running?" always has an exact answer.
- **Manual rollback** redeploys a previous successful deployment's image. It doesn't rebuild.
- **Automatic rollback is an attempt, not a guarantee.** Destructive migrations or unavailable dependencies can
  make the previous version fail too. History records the attempt and its result.
- State transitions are written to PostgreSQL by the worker. Duplicate queue deliveries must not repeat side
  effects (ADR-006 idempotency rule).

### How service types differ inside the pipeline

| | Web service | Background worker | Scheduled job |
| --- | --- | --- | --- |
| Public URL | ForgeOps-managed (ADR-019) | None | None |
| Readiness / health | HTTP-based on the app port (details TBD) | Process-based (details TBD) | Per-execution success/failure |
| Rollout meaning | New version serving traffic | New version running | Schedule updated to the new version |
| Extra records | — | — | Execution history with status and logs |

How health is checked for workers and jobs is defined in Phase 9 / 11.3 (no decision yet).

## Observability and alerts (V1 scope, PD-006)

| Signal | Used for |
| --- | --- |
| Build logs | Why did the build fail? |
| Deployment logs and step records | Where in the pipeline did it fail? |
| Application logs | What did the app print? |
| CPU and memory metrics (basic) | Is it overloaded or leaking? (source: ADR-021) |
| Readiness and health results | Is it serving / running correctly? |
| Deployment history | What changed, when, and did recovery work? |
| Failure alerts | Tell the developer without them watching the dashboard (channel: ADR-020) |

Deeper observability (tracing, dashboards beyond the basics, SLO alerting) is V1.5 / later phases.

## Provider swap strategy (local → AWS)

Rule: **abstract only what actually changes between environments.** Everything else is configuration.

| Concern | Local | AWS | How we switch |
| --- | --- | --- | --- |
| Message queue | RabbitMQ | SQS | **Code adapter** behind `JobPublisher` / `JobConsumer` (ADR-006) |
| Secrets | `.env` file | Secrets Manager → injected as env vars | **Config only:** app reads `process.env` (ADR-016) |
| Database | PostgreSQL in Docker | RDS PostgreSQL | **Config only:** `DATABASE_URL` |
| Image registry | Local `registry:3` on `localhost:5001` (ADR-050) | ECR | **Config only:** `REGISTRY_HOST` + credentials |
| Kubernetes (if ADR-010 accepted) | kind | EKS (if chosen) | **Config only:** same Kubernetes API, different kubeconfig |

The build engine (ADR-017) also sits behind an interface, but because of PD-002, not because of the environment.

Config is read once at startup, and the right adapters are wired in one place.
No module outside the adapters imports `amqplib` or `@aws-sdk/*` directly.

## Sections still to be written (Phase 0.3)

- System context and container diagrams (formal versions)
- Backend module boundaries
- Synchronous vs asynchronous workflows
- Trust boundaries and permissions (detailed threat model)
- Local, staging and demo environments
