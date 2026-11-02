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

### Express API bootstrap (1.1.5 + 1.3.1, done)
- **One file, still testable:** `server.ts` exports `app` and only calls `listen()` when run directly
  (`import.meta.main`), so tests can import `app` without opening a port.
- **Express 5 `listen` callback** also receives startup errors (e.g. `EADDRINUSE`, port already in use).
  Ignoring it prints "listening" for a server that failed. Found by testing the failure case.
- **pnpm blocks install scripts** of dependencies by default, a defence against malicious packages. Only allow
  the ones that need them.

### Health checks and tests (1.3.4, 1.3.5, 1.3.9, done)
- **Liveness** (`/health/live`): "is the process running?" If it fails, restart the process.
- **Readiness** (`/health/ready`): "can it serve requests now?" If it fails (503), stop sending traffic
  but don't restart. Until the database exists it returns the same as liveness.
- **Sabotage test:** break the code on purpose and confirm the tests fail. Proves the tests test something.

### Environment validation (1.3.3, done)
- **Env vars** are settings read from outside the code (`PORT`, later `DATABASE_URL`).
- **Fail fast:** check every setting once at startup with a Zod schema; if one is wrong, refuse to start
  with a clear message instead of crashing later on the first request that needs it.
- Error messages name the setting but never print its value, so secrets can't leak into logs.
- `.env.example` documents which settings exist; the real `.env` is never committed.

### Local PostgreSQL with Docker Compose (1.4.1, done)
- **Docker Compose** starts containers from one file (`docker-compose.yml`) with `docker compose up -d`.
- **Port mapping** `127.0.0.1:5433:5432`: the Mac's port 5433 forwards to Postgres's 5432 inside the container,
  and `127.0.0.1` means only this machine can connect, not others on the Wi-Fi.
- **Named volume** (`postgres-data`): where the data lives, so it survives container restarts.
  `docker compose down -v` deletes it.
- **Port conflicts:** two programs can't listen on the same port. `lsof -iTCP:5432 -sTCP:LISTEN` shows who owns it.

### Prisma and the database readiness check (1.4.3, 1.4.5, done)
- **Prisma schema** (`prisma/schema.prisma`) describes the database; `prisma generate` turns it into a
  typed client; **migrations** (`prisma migrate dev`) are versioned SQL changes. No tables yet.
- **Driver adapter** (`@prisma/adapter-pg`): Prisma 7 talks to PostgreSQL through the `pg` driver.
- **Readiness = can I reach the database?** `/health/ready` runs `SELECT 1`; if it fails it returns 503,
  while `/health/live` stays 200, because restarting the API won't fix a stopped database.
- **Generated code isn't committed:** it's rebuilt from the schema on install (`postinstall`).

### Frontend status page (1.1.4, 1.4.6–1.4.8, done)
- **Vite dev proxy:** the page calls `/health/ready` on its own origin (5173) and Vite forwards it to the API
  (4000). Same origin means no CORS setup is needed in development.
- **Three states from one request:** 200 = healthy, 503 = API up but database down, anything else or no
  answer within 3 s (`AbortSignal.timeout`) = API unreachable.
- **Polling every 5 s** lets the page recover by itself when the API or database comes back.
- `useEffect` returns a cleanup that stops the timer when the component unmounts.

### Sign-up, login and sessions (M1-S1 backend, done)
- **Session login:** the server makes a random token, stores only its SHA-256 hash, and puts the token in an
  `HttpOnly` cookie. Every request sends the cookie; the server hashes it and looks the session up.
- **Why hash the token:** someone who steals a database backup can't log in as anyone.
- **Why `HttpOnly` + `SameSite=Lax`:** JavaScript (and so an XSS attack) can't read the cookie, and other
  sites can't make the browser send it on a POST (CSRF).
- **Password hashing with scrypt:** deliberately slow and memory-hungry so guessing is expensive; a random salt
  makes identical passwords hash differently.
- **Same error for "wrong password" and "no such email"**, plus a dummy hash for unknown emails so both take
  the same time. Otherwise attackers can find out which emails have accounts.
- **Transactions:** user + personal organization + membership are created in one write, all or nothing.

### Login screens (M1-S1 frontend, done)
- **The frontend never touches the token.** The cookie is `HttpOnly`; the browser attaches it to every
  same-origin request. Nothing is kept in `localStorage`, where an XSS bug could read it.
- **"Am I logged in?"** = call `/api/me`: 200 shows the account, 401 shows the form.
- **Feature folders:** `src/auth/` holds everything about logging in, mirroring the API's `modules/auth/`.
- **Feedback while waiting:** slow requests (password hashing is slow on purpose) need a visible state
  ("Please wait..."), or users click again.

### Frontend structure: api, hooks, stores, types (done)
- **One API client:** all calls go through one axios instance, so base URL, timeout and error handling are
  configured once. An **interceptor** runs on every response, here turning errors into readable messages.
- **Custom hook (`useRequest`):** wraps any API call with `isLoading` and `error`, so every form behaves
  the same without repeating `useState` code.
- **Zustand store:** shared state (who is logged in) that any component can read without passing props down.
  Local state (which tab of a form is open) stays in `useState`.
- **Tailwind:** style with small utility classes in the markup (`rounded-md px-3 py-2`) instead of CSS files.

### Naming states with TypeScript (done)
- **`void`** means "returns nothing useful". It is a real type and TypeScript enforces it. The type that turns
  checking off is **`any`**, which lint rejects.
- **Discriminated union:** `{ status: "loading" } | { status: "guest" } | { status: "signed-in"; me: Me }`.
  Each state is named, and `session.me` only exists after `status === "signed-in"` is checked, so impossible
  states (signed in with no user) can't be written. Clearer than `Me | null | undefined`.

### Connecting GitHub (M1-S3, done)
- **GitHub App vs OAuth App:** an App is installed on chosen repos with fine-grained permissions and acts as
  itself; an OAuth App acts as the user with broad scopes. ForgeOps uses an App (least privilege).
- **App JWT → installation token:** ForgeOps signs a 10-minute JWT with the App's private key (RS256), trades it
  for a 1-hour installation token, and uses that to read repos. No long-lived token is stored.
- **`state` parameter:** a random value in a short-lived cookie that must come back unchanged from GitHub, so a
  forged callback link is rejected.
- **Never trust ids from the URL:** `installation_id` is checked with GitHub (`/user/installations`), and a repo
  is checked with `/repos/{repo}/installation`, because installation tokens can read any public repo.

### Projects, services and encrypted env vars (M1-S3 backend, done)
- **Validate at the boundary:** Zod checks shape (port range, folder without `..`, slug names) before any work;
  then GitHub, the source of truth, confirms the repo, branch and Dockerfile exist. Mistakes fail at save time,
  not three days later at deploy time.
- **AES-256-GCM:** symmetric encryption that also detects tampering (the auth tag). A fresh random IV per value
  means equal values encrypt differently. The key stays in a file outside the repo; the database only ever holds
  ciphertext, and the API returns names, never values (write-only secrets).
- **Tenant scoping in queries:** every lookup filters by the user's organization ids
  (`where: { id, project: { organizationId: { in: ids } } }`), so another tenant's id simply isn't found (404).

### Deployment intent, outbox and the worker (M1-S4, done)
- **202 Accepted:** the API records the request and answers at once; the slow work happens in the worker. The
  client polls `GET /api/deployments/:id` to watch progress.
- **Idempotency-Key:** a one-time key per click. The same key for the same service returns the same deployment, so
  a retried request can never create a second one. Enforced by a unique index, not just application code.
- **One active deployment per service:** `activeServiceId` is unique and only set while a deployment is active, so
  PostgreSQL refuses a second one (409). Cleared when the deployment finishes.
- **Transactional outbox:** the deployment row and an outbox row ("please run 01a2") are saved in one transaction.
  A relay later moves outbox rows to RabbitMQ. It fixes the dual-write problem: saving to Postgres and publishing
  to RabbitMQ can't be one transaction, so a crash in between would lose the message.
- **`FOR UPDATE SKIP LOCKED`:** lets several relays read the outbox at once without two of them taking the same row.
- **Publisher confirms:** RabbitMQ tells the sender "stored". Only then is the outbox row marked sent.
- **At-least-once delivery, ack and redelivery:** a delivered message stays unacked until the worker acks it after
  finishing. If the worker dies first, RabbitMQ puts it back. So every message can arrive more than once.
- **Idempotent worker:** the worker claims with `WHERE status IN ('queued','running')`, so a duplicate for a
  finished deployment does nothing.
- **Retry classification and exponential backoff:** a 404 branch is permanent (fail now); other GitHub errors are
  transient (retry after 1 s, 2 s, 4 s). A failed job is still acked; retrying is the user's choice.
- **Dead-letter queue:** a message that keeps crashing the handler moves to `deployments.dead` after 5 deliveries
  instead of looping forever.
- **Build, rollout and health are separate outcomes:** "did it build?", "did it start and take over the URL?",
  "is it still working?". Each failure points at a different fix (code, settings, runtime bug). Only a health
  failure after a successful rollout triggers automatic rollback.

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

### M1-S3 — Connect and configure
1. *How do you stop a user deploying someone else's private repo?* Never trust the repo name or installation id the
   client sends. Ask GitHub which installation covers the repo and compare it with the one linked to the user's
   organization. Testing against real GitHub showed that "can my token read it?" isn't enough: installation tokens
   can read every public repo.
2. *How do you store customer secrets?* Encrypted at rest with AES-256-GCM, key outside the database, values never
   returned by the API (write-only). Updates merge by name because clients can't read values back. Next steps:
   key rotation with a key id, and a managed KMS in the cloud.
3. *Why validate a deploy configuration when it's saved, if the build checks again anyway?* Fast feedback: a typo in
   a branch name is caught in seconds instead of in build logs days later. The build still re-checks because the
   repo can change in between.

### M1-S4 — Deployment intent and progress
1. *How do you make sure a deploy request is never lost, even if the server crashes?* Save the deployment and an
   outbox message in one transaction, then let a relay publish the outbox to the queue and mark it sent only after
   the broker confirms. A crash at any point either rolls back both rows or leaves the message to be sent later.
2. *Your queue delivers at least once. How do you stop a deployment running twice?* The worker reads the state
   from PostgreSQL and only claims a deployment that is still queued or running; a duplicate for a finished one is
   skipped and acked. The ack comes last, so a crash means "try again", never "lost".
3. *Two people click Deploy at the same moment. What happens?* Both requests try to insert; the unique index on
   the active-deployment column lets exactly one win. The other gets 409, unless it carried the same
   Idempotency-Key, in which case it gets the same deployment back.
