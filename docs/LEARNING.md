# ForgeOps — Learning & Interview Notes

Concise explanations of concepts encountered while building ForgeOps, plus interview questions per task.
Organized by phase. Each entry: concept → plain explanation → where it shows up in ForgeOps.

> Status: so far these are concepts **discussed during planning**. No code has been written, so nothing
> here has been implemented or practised hands-on yet.

## Phase 0 — Product discovery and architecture

### Problem statement vs solution (0.1.1)
- **Problem statement:** who is hurting, and why. It shouldn't mention technology. "Can't recover from a bad
  deploy" is a problem; "Kubernetes-based rollback" is a solution.
- **Lead message:** the one thing the product is judged on. It decides what gets polished first and what
  the demo shows. ForgeOps leads with *reliability*: detect, diagnose and roll back.
- **Scope decisions change, and the docs must follow.** An early draft said "any language, but only with a
  Dockerfile". The confirmed decision (PD-002, PD-004) is broader: Dockerfile builds for any language
  **plus** automatic builds for JavaScript, TypeScript and Python. The old position is marked superseded
  in `DECISIONS.md` rather than silently deleted.

### Concepts raised by the Phase 0.1.1 decisions (discussed, not yet built)
- **Two inputs, one pipeline:** Dockerfile and automatic builds both end in a container image; everything
  after that (rollout, health, rollback) is shared. The image is the contract between "build" and "deploy".
- **Detection suggests, the developer confirms:** guessing wrong silently is worse than asking. Ambiguous
  detection must stop and ask for explicit settings.
- **Build vs rollout vs health:** "the image built" ≠ "the new version started" ≠ "the app actually works".
  Merging them into one "success" flag hides where a failure happened.
- **Automatic rollback is an attempt:** rolling back code doesn't roll back data. A destructive migration or
  a dead dependency can make the old version fail too, so the outcome must be recorded, not assumed.
- **Milestone vs release:** M1 proves one path end to end; V1 is the full approved scope.

### Framework vs library (ADR-003)
- **Express** is a small library for routing and middleware: you decide the structure.
- **NestJS** is a framework built on top of Express: it decides the structure for you (modules, DI, decorators).
- **Middleware** is a function that runs in order on every request (`(req, res, next)`). Logging, auth,
  validation and error handling are all middleware in Express. Order matters, and the error handler goes last.
- **Composition root** is the one place where the app's dependencies (DB client, services) are created and
  passed in. Doing it by hand is "manual dependency injection", and it's what makes services easy to test.

### Ports and adapters (ADR-006)
- **Port:** an interface the app owns, e.g. `JobPublisher.publish(job)`. The app only knows this.
- **Adapter:** a class that implements the port for one provider (`RabbitMqPublisher`, `SqsPublisher`).
- **Why:** swapping providers means writing a new adapter, not editing business logic.
- **Trap:** abstracting everything "just in case". Only abstract what really changes. A Postgres URL is
  config, not an adapter.
- **Contract tests:** one test suite, run against every adapter, proves they behave the same.

### Concepts raised by the Phase 0.1.2 decisions (discussed, not yet built)
- **Authentication vs authorization:** authentication = *who are you?* (login). Authorization = *what are
  you allowed to touch?* (membership check on every request).
- **Multi-tenancy:** many customers (organizations) share one system, and each must only see its own data.
- **IDOR (insecure direct object reference):** changing `/projects/42` to `/projects/43` and seeing someone
  else's project. Prevented by always filtering queries by organization, and tested by trying exactly that.
- **Design for the next step, build only this one:** memberships store a `role` now, but V1 only uses
  `owner`. Cheap to add, saves a redesign, and doesn't build unused features.
- **Attribution:** recording *who or what* started each deployment turns "something changed" into
  "this push by this person, at this time".

### Stack choices (ADR-002, ADR-004, ADR-005, ADR-023; discussed, not yet built)
- **SPA vs server rendering:** a single-page app sends the browser static JavaScript, which then calls the
  API. Server rendering (Next.js) builds HTML on a server per request, which helps SEO and first paint on
  public pages. A logged-in dashboard rarely needs it, so an SPA keeps one backend instead of two.
- **ORM:** a library that maps database tables to code objects. Prisma gives a schema file, a generated
  type-safe client and **migrations**: versioned files that change the database step by step, kept in Git.
- **Monorepo + workspaces:** several apps in one Git repo. pnpm workspaces let `apps/api` import
  `packages/shared` as if it were an installed package, without publishing it.

## Phase 1 — Foundation

### Git repository setup (1.1.1, done)
- **Commit:** a saved snapshot of the project with a message saying what changed and why.
- **`.gitignore`:** files git must never track: `node_modules/` (reinstallable), build output, and **`.env`
  files (secrets)**. A secret that gets committed stays in the git history even after you delete the file;
  the fix is to rotate (replace) the secret, not just delete it.
- **Remote (`origin`):** the copy on GitHub. `push` sends local commits there.
- **`.nvmrc`:** pins the Node version for the project, so everyone (and CI later) uses the same one.

### TypeScript, ESLint, Prettier (1.1.3, done)
- **TypeScript compiler (`tsc`)** checks types; **ESLint** catches risky patterns (unused vars, `any`);
  **Prettier** only formats. Three tools, three jobs.
- **Shared base config:** apps extend `tsconfig.base.json`, so strictness is defined once.
- **Peer dependency:** a package saying "I only work with versions X–Y of another package". That's why we
  pinned TypeScript 6.0: typescript-eslint doesn't support 7 yet.

## Interview question bank

### 0.1.1 — Problem statement
1. *Why build this when Vercel, Render and Railway exist?* It runs on infrastructure you own, its
   internals (queue, state machine, rollback) are visible, and it's reliability-first. It's also honestly
   a learning platform: the value is being able to design, break and recover it.
2. *How do you support many languages?* Two build methods. A Dockerfile build works for any language
   because the container image is the interface between the user's code and the platform. Automatic
   builds cover a deliberately small set (JavaScript, TypeScript, Python) with tested conventions, because
   detection is only trustworthy where we have defined and tested the rules.
3. *Why lead with reliability instead of deployment?* Deploying is a solved, commodity problem.
   Recovery is where real systems fail and where the hard engineering is: state, idempotency,
   rollout tracking and observability.
4. *Your platform has automatic rollback. Does that mean failed deploys always recover?* No. It's a recovery
   attempt. If the bad release ran a destructive database migration, or a dependency is down, the previous
   version can fail too. We record the attempt and its outcome, and design migrations to be backward-compatible.

### 0.1.2 — Personas and access control
1. *How do you stop one customer seeing another's data?* Every resource belongs to an organization; every
   request checks membership first and every query filters by organization, so other tenants' resources
   return "not found". Tests try cross-organization access directly.
2. *Why only one role in V1?* Roles and invites are a whole feature (invites, revocation, permission
   matrices). One `owner` role still proves tenant isolation. The membership table already has a `role`
   column, so adding roles later is new rules, not a redesign.
3. *Why require real login for the first milestone?* Adding authorization later means auditing every
   endpoint for missing checks, a classic source of security bugs. And a platform that builds code from
   GitHub must never have an open control plane.
