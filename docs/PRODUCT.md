# ForgeOps — Product Requirements

Version 1.2 · Updated 2026-10-25 with the confirmed Phase 0.1.1 and 0.1.2 decisions (PD-001 to PD-012 in `docs/DECISIONS.md`)

ForgeOps is a developer platform where users connect source code from GitHub, configure services, build
and deploy them, monitor them, investigate failures and roll back releases.

> **Approved for V1 is not the same as implemented.** Nothing in this document is built yet; see
> `docs/CURRENT.md` for real status.

## Problem statement

**Target developer.** A solo developer or small team (1–5 people) who has built an application made of
one or more services (websites, APIs, background workers, scheduled jobs) and can write code, but has no
platform or SRE team behind them.

**Problem.** Getting the app online is the easy part. When a release breaks, they can't quickly answer
*what changed, what is failing, and how do I get back to the last working version?* Build output,
deployment state, logs, metrics and health live in different places, if they exist at all, so a bad
deploy turns into guesswork and downtime.

**What ForgeOps does.** One place to connect GitHub repositories, configure and deploy services, see each
release's progress, status and health, investigate failures from logs, metrics and history, be alerted
when something fails, and recover manually or automatically.

**Lead message: reliability, not just deployment.** Deployment is required, but it is the means. ForgeOps
is judged on one question: _when a deploy goes wrong, how fast can the developer see it and recover?_

## Positioning

ForgeOps is not trying to out-feature hosted platforms like Vercel, Render or Railway. The differences:

- **It runs on infrastructure you control**: your own deployment environment and cloud account. That puts
  it closer to self-hosted platforms such as Coolify, Dokku or Porter than to fully managed hosting.
- **Its internals are visible and explainable**: the job queue, the deployment state machine, rollout
  tracking and rollback are first-class, documented parts of the product rather than hidden.
- **It is reliability-first**: deployment history, health, alerts and rollback are the core loop, not add-ons.

Honest framing for interviews: ForgeOps is a portfolio and learning platform. Its value is showing that
these systems can be designed, built, broken and recovered end to end, not competing commercially.

---

## V1 product models (confirmed in Phase 0.1.1)

### Repository model (PD-001)

- V1 supports **single-repository applications** (several services in one GitHub repository, e.g. a
  monorepo) **and multiple-repository applications** (services spread across several repositories).
- **Each service independently references** its GitHub repository, branch and source directory.
- Several services may reference the **same** repository with different source directories.
- ForgeOps must **not** assume one project = one repository.

### Build model (PD-002, PD-004)

Two build methods, both producing a container image that enters **one shared deployment pipeline**:

| Build method | How it works | Language scope |
| --- | --- | --- |
| **Dockerfile build** | The developer provides a Dockerfile; ForgeOps builds the image from it. | Any language, provided the Dockerfile produces a compatible container image. |
| **Automatic build** | No Dockerfile needed. ForgeOps inspects the source, detects supported characteristics and uses a build engine to produce an image. | **JavaScript, TypeScript and Python only** in V1. |

- Possible automatic-build application types: Node.js APIs, Next.js applications, React/Vite frontends,
  Python APIs and Python workers.
- **Supporting a language does not mean supporting every framework in it.** Exact framework and runtime
  conventions are defined and tested during implementation planning.
- Go, Java and other languages are **not** committed to automatic builds in V1; they may still deploy
  through Dockerfile builds.
- **The automatic build engine has not been selected** (open decision, see `docs/DECISIONS.md`).

### Service model (PD-003)

| Service type | What it is | Public URL | Specific needs |
| --- | --- | --- | --- |
| **Web service** | An HTTP application: frontend website or backend API | Yes, ForgeOps-managed | Application port, readiness/health |
| **Background worker** | A continuously running process doing background work | No | Process health, logs, metrics |
| **Scheduled job** | An application or command run on a configured schedule | No | Schedule configuration, execution history, per-run status and logs |

### Service configuration experience (PD-005)

Automatic detection with editable settings:

1. Connect a GitHub repository.
2. Select the branch and source directory.
3. ForgeOps inspects the repository and **suggests** build and runtime settings.
4. The developer reviews the detected settings.
5. The developer overrides any applicable setting.
6. The developer confirms the configuration before deploying.

Configurable settings: build method · source directory · build command (where applicable) · start command
(where applicable) · runtime or framework · application port (web services) · environment variables and
secrets · schedule (scheduled jobs).

- **When detection is ambiguous or insufficient, ForgeOps asks for explicit configuration. It never
  silently invents values.**
- A repository-based YAML configuration file is **not** a required V1 feature.

### Deployment operations (PD-006, "Advanced Deployment Operations")

V1 must provide:

- Deployment progress and status
- Build logs and deployment logs
- Deployment history
- Source commit and container image tracking for every deployment
- Application readiness and health checks
- Manual rollback
- **Automatic rollback on a failed rollout**
- Basic CPU and memory metrics
- Failure alerts
- Useful failure reporting (what failed, at which stage, and why, as far as can be determined)

**Three separate outcomes, never merged into one "success" flag:**

| Outcome | Question it answers |
| --- | --- |
| **Build** | Did we produce a container image? |
| **Rollout** | Did the new version get scheduled, start and become ready in the deployment environment? |
| **Application health** | Is the running application actually healthy now, and does it stay healthy? |

**Automatic rollback is a recovery attempt, not a guarantee.** ForgeOps redeploys the last successful
version, but recovery can still fail. For example:

- a **destructive database migration** in the failed release means the previous code no longer matches the data;
- an **infrastructure dependency is unavailable** (database, external API, registry), so the previous version
  is just as unhealthy.

The deployment history must record the rollback attempt and its outcome, including when recovery did not succeed.

---

## First end-to-end milestone: M1 "Production-Style Deployment" (PD-007)

M1 is the **first** end-to-end target. **It is not the whole V1 release.** It deliberately uses one Web
service and one reference application.

**Reference application:** a small **Express.js + TypeScript HTTP API** in a GitHub repository.

**M1 acceptance criteria.** M1 is complete only when we can demonstrate all of these:

1. Connect a GitHub repository containing the reference API.
2. Configure and initiate a deployment.
3. Successfully build a container image.
4. Run the application in the controlled deployment environment.
5. Reach a working HTTP endpoint through a ForgeOps-managed URL.
6. View build and deployment logs.
7. View deployment progress and final status.
8. Check application readiness and health.
9. See the deployed Git commit and container image.
10. View deployment history.
11. View basic CPU and memory metrics.
12. Trigger and observe a failure alert.
13. Manually roll back to a previously successful version.
14. Deploy a deliberately unhealthy release and observe automatic rollback.
15. Confirm the deployment history records the failure and the recovery outcome.

M1 is delivered as small, testable vertical slices (see `docs/ROADMAP.md`, Milestone M1).

**M1 includes real accounts (PD-010):** sign-up, login, logout and an automatically created personal
organization, with every M1 feature scoped to that organization. There is no unauthenticated or
"single-user mode" shortcut. Deploys in M1 are manual (PD-011).

---

## Actors

| Actor | Goal |
| --- | --- |
| Developer | Connect code, configure and deploy services, monitor their health, recover from failures |
| Organization owner | Own the organization: its projects, GitHub connections, secrets and settings |
| Platform operator | Operate ForgeOps infrastructure and investigate incidents |
| Automated system | Receive events, process jobs, reconcile deployment state, run schedules and report outcomes |

## Personas (confirmed in Phase 0.1.2, PD-009)

### 1. Developer: the main user
- **Who:** a solo developer or member of a team of 1–5, with no platform team.
- **Goals:** deploy web services, workers and scheduled jobs from GitHub; know within a minute whether a
  release is healthy; recover fast when it isn't.
- **Frustrations today:** build logs, deploy status and app logs live in different places; a broken release
  means guessing what changed; rollback is manual and scary.
- **Success looks like:** "I deployed a bad release, ForgeOps showed me it failed and why, and it was rolled
  back, automatically or by me, in minutes."

### 2. Organization owner
- **Who:** the person who created the organization. **In V1 this is always the same person as the developer**
  (see access control below).
- **Goals:** keep the organization's projects, GitHub connections and secrets safe; be sure nobody outside
  the organization can see or change them.

### 3. Platform operator: runs ForgeOps itself
- **Who:** whoever operates the ForgeOps installation (for this project, us).
- **Goals:** know when ForgeOps itself is unhealthy (API errors, queue backlog, stuck deployments, capacity);
  recover using runbooks; tear down cloud resources safely to control cost.
- **V1 access (PD-012):** works through infrastructure and observability tools and runbooks. **There is no
  platform super-admin UI in V1**, and the operator must not be able to read tenant secret values through ForgeOps.

### 4. Automated system: non-human actors
- GitHub (webhooks), the deployment worker, build execution, the workload environment and schedulers.
- Each one must authenticate (e.g. verified webhook signatures, scoped worker credentials), act
  idempotently, and leave a record of what it did.

## Access control (confirmed in Phase 0.1.2, PD-008)

- **Every resource belongs to an organization**: projects, services, repository connections, deployments,
  logs, metrics, secrets.
- **Every request is authorized against organization membership.** A user who is not a member gets no access,
  and a resource in another organization behaves as if it doesn't exist.
- **V1 roles:** one role, `owner`. The user who creates an organization becomes its only member, as owner,
  with full access to it.
- A user can create **several organizations** and switch between them.
- On sign-up, a **personal organization is created automatically** so the user can start immediately.
- **Not in V1 (V1.5):** inviting other users, and the roles admin / developer / viewer. Memberships carry a
  role from day one so roles can be added later without redesigning the data model.

## Deployment triggers and attribution (confirmed in Phase 0.1.2, PD-011)

- **M1:** deployments are started **manually** by the developer.
- **V1:** also **auto-deploy on push** to a service's configured branch. **Off by default**, enabled per service.
- **Every deployment records what triggered it:** a user (who), a GitHub push (which commit), or an
  automatic rollback (and which failed deployment caused it). This appears in deployment history.

## Core workflows (confirmed outline, PD-009)

Detailed step-by-step journeys, alternative flows and error states are mapped in tickets 0.1.3–0.1.9.

| # | Workflow | Happy path (outline) |
| --- | --- | --- |
| W1 | **Onboarding** | Sign up → personal organization created → empty projects list with "Create project" |
| W2 | **Create project** | Name the project → project overview with no services yet |
| W3 | **Connect GitHub** | Install / authorize the GitHub App → pick one or more repositories for the project |
| W4 | **Add a service** | Choose type (web / worker / scheduled job) → repository, branch, source directory → ForgeOps detects settings → review, override, confirm → env vars, secrets, schedule |
| W5 | **First deployment** | Click Deploy → follow build → rollout → health → managed URL (web services) |
| W6 | **Investigate a failure** | Alert or failed status → deployment detail shows which stage failed (build / rollout / health), the logs, metrics, commit and image |
| W7 | **Recover** | Automatic rollback attempt on failed rollout, with outcome shown; or manual rollback to a chosen previous successful deployment |
| W8 | **Scheduled job runs** | Job runs on schedule → execution history shows each run's status and logs; failed runs alert |
| W9 | **Switch organization** | Pick another organization the user owns → all views scoped to it |

## Primary product journey

1. Sign up (a personal organization is created automatically)
2. Create project
3. Connect one or more GitHub repositories
4. Add services (web services, workers, scheduled jobs): select repository, branch and source directory
5. Review detected build and runtime settings, override where needed, confirm
6. Set environment variables, secrets and (for scheduled jobs) schedules
7. Trigger build and deployment (manually; optionally on push in V1)
8. Follow progress; receive managed URLs for web services and final status
9. Inspect logs, metrics, health and (for scheduled jobs) execution history; receive failure alerts
10. Deploy a new version, roll back manually, or let automatic rollback attempt recovery

## Release boundaries

### V1 — Required

- Authentication (sign-up, login, logout) and organizations with membership-based authorization; one
  `owner` role; multiple organizations per user (PD-008)
- Manual deploys, plus opt-in auto-deploy on push per service (PD-011); trigger recorded for every deployment
- Projects containing multiple services, with single- and multiple-repository support
- GitHub integration
- Service types: web services, background workers, scheduled jobs
- Dockerfile builds (any language) and automatic builds (JavaScript, TypeScript, Python)
- Detected-and-editable service configuration
- Environment variables and secrets
- Deployment to one controlled deployment environment, with ForgeOps-managed URLs for web services
- Deployment progress, status, history, build and deployment logs, commit and image tracking
- Readiness and health checks; separate build, rollout and health outcomes
- Manual rollback and automatic rollback on failed rollout
- Basic CPU and memory metrics, failure alerts and useful failure reporting

### V1.5 — Engineering depth

Team invitations, granular RBAC (admin / developer / viewer), a platform-operator admin UI, deeper observability
beyond basic CPU/memory metrics, resource quotas, staging/production separation, stronger incident
workflows and load testing.

_Change from v1.0:_ "automated rollback policies" moved from V1.5 into V1 as automatic rollback on failed
rollout (PD-006).

### Later

Billing, multi-region deployment, custom domains, per-customer autoscaling policies, advanced GitOps,
marketplace integrations and support for arbitrary untrusted public workloads.

### Not required in V1 (no later commitment made)

Repository-based YAML configuration files; automatic builds for languages other than JavaScript,
TypeScript and Python (those languages can still use Dockerfile builds).

### Explicit non-goal for V1

ForgeOps V1 is a **controlled learning and demonstration platform**, not an unrestricted public hosting
service. Running other people's arbitrary code requires much stronger isolation, abuse prevention, quotas
and operational safeguards. Builds and deployments are limited to trusted repositories.

## Open product questions

Tracked with owners and phases in `docs/DECISIONS.md` (Open decisions) and `docs/CURRENT.md`.
