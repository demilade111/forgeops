# ForgeOps — Master Engineering Backlog

Each numbered item is a small ticket (`FGO-<phase>.<feature>.<task>`), not an instruction to implement a
whole phase. Live status of active tickets is tracked in `docs/CURRENT.md`; `[x]` here means **Done**.

**Phases are the learning curriculum; milestones are the build order.** Milestone slices pull tickets from
several phases so we always have a working end-to-end system rather than half-finished layers.

_Updated 2026-10-25 for the Phase 0.1.1 product decisions PD-001 to PD-007. New tickets were appended to
existing features so existing numbering is unchanged._

---

## V1 scope coverage

Every confirmed V1 capability and where it lives in the backlog. None of these are implemented yet.

| V1 capability (decision) | Main tickets |
| --- | --- |
| Single- and multi-repository projects (PD-001) | 3.1.9, 4.1.9, 4.2.6, 4.2.11, 4.3.6, 4.4.9 |
| Dockerfile builds (PD-002) | 6.3, 6.4 |
| Automatic builds for JS / TS / Python (PD-002, PD-004) | 6.3.9–6.3.11, 6.6 |
| Web services, workers, scheduled jobs (PD-003) | 3.1.2, 3.4.11, 5.1.12, 9.1.10–9.1.12, 9.3.1–9.3.3, 9.3.11, 9.5.12 |
| Detected + editable configuration (PD-005) | 3.4.1, 3.4.7, 3.4.12, 3.4.13, 4.2.12, 6.6 |
| Progress, status, logs, history, commit + image tracking (PD-006) | 5.1, 5.3, 5.6, 6.4.6, 6.4.8, 10.2 |
| Separate build / rollout / health outcomes (PD-006) | 5.1.10, 9.5.5, 9.5.8 |
| Readiness and health checks (PD-006) | 1.3.4–1.3.5 (ForgeOps itself), 9.1.12, 9.2.8, 9.6.5 |
| Manual rollback (PD-006) | 9.5.9, 11.3.4–11.3.6 |
| Automatic rollback on failed rollout (PD-006) | 5.1.11, 11.3.2, 11.3.10–11.3.12 |
| Basic CPU and memory metrics (PD-006) | 10.3.11, 10.5.4 |
| Failure alerts and useful failure reporting (PD-006) | 5.6.7, 10.5.6, 10.6.9, 10.6.10 |
| Org-scoped access control, single `owner` role, multiple orgs per user (PD-008) | 2.4.1–2.4.11 |
| Real accounts in M1 (PD-010) | 2.1–2.2 (core), M1-S1 |
| Manual deploy; opt-in auto-deploy on push; trigger recorded (PD-011) | 3.4.14, 4.3.9, 5.1.13 |
| No operator admin UI; operator cannot read tenant secrets (PD-012) | 3.5.4, 11.1.7 |

---

## Milestone M1 — First production-style deployment (PD-007)

**Goal:** deploy the reference **Express.js + TypeScript HTTP API** end to end and demonstrate all 15
acceptance criteria in `docs/PRODUCT.md`. **M1 is not V1.** It covers one web service; workers, scheduled
jobs, automatic builds and multi-repository projects follow after M1 (they remain V1-required).

Each slice is a small vertical increment: it is merged only when its own checks pass and the system still
works end to end. Slices are ordered; later slices build on earlier ones.

| Slice | What it delivers | M1 criteria | Draws on | Done when |
| --- | --- | --- | --- | --- |
| **M1-S0 Foundation** | Repo, Express API, PostgreSQL, ForgeOps dashboard shell, health checks for ForgeOps itself | — | 1.1–1.4 | Phase 1 gate passes |
| **M1-S1 Identity & organization** | Sign-up, login, logout; personal organization created on sign-up; all later M1 data scoped to the organization (PD-008, PD-010) | — | 2.1–2.4 (core only) | Cross-organization access is denied in tests; unauthenticated requests rejected |
| **M1-S2 Reference API** | The sample Express + TypeScript API in its own GitHub repo, with a working HTTP endpoint and a health endpoint | — | 6.4.2 | Runs locally; its tests pass |
| **M1-S3 Connect & configure** | Connect the GitHub repo; select branch and source directory; configure one web service (build method, port, env vars) and confirm | 1, 2 | 3.2, 3.4, 4.2, 4.4 | Service config saved and visible; invalid config rejected |
| **M1-S4 Deployment intent & progress** | Manual Deploy (PD-011) → deployment record with its trigger → outbox → queue → worker; step-by-step state changes stored and shown | 2, 7 | 5.1, 5.3, 5.4, 5.5, 5.6 | A deployment moves through states; duplicates do not double-run |
| **M1-S5 Build & track** | Build the image; store build logs; record commit SHA and image digest | 3, 6, 9 | 6.3, 6.4 | Image pullable; logs and commit/digest visible; failed build reported clearly |
| **M1-S6 Run & expose** | Run the image in the controlled environment; serve it at a ForgeOps-managed URL | 4, 5 | 9.2, 9.3, 9.5 | `curl <managed URL>` returns the API response |
| **M1-S7 Readiness & health** | Readiness and health checks; build, rollout and health shown as separate outcomes | 7, 8 | 5.1.10, 9.5.5, 9.5.8 | Healthy and unhealthy releases are distinguished correctly |
| **M1-S8 Logs & history** | Deployment logs and a deployment history list/detail | 6, 10 | 5.6, 10.2 | Past deployments show status, commit, image, logs |
| **M1-S9 Manual rollback** | Roll back to a previous successful deployment's image | 13, 15 | 9.5.9, 11.3.4–11.3.6 | Previous version serving again; history records the rollback |
| **M1-S10 Automatic rollback** | Detect failed rollout; attempt rollback; record outcome | 14, 15 | 11.3.2, 11.3.10–11.3.12 | Deliberately unhealthy release is rolled back automatically, or the failed attempt is recorded |
| **M1-S11 Metrics** | Basic CPU and memory metrics for the running service | 11 | 10.3.11, 10.5.4 | Metrics visible and change under load |
| **M1-S12 Alerts** | Failure alert on failed deployment / unhealthy service | 12 | 10.6.9, 10.6.10 | A triggered failure produces an observable alert |
| **M1-S13 Acceptance run** | Scripted demo of criteria 1–15 with recorded evidence | 1–15 | — | Every criterion demonstrated and evidence saved |

**Open questions affecting M1** (see `docs/DECISIONS.md`):
- Authentication mechanism (ADR-007): needed before M1-S1. M1 itself must have real accounts (PD-010, decided).
- Which build method does M1 use first: Dockerfile, automatic, or both? The automatic build engine (ADR-017) is not selected.
- Managed URL scheme (ADR-019), metrics source (ADR-021), alert channel (ADR-020), failed-rollout criteria (ADR-022).
- Workload environment: Kubernetes is proposed (ADR-010), not accepted.

---

## Phase 0 — Product discovery, requirements and architecture

**Deliverable:** Approved PRD, architecture v0, ADR register and prioritized backlog.

### 0.1 — Product discovery and user journeys
- [x] 0.1.1 Define the first deployable application: problem statement, target developer, repository, build, service and configuration models, V1 deployment operations, first milestone (PD-001 to PD-007)
- [x] 0.1.2 Define user personas and workflows, including the access-control model (PD-008 to PD-012)
- [ ] 0.1.3 Map the first-time onboarding journey
- [ ] 0.1.4 Map the create-project journey
- [ ] 0.1.5 Map GitHub connection and repository selection (single and multiple repositories)
- [ ] 0.1.6 Map service configuration for web services, workers and scheduled jobs (detect → review → override → confirm)
- [ ] 0.1.7 Map the first successful deployment
- [ ] 0.1.8 Map failed deployment investigation
- [ ] 0.1.9 Map rollback and recovery (manual and automatic)
- [ ] 0.1.10 Define the V1 demo's exact success criteria (M1 criteria already defined; V1 demo still open)

_Learn:_ product discovery, actors, use cases, happy paths, alternative flows, error states, acceptance criteria.

### 0.2 — Functional and non-functional requirements
- [ ] 0.2.1 Define account and authentication requirements
- [ ] 0.2.2 Define organizations and memberships
- [ ] 0.2.3 Define projects, services and environments
- [ ] 0.2.4 Define GitHub integration behavior
- [ ] 0.2.5 Define deployment lifecycle and statuses
- [ ] 0.2.6 Define logs, metrics and health requirements
- [ ] 0.2.7 Define failure recovery and rollback requirements
- [ ] 0.2.8 Establish initial workload and traffic assumptions
- [ ] 0.2.9 Define availability, durability and latency objectives
- [ ] 0.2.10 Define threat boundaries and cost constraints

_Learn:_ functional vs non-functional requirements, SLIs, availability, capacity estimation, scope control.

### 0.3 — Architecture and engineering conventions
- [ ] 0.3.1 Compare modular monolith versus microservices
- [x] 0.3.2 Compare frontend framework options (React + Vite chosen, ADR-002)
- [ ] 0.3.3 Define control plane and workload/data plane responsibilities
- [ ] 0.3.4 Define backend module boundaries
- [ ] 0.3.5 Define PostgreSQL's role as the durable metadata source of truth
- [ ] 0.3.6 Identify synchronous versus asynchronous workflows
- [ ] 0.3.7 Define initial trust boundaries and permissions
- [ ] 0.3.8 Draw system context and container-level diagrams
- [ ] 0.3.9 Define local, staging and demo environments
- [ ] 0.3.10 Record ADR-001 through ADR-015 with decisions or explicit deferrals

_Learn:_ system design, bounded contexts, service boundaries, trade-offs, data ownership, architecture docs.

### 0.4 — Product management and delivery setup
- [ ] 0.4.1 Define repository and issue naming conventions
- [ ] 0.4.2 Create the epic/feature/task hierarchy
- [ ] 0.4.3 Define Definition of Ready
- [ ] 0.4.4 Define Definition of Done
- [ ] 0.4.5 Define bug severity and priority
- [ ] 0.4.6 Create issue, pull request and ADR templates
- [ ] 0.4.7 Define test and evidence requirements
- [ ] 0.4.8 Establish milestone acceptance reviews

**Gate:** We can explain exactly what V1 does, what it does not do, and why our first architecture is appropriate.

---

## Phase 1 — Full-stack foundation and local development

**Deliverable:** Browser → React (Vite) → Express API → PostgreSQL (Prisma), running locally in a pnpm monorepo.

### 1.1 — Repository and workspace setup
- [x] 1.1.1 Create the Git repository (private GitHub repo `demilade111/forgeops`)
- [x] 1.1.2 Choose monorepo structure and package manager (pnpm workspaces, ADR-023)
- [x] 1.1.3 Configure TypeScript and shared linting (pnpm workspace, `tsconfig.base.json`, ESLint, Prettier)
- [ ] 1.1.4 Create frontend application workspace
- [x] 1.1.5 Create backend application workspace (`apps/api`, Express 5 + TypeScript, ES modules)
- [ ] 1.1.6 Create shared types/contracts workspace if justified
- [ ] 1.1.7 Configure formatting and pre-commit checks
- [ ] 1.1.8 Write local setup documentation

_Learn:_ Git, monorepos, package management, TypeScript compilation, module resolution, developer tooling.

### 1.2 — Frontend application shell
- [ ] 1.2.1 Create client-side routing structure (choose router library)
- [ ] 1.2.2 Define layout and navigation hierarchy
- [ ] 1.2.3 Create design tokens and typography rules
- [ ] 1.2.4 Build reusable button, input and card primitives
- [ ] 1.2.5 Build dashboard shell and sidebar
- [ ] 1.2.6 Implement responsive navigation
- [ ] 1.2.7 Implement loading and empty states
- [ ] 1.2.8 Implement error boundaries and not-found states
- [ ] 1.2.9 Add accessibility checks

_Learn:_ React composition, client-side routing, SPA vs server rendering, Vite builds, semantic HTML, responsive design, accessibility.

### 1.3 — Backend application foundation
- [x] 1.3.1 Bootstrap Express + TypeScript (single `server.ts`; listens only when run directly)
- [ ] 1.3.2 Explain Node.js runtime and process lifecycle
- [x] 1.3.3 Configure environment validation (Zod schema, fail fast at startup)
- [x] 1.3.4 Create `GET /health/live`
- [x] 1.3.5 Create `GET /health/ready` (returns ok until the database check is added in 1.4.5)
- [ ] 1.3.6 Configure global validation and exception handling
- [ ] 1.3.7 Add structured request logging
- [ ] 1.3.8 Add API versioning and OpenAPI documentation
- [x] 1.3.9 Add unit and HTTP integration test setup (Vitest + Supertest)
- [ ] 1.3.10 Implement graceful shutdown

_Learn:_ HTTP, ports, processes, the Express request lifecycle, middleware order, manual dependency wiring, controllers, services, error middleware, event loop.

### 1.4 — Database and frontend integration
- [x] 1.4.1 Start PostgreSQL locally (Docker Compose, PostgreSQL 18, host port 5433)
- [x] 1.4.2 Compare database access libraries (Prisma chosen, ADR-005)
- [x] 1.4.3 Configure database connection and migrations (Prisma 7 + `@prisma/adapter-pg`; first migration comes with the first model)
- [ ] 1.4.4 Define an initial database schema (deferred to M1-S1: identity and organization tables)
- [x] 1.4.5 Add a database readiness check
- [ ] 1.4.6 Configure frontend API client
- [ ] 1.4.7 Display live API status in the dashboard
- [ ] 1.4.8 Handle API unavailable and timeout states
- [ ] 1.4.9 Write end-to-end health flow tests

_Learn:_ database servers, connections, pools, SQL migrations, fetch, CORS, timeouts, error propagation.

### 1.5 — First operations exercise
- [ ] 1.5.1 Inspect frontend and backend processes
- [ ] 1.5.2 Identify listening ports
- [ ] 1.5.3 Trace browser-to-API network requests
- [ ] 1.5.4 Stop the API and observe frontend behavior
- [ ] 1.5.5 Stop PostgreSQL and inspect readiness failures
- [ ] 1.5.6 Record the first troubleshooting runbook

**Gate:** The system starts with documented commands, exposes health checks, and handles API/database failures predictably.

---

## Phase 2 — Identity, authentication and organizations

**Deliverable:** Secure registration, login, sessions, organizations and membership-aware access.

### 2.1 — Authentication requirements and design
- [ ] 2.1.1 Define registration and login flows
- [ ] 2.1.2 Compare sessions versus JWT-based authentication
- [ ] 2.1.3 Define password storage and verification
- [ ] 2.1.4 Define session expiration and logout
- [ ] 2.1.5 Define CSRF, XSS and cookie protections
- [ ] 2.1.6 Define rate limits and account enumeration protection
- [ ] 2.1.7 Design identity tables and constraints
- [ ] 2.1.8 Approve the authentication ADR

_Learn:_ authn vs authz, cookies, sessions, hashing, token lifecycle, common web attacks.

### 2.2 — Backend identity implementation
- [ ] 2.2.1 Create user migration and entity
- [ ] 2.2.2 Implement registration DTO validation
- [ ] 2.2.3 Implement registration service
- [ ] 2.2.4 Implement password hashing
- [ ] 2.2.5 Implement login verification
- [ ] 2.2.6 Implement session creation
- [ ] 2.2.7 Implement authenticated `GET /me`
- [ ] 2.2.8 Implement logout and session invalidation
- [ ] 2.2.9 Add rate limiting
- [ ] 2.2.10 Test invalid credentials and concurrent requests

### 2.3 — Frontend authentication
- [ ] 2.3.1 Build registration form
- [ ] 2.3.2 Build login form
- [ ] 2.3.3 Add field-level validation
- [ ] 2.3.4 Handle loading and server errors
- [ ] 2.3.5 Implement authenticated app layout
- [ ] 2.3.6 Implement session-aware navigation
- [ ] 2.3.7 Implement logout interaction
- [ ] 2.3.8 Test protected route behavior
- [ ] 2.3.9 Add accessibility and keyboard checks

_Learn:_ forms, validation, controlled inputs, route protection, state synchronization, browser security.

### 2.4 — Organizations and memberships
- [ ] 2.4.1 Define organization ownership and membership rules (V1: creator is sole member with role `owner`; PD-008)
- [ ] 2.4.2 Design organization and membership tables
- [ ] 2.4.3 Implement create-organization API
- [ ] 2.4.4 Implement list-my-organizations API
- [ ] 2.4.5 Implement organization selection
- [ ] 2.4.6 Implement membership authorization guards
- [ ] 2.4.7 Implement organization creation UI
- [ ] 2.4.8 Implement workspace switcher
- [ ] 2.4.9 Test cross-organization access denial
- [ ] 2.4.10 Document tenant isolation assumptions
- [ ] 2.4.11 Create a personal organization automatically on sign-up

_Learn:_ relational modeling, foreign keys, authorization, RBAC, tenancy, IDOR.

**Gate:** A user can register, log in, create an organization and access only authorized organization data.

---

## Phase 3 — Projects, services and environments

**Deliverable:** Users can define what they intend to deploy before any deployment execution exists.

### 3.1 — Domain and database design
- [ ] 3.1.1 Define project lifecycle
- [ ] 3.1.2 Define service types: web service, background worker, scheduled job
- [ ] 3.1.3 Define environment lifecycle
- [ ] 3.1.4 Model organizations → projects → services → environments
- [ ] 3.1.5 Define ownership and deletion rules
- [ ] 3.1.6 Design unique constraints and indexes
- [ ] 3.1.7 Define transaction boundaries
- [ ] 3.1.8 Review the initial ER diagram
- [ ] 3.1.9 Model repository connections: many per project; each service references repository + branch + source directory; services may share a repository

_Learn:_ normalization, one-to-many relationships, constraints, indexes, transactions.

### 3.2 — Project backend
- [ ] 3.2.1 Create project migration
- [ ] 3.2.2 Create project DTOs
- [ ] 3.2.3 Implement create-project service
- [ ] 3.2.4 Implement list-projects query
- [ ] 3.2.5 Implement get-project endpoint
- [ ] 3.2.6 Implement update-project endpoint
- [ ] 3.2.7 Implement archive-project behavior
- [ ] 3.2.8 Add organization-scoped authorization
- [ ] 3.2.9 Add pagination and filtering
- [ ] 3.2.10 Test duplicate names and unauthorized access

### 3.3 — Project frontend
- [ ] 3.3.1 Build projects listing page
- [ ] 3.3.2 Build create-project form
- [ ] 3.3.3 Build project overview page
- [ ] 3.3.4 Add loading and empty states
- [ ] 3.3.5 Add form validation and errors
- [ ] 3.3.6 Implement edit-project workflow
- [ ] 3.3.7 Implement archive confirmation
- [ ] 3.3.8 Add pagination/filter controls
- [ ] 3.3.9 Test browser navigation and refresh

_Learn:_ REST resource modeling, pagination, React data fetching, cache invalidation, UI state.

### 3.4 — Services and environments
- [ ] 3.4.1 Create service configuration schema (type, source, build method, build/start commands, runtime, port, schedule)
- [ ] 3.4.2 Implement add-service API
- [ ] 3.4.3 Implement update-service configuration
- [ ] 3.4.4 Implement service list/detail endpoints
- [ ] 3.4.5 Create environment schema
- [ ] 3.4.6 Implement environment creation
- [ ] 3.4.7 Build service configuration UI (review detected settings, override, confirm)
- [ ] 3.4.8 Build environment selector
- [ ] 3.4.9 Validate service types and ports
- [ ] 3.4.10 Test organization and environment boundaries
- [ ] 3.4.11 Validate schedule configuration for scheduled jobs
- [ ] 3.4.12 Store detected settings separately from developer overrides
- [ ] 3.4.13 Block deployment until required settings are explicit when detection is ambiguous
- [ ] 3.4.14 Add per-service auto-deploy setting (off by default; PD-011)

### 3.5 — Configuration and secrets design
- [ ] 3.5.1 Distinguish configuration from secrets
- [ ] 3.5.2 Define environment-variable scopes
- [ ] 3.5.3 Define masking and redaction requirements
- [ ] 3.5.4 Define secret encryption and access policies
- [ ] 3.5.5 Implement non-secret configuration CRUD
- [ ] 3.5.6 Implement approved secret storage mechanism
- [ ] 3.5.7 Build environment-variable editor
- [ ] 3.5.8 Test that secrets never appear in logs or API responses

**Gate:** A user can create a project with web service, worker and scheduled job definitions, each pointing at its own repository, branch and directory, and configure separate environments.

---

## Phase 4 — GitHub integration and source control

**Deliverable:** A developer connects a GitHub repository and ForgeOps can identify which source revision to deploy.

### 4.1 — GitHub integration architecture
- [ ] 4.1.1 Compare GitHub OAuth Apps and GitHub Apps
- [ ] 4.1.2 Define required repository permissions
- [ ] 4.1.3 Design installation and connection lifecycle
- [ ] 4.1.4 Design repository ownership and authorization checks
- [ ] 4.1.5 Define branch and commit selection behavior
- [ ] 4.1.6 Define webhook events ForgeOps will accept
- [ ] 4.1.7 Design webhook verification and replay protection
- [ ] 4.1.8 Define behavior when access is revoked
- [ ] 4.1.9 Design multi-repository projects and repositories shared by several services

_Learn:_ OAuth, GitHub Apps, webhooks, HTTP signatures, permissions, API integration, trust boundaries.

### 4.2 — GitHub backend integration
- [ ] 4.2.1 Create integration configuration
- [ ] 4.2.2 Implement installation initiation
- [ ] 4.2.3 Validate installation callbacks
- [ ] 4.2.4 Store installation metadata
- [ ] 4.2.5 Implement repository listing
- [ ] 4.2.6 Implement repository selection (multiple repositories per project)
- [ ] 4.2.7 Retrieve branches and commit information
- [ ] 4.2.8 Implement integration disconnection
- [ ] 4.2.9 Handle GitHub API errors and rate limits
- [ ] 4.2.10 Test expired or revoked credentials
- [ ] 4.2.11 Implement source-directory browsing for a branch
- [ ] 4.2.12 Fetch the repository files needed for build detection

### 4.3 — Webhook processing
- [ ] 4.3.1 Create webhook endpoint
- [ ] 4.3.2 Verify GitHub signatures
- [ ] 4.3.3 Validate event types and payloads
- [ ] 4.3.4 Persist webhook delivery identifiers
- [ ] 4.3.5 Reject duplicate deliveries
- [ ] 4.3.6 Map repository events to every affected service
- [ ] 4.3.7 Record processing outcomes
- [ ] 4.3.8 Test malformed, replayed and unauthorized events
- [ ] 4.3.9 Start deployments on push only for services with auto-deploy enabled (PD-011)

### 4.4 — GitHub frontend
- [ ] 4.4.1 Build Connect GitHub screen
- [ ] 4.4.2 Build installation-status UI
- [ ] 4.4.3 Build repository selector
- [ ] 4.4.4 Build branch selector
- [ ] 4.4.5 Display latest commit information
- [ ] 4.4.6 Build integration settings
- [ ] 4.4.7 Handle revoked-access states
- [ ] 4.4.8 Add integration flow tests
- [ ] 4.4.9 Build source-directory selector

**Gate:** A project is linked to one or more authorized GitHub repositories, and each service can identify an exact commit SHA for deployment.

---

## Phase 5 — Deployment orchestration and distributed backend systems

**Deliverable:** A durable deployment engine that accepts requests, schedules work and survives duplicate requests and worker failures.

### 5.1 — Deployment domain design
- [ ] 5.1.1 Define what constitutes a deployment
- [ ] 5.1.2 Define deployment identifiers and version references
- [ ] 5.1.3 Define deployment states and transitions
- [ ] 5.1.4 Define desired state versus actual state
- [ ] 5.1.5 Define the source of truth for deployment status
- [ ] 5.1.6 Define cancellation semantics
- [ ] 5.1.7 Define deployment history and audit requirements
- [ ] 5.1.8 Design deployment tables and indexes
- [ ] 5.1.9 Review the state-transition diagram
- [ ] 5.1.10 Define build, rollout and application-health outcomes as separate statuses
- [ ] 5.1.11 Define rollback deployments (manual and automatic) and how rollback outcomes are recorded
- [ ] 5.1.12 Define scheduled-job execution records (history, status, logs)
- [ ] 5.1.13 Record each deployment's trigger: user, GitHub push, or automatic rollback (PD-011)

### 5.2 — Queue and worker architecture
- [ ] 5.2.1 Explain why deployment work should be asynchronous
- [ ] 5.2.2 Compare database-backed jobs, Redis/BullMQ and SQS
- [ ] 5.2.3 Define producer and consumer responsibilities
- [ ] 5.2.4 Define job acknowledgement behavior
- [ ] 5.2.5 Define retry and backoff policies
- [ ] 5.2.6 Define dead-letter and permanent-failure handling
- [ ] 5.2.7 Define job concurrency limits
- [ ] 5.2.8 Define worker shutdown and crash recovery
- [ ] 5.2.9 Record the queue architecture ADR

_Learn:_ message brokers, delivery guarantees, workers, durable state, backpressure, distributed failure modes.

### 5.3 — Deployment API
- [ ] 5.3.1 Create deployment database migration
- [ ] 5.3.2 Define create-deployment request contract
- [ ] 5.3.3 Implement create-deployment endpoint
- [ ] 5.3.4 Persist deployment intent transactionally
- [ ] 5.3.5 Implement deployment list endpoint
- [ ] 5.3.6 Implement deployment detail endpoint
- [ ] 5.3.7 Implement deployment cancellation request
- [ ] 5.3.8 Enforce organization and service permissions
- [ ] 5.3.9 Add pagination and filtering
- [ ] 5.3.10 Test concurrent deployment requests

### 5.4 — Idempotency and transactional safety
- [ ] 5.4.1 Define idempotency-key semantics
- [ ] 5.4.2 Design duplicate-request handling
- [ ] 5.4.3 Enforce uniqueness in PostgreSQL
- [ ] 5.4.4 Evaluate transactional outbox requirements
- [ ] 5.4.5 Atomically persist deployment intent and dispatch intent where required
- [ ] 5.4.6 Implement safe retry behavior
- [ ] 5.4.7 Prevent conflicting deployments to one environment
- [ ] 5.4.8 Test worker crash after performing a side effect
- [ ] 5.4.9 Test lost responses and repeated requests

_Learn:_ ACID, race conditions, unique constraints, outbox pattern, exactly-once illusions.

### 5.5 — Deployment worker
- [ ] 5.5.1 Create worker application entry point
- [ ] 5.5.2 Implement job consumption
- [ ] 5.5.3 Validate deployment state before processing
- [ ] 5.5.4 Implement transition to running
- [ ] 5.5.5 Implement deployment step execution interface
- [ ] 5.5.6 Persist step-level results
- [ ] 5.5.7 Implement timeout handling
- [ ] 5.5.8 Implement retry classification
- [ ] 5.5.9 Implement graceful worker shutdown
- [ ] 5.5.10 Implement recovery of interrupted jobs
- [ ] 5.5.11 Test duplicate deliveries and worker crashes

### 5.6 — Deployment frontend
- [ ] 5.6.1 Build Deploy button and confirmation
- [ ] 5.6.2 Build deployment history table
- [ ] 5.6.3 Build deployment detail page
- [ ] 5.6.4 Display deployment status timeline
- [ ] 5.6.5 Implement polling for status updates
- [ ] 5.6.6 Evaluate SSE versus WebSockets for future updates
- [ ] 5.6.7 Display failure reasons and retry information
- [ ] 5.6.8 Build cancellation UI
- [ ] 5.6.9 Test refresh during an active deployment

### 5.7 — Failure injection
- [ ] 5.7.1 Stop a worker mid-job
- [ ] 5.7.2 Submit the same deployment twice
- [ ] 5.7.3 Simulate queue unavailability
- [ ] 5.7.4 Simulate PostgreSQL connection loss
- [ ] 5.7.5 Simulate a deployment timeout
- [ ] 5.7.6 Simulate duplicate webhook delivery
- [ ] 5.7.7 Verify eventual status reconciliation
- [ ] 5.7.8 Write a failure analysis report

**Gate:** Deployment requests are durable, duplicates do not cause unintended duplicate execution, and worker failures have a documented recovery path.

---

## Phase 6 — Docker, Linux and build execution

**Deliverable:** ForgeOps builds a trusted sample application into a container image and publishes it to a registry.

### 6.1 — Linux and container prerequisites
- [ ] 6.1.1 Trace source code to running process
- [ ] 6.1.2 Examine Linux processes and ports
- [ ] 6.1.3 Compare virtual machines and containers
- [ ] 6.1.4 Learn namespaces and cgroups
- [ ] 6.1.5 Learn container filesystem layers
- [ ] 6.1.6 Examine signals and graceful termination
- [ ] 6.1.7 Inspect CPU, memory and disk usage
- [ ] 6.1.8 Diagnose permission and network failures

### 6.2 — Dockerize ForgeOps
- [ ] 6.2.1 Create backend Dockerfile
- [ ] 6.2.2 Create frontend Dockerfile
- [ ] 6.2.3 Create worker Dockerfile
- [ ] 6.2.4 Optimize multi-stage builds
- [ ] 6.2.5 Configure non-root execution
- [ ] 6.2.6 Configure Docker networks
- [ ] 6.2.7 Configure persistent database storage
- [ ] 6.2.8 Create Docker Compose environment
- [ ] 6.2.9 Add health checks and resource limits
- [ ] 6.2.10 Verify complete local startup

### 6.3 — Build pipeline design
- [ ] 6.3.1 Define supported sample application structure
- [ ] 6.3.2 Define Dockerfile location and build context
- [ ] 6.3.3 Define image naming and tagging
- [ ] 6.3.4 Compare local builds and CI-hosted builds
- [ ] 6.3.5 Define build timeouts and resource limits
- [ ] 6.3.6 Define build logs and artifact metadata
- [ ] 6.3.7 Define image registry permissions
- [ ] 6.3.8 Approve the build-execution ADR
- [ ] 6.3.9 Define supported automatic-build conventions for JavaScript, TypeScript and Python (which frameworks and runtimes, and how each is detected)
- [ ] 6.3.10 Evaluate and select the automatic build engine (ADR-017)
- [ ] 6.3.11 Define the build interface shared by Dockerfile and automatic builds (input: config + commit; output: image digest, logs, result)

### 6.4 — Image build and registry
- [ ] 6.4.1 Create a sample frontend application
- [ ] 6.4.2 Create a sample backend API (the M1 reference Express.js + TypeScript API)
- [ ] 6.4.3 Create a sample background worker
- [ ] 6.4.4 Create production Dockerfiles for samples
- [ ] 6.4.5 Implement approved build trigger
- [ ] 6.4.6 Capture build status and logs
- [ ] 6.4.7 Publish image to registry
- [ ] 6.4.8 Persist image digest and metadata
- [ ] 6.4.9 Handle failed and timed-out builds
- [ ] 6.4.10 Verify image can be pulled and run
- [ ] 6.4.11 Create sample Python API and Python worker for automatic-build testing
- [ ] 6.4.12 Create a sample scheduled job

### 6.5 — Build security
- [ ] 6.5.1 Define trusted-source restrictions
- [ ] 6.5.2 Prevent build-secret leakage
- [ ] 6.5.3 Scan images for vulnerabilities
- [ ] 6.5.4 Validate image registry access
- [ ] 6.5.5 Limit build permissions
- [ ] 6.5.6 Prevent privileged Docker execution
- [ ] 6.5.7 Document why arbitrary public builds are out of scope

### 6.6 — Automatic builds (PD-002, PD-004, PD-005)
- [ ] 6.6.1 Implement source inspection for the conventions approved in 6.3.9
- [ ] 6.6.2 Produce suggested build and runtime settings from detection
- [ ] 6.6.3 Report ambiguous or insufficient detection and require explicit settings
- [ ] 6.6.4 Build images through the selected engine behind the shared build interface
- [ ] 6.6.5 Record detected settings, overrides and build outcome per deployment
- [ ] 6.6.6 Test each approved JavaScript / TypeScript convention
- [ ] 6.6.7 Test each approved Python convention
- [ ] 6.6.8 Test unsupported and ambiguous repositories (clear errors, no invented values)

**Gate:** A trusted sample repository produces a versioned, tested, pullable container image through both the Dockerfile and the automatic build methods.

---

## Phase 7 — CI/CD and release engineering

**Deliverable:** Automated test, build, scan, publish and release pipelines for ForgeOps and the trusted sample workloads.

### 7.1 — CI architecture
- [ ] 7.1.1 Define pull request quality gates
- [ ] 7.1.2 Define branch protection policy
- [ ] 7.1.3 Define frontend test pipeline
- [ ] 7.1.4 Define backend test pipeline
- [ ] 7.1.5 Define integration test pipeline
- [ ] 7.1.6 Define image build workflow
- [ ] 7.1.7 Define release artifact strategy
- [ ] 7.1.8 Define deployment approval rules

### 7.2 — GitHub Actions implementation
- [ ] 7.2.1 Add lint workflow
- [ ] 7.2.2 Add TypeScript type-check workflow
- [ ] 7.2.3 Add backend unit tests
- [ ] 7.2.4 Add frontend tests
- [ ] 7.2.5 Add PostgreSQL integration tests
- [ ] 7.2.6 Add Docker build
- [ ] 7.2.7 Add dependency and image scanning
- [ ] 7.2.8 Add registry publication
- [ ] 7.2.9 Add build artifact metadata
- [ ] 7.2.10 Test intentionally failing workflows

### 7.3 — Release and deployment workflow
- [ ] 7.3.1 Define release versioning
- [ ] 7.3.2 Define immutable image references
- [ ] 7.3.3 Create staging release workflow
- [ ] 7.3.4 Add staging smoke tests
- [ ] 7.3.5 Add deployment approval gate
- [ ] 7.3.6 Record release provenance
- [ ] 7.3.7 Implement rollback trigger contract
- [ ] 7.3.8 Test failed release recovery

### 7.4 — CI/CD security and reliability
- [ ] 7.4.1 Replace long-lived cloud credentials where possible
- [ ] 7.4.2 Configure OIDC authentication
- [ ] 7.4.3 Minimize workflow permissions
- [ ] 7.4.4 Protect production environments
- [ ] 7.4.5 Prevent untrusted workflow execution
- [ ] 7.4.6 Test secret masking
- [ ] 7.4.7 Review third-party action dependencies
- [ ] 7.4.8 Document release recovery procedures

**Gate:** Code changes pass automated checks, produce traceable artifacts and follow an approved release process.

---

## Phase 8 — AWS, networking and Terraform

**Deliverable:** A secure, reproducible cloud environment hosting ForgeOps' production-style services.
⚠️ No paid cloud resources are created without explicit approval.

### 8.1 — Cloud architecture requirements
- [ ] 8.1.1 Estimate initial application resource needs
- [ ] 8.1.2 Compare EC2, ECS and EKS
- [ ] 8.1.3 Identify which components require managed services
- [ ] 8.1.4 Define availability and cost objectives
- [ ] 8.1.5 Design public and private network boundaries
- [ ] 8.1.6 Define database placement
- [ ] 8.1.7 Define outbound internet requirements
- [ ] 8.1.8 Draw AWS architecture v1
- [ ] 8.1.9 Approve infrastructure ADRs

### 8.2 — AWS security and account setup
- [ ] 8.2.1 Configure MFA and account access
- [ ] 8.2.2 Configure billing budget and alerts
- [ ] 8.2.3 Create least-privilege IAM roles
- [ ] 8.2.4 Define workload credentials
- [ ] 8.2.5 Configure logging and audit settings
- [ ] 8.2.6 Define secret-management approach
- [ ] 8.2.7 Document credential recovery and rotation

### 8.3 — VPC and networking
- [ ] 8.3.1 Choose VPC CIDR range
- [ ] 8.3.2 Design subnet ranges
- [ ] 8.3.3 Configure public subnet routing
- [ ] 8.3.4 Configure private subnet routing
- [ ] 8.3.5 Evaluate NAT and endpoint costs
- [ ] 8.3.6 Configure security groups
- [ ] 8.3.7 Configure application load balancing
- [ ] 8.3.8 Configure DNS
- [ ] 8.3.9 Configure TLS certificates
- [ ] 8.3.10 Verify network connectivity
- [ ] 8.3.11 Simulate blocked network access

_Learn:_ IP addressing, CIDR, routing, NAT, DNS, TLS, firewalls, load balancing, VPC architecture.

### 8.4 — Terraform foundations
- [ ] 8.4.1 Install Terraform and configure providers
- [ ] 8.4.2 Define variables and outputs
- [ ] 8.4.3 Provision first AWS resource
- [ ] 8.4.4 Explain Terraform state
- [ ] 8.4.5 Configure remote state
- [ ] 8.4.6 Configure state locking
- [ ] 8.4.7 Create networking module
- [ ] 8.4.8 Create security module
- [ ] 8.4.9 Create compute module
- [ ] 8.4.10 Create environment configurations

### 8.5 — ForgeOps infrastructure provisioning
- [ ] 8.5.1 Provision VPC through Terraform
- [ ] 8.5.2 Provision subnets and routing
- [ ] 8.5.3 Provision security groups
- [ ] 8.5.4 Provision IAM roles
- [ ] 8.5.5 Provision chosen compute environment
- [ ] 8.5.6 Provision database infrastructure
- [ ] 8.5.7 Configure load balancer
- [ ] 8.5.8 Configure DNS and HTTPS
- [ ] 8.5.9 Configure infrastructure logging
- [ ] 8.5.10 Validate complete deployment

### 8.6 — Infrastructure automation and operations
- [ ] 8.6.1 Add Terraform format and validation checks
- [ ] 8.6.2 Add Terraform plan workflow
- [ ] 8.6.3 Require review before apply
- [ ] 8.6.4 Implement drift detection
- [ ] 8.6.5 Test state-lock contention
- [ ] 8.6.6 Test recovery from failed apply
- [ ] 8.6.7 Write Python resource-auditing command
- [ ] 8.6.8 Write infrastructure teardown runbook
- [ ] 8.6.9 Verify no unintended billable resources remain

**Gate:** ForgeOps cloud infrastructure can be provisioned, inspected and safely destroyed using documented Terraform workflows.

---

## Phase 9 — Kubernetes and application deployment platform

**Deliverable:** ForgeOps deploys web services, background workers and scheduled jobs to a controlled Kubernetes cluster.

### 9.1 — Kubernetes architecture decisions
- [ ] 9.1.1 Compare Docker Compose, ECS and Kubernetes
- [ ] 9.1.2 Define what Kubernetes will manage
- [ ] 9.1.3 Understand control plane and worker nodes
- [ ] 9.1.4 Define workload namespaces
- [ ] 9.1.5 Define service exposure strategy
- [ ] 9.1.6 Define resource requests and limits
- [ ] 9.1.7 Define workload identity and permissions
- [ ] 9.1.8 Define rollout and rollback behavior
- [ ] 9.1.9 Approve Kubernetes architecture ADR
- [ ] 9.1.10 Define the managed URL scheme and traffic routing for web services (ADR-019)
- [ ] 9.1.11 Select the scheduled-job execution mechanism (ADR-018)
- [ ] 9.1.12 Define readiness and health checks per service type (web, worker, scheduled job)

### 9.2 — Local Kubernetes environment
_Phase 9 assumes ADR-010 (Kubernetes) is accepted; it is currently Proposed._

- [ ] 9.2.1 Install kind and kubectl
- [ ] 9.2.2 Create local cluster
- [ ] 9.2.3 Inspect nodes and namespaces
- [ ] 9.2.4 Create first Pod
- [ ] 9.2.5 Create Deployment
- [ ] 9.2.6 Create Service
- [ ] 9.2.7 Configure ConfigMap and Secret
- [ ] 9.2.8 Configure health probes
- [ ] 9.2.9 Configure resource limits
- [ ] 9.2.10 Diagnose failing Pods

_Learn:_ reconciliation, Pods, Deployments, ReplicaSets, Services, cluster DNS, scheduling, health probes.

### 9.3 — Deploy frontend and backend workloads
- [ ] 9.3.1 Define web service workload template (frontend websites and APIs)
- [ ] 9.3.2 Define background worker workload template (no public URL)
- [ ] 9.3.3 Define scheduled job workload template (no public URL)
- [ ] 9.3.4 Configure environment variables
- [ ] 9.3.5 Configure service discovery
- [ ] 9.3.6 Configure ingress routing
- [ ] 9.3.7 Configure TLS for application access
- [ ] 9.3.8 Test frontend-to-API communication
- [ ] 9.3.9 Test background worker connectivity
- [ ] 9.3.10 Test rolling updates
- [ ] 9.3.11 Test scheduled job runs on schedule and records each execution

### 9.4 — Helm deployment packaging
- [ ] 9.4.1 Explain Helm charts
- [ ] 9.4.2 Create sample application chart
- [ ] 9.4.3 Define configurable values
- [ ] 9.4.4 Template service names and ports
- [ ] 9.4.5 Template health checks
- [ ] 9.4.6 Template resource limits
- [ ] 9.4.7 Validate chart output
- [ ] 9.4.8 Test chart installation and upgrade
- [ ] 9.4.9 Test chart rollback

### 9.5 — Connect ForgeOps to Kubernetes
- [ ] 9.5.1 Define Kubernetes deployment adapter interface
- [ ] 9.5.2 Configure restricted cluster credentials
- [ ] 9.5.3 Map ForgeOps services to Kubernetes resources
- [ ] 9.5.4 Implement workload creation
- [ ] 9.5.5 Implement deployment status inspection
- [ ] 9.5.6 Implement rollout progress tracking
- [ ] 9.5.7 Persist Kubernetes resource identifiers
- [ ] 9.5.8 Implement deployment failure detection
- [ ] 9.5.9 Implement rollback operation
- [ ] 9.5.10 Implement cleanup for removed workloads
- [ ] 9.5.11 Test partial Kubernetes API failures
- [ ] 9.5.12 Implement scheduled-job execution tracking (history, status, logs)

### 9.6 — Deployment reliability and security
- [ ] 9.6.1 Configure namespace permissions
- [ ] 9.6.2 Apply resource quotas
- [ ] 9.6.3 Configure network policies
- [ ] 9.6.4 Test Pod restart behavior
- [ ] 9.6.5 Test unhealthy readiness probes
- [ ] 9.6.6 Test image pull failures
- [ ] 9.6.7 Test insufficient cluster capacity
- [ ] 9.6.8 Test failed rollout recovery
- [ ] 9.6.9 Document Kubernetes troubleshooting commands

**Gate:** A user triggers deployment through ForgeOps, and an application with web services, a worker and a scheduled job runs on Kubernetes with traceable status and rollback.

---

## Phase 10 — Logs, metrics, tracing and observability

**Deliverable:** Developers can understand what their applications are doing and why failures occur.

### 10.1 — Observability requirements
- [ ] 10.1.1 Define health and availability indicators
- [ ] 10.1.2 Define application metrics
- [ ] 10.1.3 Define infrastructure metrics
- [ ] 10.1.4 Define deployment metrics
- [ ] 10.1.5 Define log retention and access rules
- [ ] 10.1.6 Define trace correlation requirements
- [ ] 10.1.7 Define alerting thresholds
- [ ] 10.1.8 Design observability architecture

### 10.2 — Structured logging
- [ ] 10.2.1 Define structured log format
- [ ] 10.2.2 Add request correlation IDs
- [ ] 10.2.3 Add deployment correlation IDs
- [ ] 10.2.4 Instrument backend operations
- [ ] 10.2.5 Instrument worker operations
- [ ] 10.2.6 Configure centralized log collection
- [ ] 10.2.7 Implement authorized log retrieval
- [ ] 10.2.8 Implement log filtering
- [ ] 10.2.9 Redact secrets and sensitive values
- [ ] 10.2.10 Test log availability during failures
- [ ] 10.2.11 Capture scheduled-job execution logs

### 10.3 — Metrics and dashboards
- [ ] 10.3.1 Instrument HTTP request count
- [ ] 10.3.2 Instrument request latency
- [ ] 10.3.3 Instrument error rates
- [ ] 10.3.4 Instrument deployment success/failure counts
- [ ] 10.3.5 Instrument queue depth and processing duration
- [ ] 10.3.6 Configure Prometheus scraping
- [ ] 10.3.7 Create Grafana service dashboard
- [ ] 10.3.8 Create deployment operations dashboard
- [ ] 10.3.9 Create infrastructure dashboard
- [ ] 10.3.10 Verify metrics against generated traffic
- [ ] 10.3.11 Collect basic CPU and memory metrics per deployed service (V1 required; source per ADR-021)

### 10.4 — Distributed tracing
- [ ] 10.4.1 Explain traces, spans and context propagation
- [ ] 10.4.2 Instrument incoming API requests
- [ ] 10.4.3 Propagate context into deployment jobs
- [ ] 10.4.4 Instrument database operations
- [ ] 10.4.5 Instrument worker operations
- [ ] 10.4.6 Configure tracing backend
- [ ] 10.4.7 Trace one deployment end-to-end
- [ ] 10.4.8 Investigate an intentionally slow operation

### 10.5 — Observability frontend
- [ ] 10.5.1 Build service health overview
- [ ] 10.5.2 Build log viewer
- [ ] 10.5.3 Implement log search and filtering
- [ ] 10.5.4 Build metrics dashboard
- [ ] 10.5.5 Build deployment events timeline
- [ ] 10.5.6 Display failed deployment diagnostics
- [ ] 10.5.7 Implement refresh and time-range controls
- [ ] 10.5.8 Handle unavailable monitoring data
- [ ] 10.5.9 Test tenant-aware observability access

### 10.6 — Alerts and SRE
- [ ] 10.6.1 Define SLIs and SLOs
- [ ] 10.6.2 Define error-budget policy
- [ ] 10.6.3 Configure high-error-rate alert
- [ ] 10.6.4 Configure deployment-failure alert
- [ ] 10.6.5 Configure worker-backlog alert
- [ ] 10.6.6 Configure infrastructure saturation alert
- [ ] 10.6.7 Test alert triggering
- [ ] 10.6.8 Document incident response steps
- [ ] 10.6.9 Select failure-alert delivery channel(s) for developers (ADR-020)
- [ ] 10.6.10 Implement developer-facing failure alerts for failed deployments and unhealthy services (V1 required)

**Gate:** A failed deployment can be investigated through logs, metrics, deployment history and traces.

---

## Phase 11 — Security, recovery and production reliability

**Deliverable:** Tested security boundaries, safe deployment recovery and operational runbooks.

### 11.1 — Security review
- [ ] 11.1.1 Draw trust boundaries
- [ ] 11.1.2 Review authentication threats
- [ ] 11.1.3 Review organization authorization
- [ ] 11.1.4 Review GitHub integration permissions
- [ ] 11.1.5 Review build execution security
- [ ] 11.1.6 Review Kubernetes API permissions
- [ ] 11.1.7 Review secret storage and exposure
- [ ] 11.1.8 Review audit logging
- [ ] 11.1.9 Document residual risks

### 11.2 — Application hardening
- [ ] 11.2.1 Implement API rate limits
- [ ] 11.2.2 Review input validation
- [ ] 11.2.3 Review CORS and CSRF controls
- [ ] 11.2.4 Configure secure HTTP headers
- [ ] 11.2.5 Review session management
- [ ] 11.2.6 Test unauthorized resource access
- [ ] 11.2.7 Test cross-organization data isolation
- [ ] 11.2.8 Review dependency vulnerabilities
- [ ] 11.2.9 Verify sensitive data redaction

### 11.3 — Deployment rollback and recovery
- [ ] 11.3.1 Define healthy deployment criteria
- [ ] 11.3.2 Define failed rollout criteria that trigger automatic rollback (ADR-022)
- [ ] 11.3.3 Define previous-version retention
- [ ] 11.3.4 Implement manual rollback API
- [ ] 11.3.5 Implement rollback worker operation
- [ ] 11.3.6 Implement rollback UI
- [ ] 11.3.7 Verify restored application health
- [ ] 11.3.8 Test failed rollback behavior
- [ ] 11.3.9 Document recovery limitations (automatic rollback is an attempt, not a guarantee)
- [ ] 11.3.10 Implement automatic rollback on failed rollout (V1 required)
- [ ] 11.3.11 Record each rollback attempt and its outcome (recovered / rollback failed) in deployment history
- [ ] 11.3.12 Test cases where rollback cannot recover (destructive migration, unavailable dependency)

### 11.4 — Database and infrastructure recovery
- [ ] 11.4.1 Define backup policy
- [ ] 11.4.2 Define RPO and RTO targets
- [ ] 11.4.3 Create PostgreSQL backup
- [ ] 11.4.4 Restore backup to isolated environment
- [ ] 11.4.5 Test database outage response
- [ ] 11.4.6 Test application restart
- [ ] 11.4.7 Test worker recovery
- [ ] 11.4.8 Test infrastructure re-provisioning
- [ ] 11.4.9 Write disaster recovery runbook

### 11.5 — Incident simulation
- [ ] 11.5.1 Simulate application crash
- [ ] 11.5.2 Simulate bad deployment
- [ ] 11.5.3 Simulate database unavailability
- [ ] 11.5.4 Simulate queue backlog
- [ ] 11.5.5 Simulate Kubernetes Pod failure
- [ ] 11.5.6 Simulate DNS or ingress misconfiguration
- [ ] 11.5.7 Measure detection and recovery time
- [ ] 11.5.8 Write blameless postmortem
- [ ] 11.5.9 Implement a corrective action

**Gate:** We can demonstrate a failure, investigate it, recover service and explain the root cause.

---

## Phase 12 — Performance, scalability and advanced backend engineering

**Deliverable:** Measured performance, documented bottlenecks and evidence-based scaling decisions.

### 12.1 — Performance baseline
- [ ] 12.1.1 Define performance test scenarios
- [ ] 12.1.2 Define representative test data
- [ ] 12.1.3 Configure k6
- [ ] 12.1.4 Measure API throughput
- [ ] 12.1.5 Measure p50/p95/p99 latency
- [ ] 12.1.6 Measure database query latency
- [ ] 12.1.7 Measure deployment queue throughput
- [ ] 12.1.8 Establish performance baseline

### 12.2 — Database performance
- [ ] 12.2.1 Identify slow queries
- [ ] 12.2.2 Use EXPLAIN ANALYZE
- [ ] 12.2.3 Review indexes
- [ ] 12.2.4 Review pagination strategies
- [ ] 12.2.5 Review connection pooling
- [ ] 12.2.6 Test concurrent writes
- [ ] 12.2.7 Review transaction isolation
- [ ] 12.2.8 Compare results after optimization

### 12.3 — Caching and concurrency
- [ ] 12.3.1 Identify expensive repeated reads
- [ ] 12.3.2 Evaluate whether caching is necessary
- [ ] 12.3.3 Compare local and distributed caches
- [ ] 12.3.4 Define cache invalidation rules
- [ ] 12.3.5 Implement one justified caching use case
- [ ] 12.3.6 Test stale data behavior
- [ ] 12.3.7 Test cache outage behavior
- [ ] 12.3.8 Measure actual improvement

### 12.4 — Worker and deployment scaling
- [ ] 12.4.1 Measure queue processing time
- [ ] 12.4.2 Identify worker bottlenecks
- [ ] 12.4.3 Define concurrency limits
- [ ] 12.4.4 Test multiple workers
- [ ] 12.4.5 Test deployment ordering
- [ ] 12.4.6 Test duplicate processing
- [ ] 12.4.7 Test backpressure
- [ ] 12.4.8 Evaluate horizontal scaling
- [ ] 12.4.9 Document throughput and reliability trade-offs

### 12.5 — Frontend performance
- [ ] 12.5.1 Audit initial page loading
- [ ] 12.5.2 Inspect JavaScript bundle size
- [ ] 12.5.3 Optimize data fetching
- [ ] 12.5.4 Optimize large deployment lists
- [ ] 12.5.5 Reduce unnecessary rerenders
- [ ] 12.5.6 Improve loading states
- [ ] 12.5.7 Audit accessibility
- [ ] 12.5.8 Compare before-and-after measurements

### 12.6 — Architecture at scale (design exercises, not claims)
- [ ] 12.6.1 Estimate 100 active projects
- [ ] 12.6.2 Estimate 10,000 active projects
- [ ] 12.6.3 Identify control-plane bottlenecks
- [ ] 12.6.4 Identify database bottlenecks
- [ ] 12.6.5 Identify queue bottlenecks
- [ ] 12.6.6 Evaluate service decomposition
- [ ] 12.6.7 Evaluate multi-cluster scheduling
- [ ] 12.6.8 Evaluate multi-region deployment
- [ ] 12.6.9 Prepare scaling architecture diagrams

---

## Phase 13 — Portfolio, documentation and interview preparation

**Deliverable:** A demonstrable engineering project and three evidence-based interview narratives.

### 13.1 — Technical documentation
- [ ] 13.1.1 Write product README
- [ ] 13.1.2 Write architecture overview
- [ ] 13.1.3 Finalize architecture diagrams
- [ ] 13.1.4 Document backend modules
- [ ] 13.1.5 Document database schema
- [ ] 13.1.6 Document API contracts
- [ ] 13.1.7 Document CI/CD pipeline
- [ ] 13.1.8 Document Terraform and AWS
- [ ] 13.1.9 Document Kubernetes deployments
- [ ] 13.1.10 Document incidents and recovery

### 13.2 — Full-stack interview preparation
- [ ] 13.2.1 Explain frontend architecture
- [ ] 13.2.2 Explain the SPA vs server-rendering decision (React + Vite vs Next.js)
- [ ] 13.2.3 Explain forms and validation
- [ ] 13.2.4 Explain authentication and sessions
- [ ] 13.2.5 Explain API integration
- [ ] 13.2.6 Explain UI state and caching
- [ ] 13.2.7 Explain frontend testing
- [ ] 13.2.8 Explain frontend performance trade-offs

### 13.3 — Backend interview preparation
- [ ] 13.3.1 Explain Express API architecture and layering
- [ ] 13.3.2 Explain dependency injection and the composition root
- [ ] 13.3.3 Explain PostgreSQL schema decisions
- [ ] 13.3.4 Explain transactions and isolation
- [ ] 13.3.5 Explain queues and worker design
- [ ] 13.3.6 Explain idempotency and retries
- [ ] 13.3.7 Explain concurrency control
- [ ] 13.3.8 Explain consistency and recovery
- [ ] 13.3.9 Explain scaling and bottlenecks
- [ ] 13.3.10 Complete a backend system design interview

### 13.4 — DevOps interview preparation
- [ ] 13.4.1 Explain Linux processes and networking
- [ ] 13.4.2 Explain Docker images and containers
- [ ] 13.4.3 Explain GitHub Actions workflows
- [ ] 13.4.4 Explain AWS network architecture
- [ ] 13.4.5 Explain IAM and secrets management
- [ ] 13.4.6 Explain Terraform state and modules
- [ ] 13.4.7 Explain Kubernetes workloads
- [ ] 13.4.8 Explain monitoring and alerting
- [ ] 13.4.9 Diagnose simulated infrastructure failures
- [ ] 13.4.10 Complete a DevOps architecture interview

### 13.5 — Portfolio demonstration
- [ ] 13.5.1 Prepare a clean demo environment
- [ ] 13.5.2 Record project onboarding
- [ ] 13.5.3 Record GitHub connection
- [ ] 13.5.4 Record deployment workflow
- [ ] 13.5.5 Record monitoring workflow
- [ ] 13.5.6 Demonstrate a failed release
- [ ] 13.5.7 Demonstrate rollback
- [ ] 13.5.8 Present system architecture
- [ ] 13.5.9 Present performance measurements
- [ ] 13.5.10 Prepare project-based resume bullet points
