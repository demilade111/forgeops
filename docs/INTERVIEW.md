# ForgeOps — Interview Prep

How to talk about ForgeOps in an interview: **why each tool**, **what it costs**, **what happens when things
break**, and **questions with short answers**. Updated at the end of every slice. Only what is actually built is
described as built; anything else is marked _(planned)_.

Problems hit while building, as STAR stories, are in `ISSUES.md`. The full reasoning for every choice is in
`DECISIONS.md`.

---

## The 30-second pitch

"ForgeOps is a deployment platform I'm building: connect a GitHub repo, click Deploy, and it builds, runs and
watches your service, with rollback when a release goes bad. It's reliability-first: the interesting parts are
what happens when things fail. Deploys go through a transactional outbox and a RabbitMQ queue to an idempotent
worker, so a crash never loses or doubles a deploy. It's an Express and TypeScript modular monolith with a separate
worker, PostgreSQL through Prisma, a React dashboard, and a least-privilege GitHub App for repo access."

**Built so far (M1-S0 to M1-S4):** accounts and organizations, GitHub App connection, projects and services with
encrypted env vars, and the Deploy pipeline up to "resolve the commit". Builds, containers, health checks and
rollback are next.

---

## 1. Architecture: modular monolith plus a worker

**Why this:** one developer, many features. Microservices would mean network calls, distributed data and a lot of
ops work for no benefit yet. A plain monolith would run slow deploy work inside HTTP requests. So: one API codebase
split into feature modules (`auth`, `github`, `projects`, `deployments`), plus a **separate worker process** for
slow jobs. They share code but run, crash and scale independently.

**Trade-off:** module boundaries are kept by discipline (each module's repository is the only place that touches
its tables), not by network walls. If a module ever needs to be its own service, those boundaries make the split
possible.

**What happens when...**
- **A deploy takes 5 minutes?** The API answers 202 in milliseconds; the worker does the slow part.
- **The worker crashes?** The API keeps serving. Unfinished jobs come back from the queue when the worker restarts.

**Q: Why not microservices?** _Their benefits (independent teams, independent scaling per service) don't apply to
one developer. Their costs (network failures between services, distributed transactions, many deploy pipelines) do.
A modular monolith keeps the option open._

---

## 2. Backend: Node.js, Express 5, TypeScript

**Why this:** Express is minimal and the most widely used Node framework, so I design the layering myself (routes,
repositories, validation, errors) and can explain the whole request lifecycle. Express 5 passes errors from async
handlers to the error middleware, which removes Express 4's biggest pitfall.

**Alternatives:** NestJS (structure and dependency injection out of the box, but hides the mechanics behind
decorators); Fastify (faster, schema-first, smaller ecosystem).

**Trade-off:** no framework enforces structure, so review has to catch drift. Dependencies are wired explicitly at
startup (`createApp({ db, github, encryptionKey })`), which makes tests simple: pass in a fake.

**Validation:** Zod at the boundary; every error is `{ error: { code, message } }` with a stable code the frontend
can branch on and a plain-English message. Stack traces never reach the client.

**Q: How do you handle errors?** _Handlers throw an `HttpError(status, code, message)`; one error middleware turns
it into JSON. Anything unexpected becomes a generic 500 and is logged on the server, so internals never leak._

---

## 3. Frontend: React, Vite, TypeScript (single-page app)

**Why this:** the dashboard is only used after login and needs no SEO, so server rendering adds nothing. A Vite SPA
is static files talking to one Express API: one backend, a clear API boundary.

**Alternative:** Next.js, which would run a second Node server beside Express (two backends).

**Q: Why not Next.js?** _Its main wins are server rendering and SEO. A logged-in dashboard needs neither, and I'd
end up with two backends to secure and deploy._

---

## 4. Database: PostgreSQL with Prisma

**Why PostgreSQL:** deployments need real transactions (the outbox) and unique constraints (idempotency, the
one-active-deployment lock). These are correctness guarantees enforced by the database, not by hopeful code.

**Why Prisma:** one schema file, generated type-safe client, versioned migrations. Prisma calls live only in each
module's repository layer. Raw SQL is used where Prisma can't express something, for example `FOR UPDATE SKIP
LOCKED` in the outbox relay.

**Alternative:** Drizzle (closer to SQL, lighter). MongoDB was never a fit: the core of the product is transactional.

**IDs:** UUIDv7: not guessable like 1, 2, 3, and time-ordered so inserts stay index-friendly (unlike random v4).
Cost: 16 bytes instead of 8.

**Q: Why is the uniqueness rule in the database and not just in code?** _Two requests can both check "is there one
already?", both see no, and both insert. Only a unique index makes that race impossible._

---

## 5. Authentication: server-side sessions, not JWT

**Why this:** one browser app, one API, one database. A session is a random token in an `HttpOnly` cookie; the
database stores only its SHA-256 hash. Logout deletes the row and access ends instantly.

**Alternative:** JWT. Good when many services must verify identity without a shared store. Bad here: a stolen JWT
stays valid until it expires unless you add a blocklist, which is a session table again.

**Passwords:** scrypt from Node's `crypto` (OWASP-recommended, memory-hard, no native dependency), random salt per
password, constant-time comparison. argon2 and bcrypt need native add-ons; bcrypt also truncates at 72 bytes.

**What happens when...**
- **The database leaks?** Session tokens are stored hashed, so they can't be replayed; passwords are scrypt hashes.
- **Someone's cookie is stolen?** Delete their sessions and it stops working immediately. That's the main reason for
  sessions over JWT.
- **A malicious site tries to POST as the user (CSRF)?** `SameSite=Lax` keeps the cookie off cross-site POSTs, and
  write endpoints only accept `application/json`, which a plain HTML form can't send.
- **Login is brute-forced?** scrypt makes each guess slow. Rate limiting is _(planned)_ (2.2.9).

**Q: Sessions or JWT, and why?** _Sessions, because I need instant revocation for a tool that can deploy code. The
cost is one indexed lookup per request, which is fine at this scale and cacheable later._

---

## 6. Multi-tenancy: everything belongs to an organization

**How:** every query filters by the user's organization ids, for example
`where: { id, project: { organizationId: { in: ids } } }`. Another tenant's resource is simply "not found".

**Why 404, not 403:** a 403 confirms the resource exists. A 404 leaks nothing.

**What happens when a user guesses another tenant's deployment id?** 404, and tests try exactly that for every route.

**Q: How do you make sure you never forget the tenant check?** _It's part of the repository query itself, not a
separate "if" in the route, and every route has a cross-organization test. My sabotage tests remove the filter on
purpose to prove a test fails._

**Q: Why only one role (`owner`) in V1?** _Roles and invites are a whole feature (invites, revocation, permission
matrices). One role still proves tenant isolation, and the role already lives on the membership row, so adding
roles later means new rules, not a redesign._

---

## 7. GitHub integration: a least-privilege GitHub App

**Why a GitHub App:** fine-grained, read-only permissions, installed only on the repos the user picks, short-lived
tokens, revocable by the user. Alternatives: an OAuth App (acts as the user with broad scopes like write access to
every repo) or personal access tokens (tied to one person, rotated by hand).

**How it authenticates:** ForgeOps signs a 10-minute JWT with the App's private key (RS256, Node `crypto`, no
Octokit), exchanges it for a 1-hour installation token, and uses that to read repos. No long-lived token is stored.

**What happens when...**
- **Someone types another user's `installation_id` into the callback URL?** Rejected: the installation must appear
  in that GitHub user's own installation list and belong to our App id, and a random `state` cookie stops forged
  callbacks.
- **Someone configures a public repo they don't own?** Rejected. Testing against real GitHub showed installation
  tokens can read any public repo, so the check is "which installation covers this repo?", compared with the
  organization's own (ISS-030).
- **The App's private key leaks?** Rotate it in GitHub settings; the old key stops working. It happened once, before
  first use (ISS-026). Keys live outside the repo with `600` permissions; `.env` holds only the path.
- **The branch typed in the form doesn't exist?** 400 at save time, not a failure days later at deploy time.

**Q: Why validate a service's repo, branch and Dockerfile when it's saved, if the deploy checks again anyway?**
_Fast feedback: a typo is caught in seconds instead of in build logs later. The deploy still re-checks because the
repo can change in between (a deleted branch fails the deployment with a clear reason)._

**Q: Why not use Octokit?** _I needed four GitHub calls. Signing the JWT myself is about 15 lines and keeps the auth
flow visible and testable. I'd switch when I need pagination, rate-limit handling and token caching._

---

## 8. Secrets: env vars encrypted at rest

**How:** a service's env vars are JSON-encoded and encrypted with AES-256-GCM (Node `crypto`), stored as
`iv.authTag.ciphertext`. The key is a file outside the repo. The API returns names only, never values.

**Why GCM:** it encrypts and also detects tampering or a wrong key (the auth tag). A fresh random IV per value
means two equal values encrypt differently.

**What happens when...**
- **The database leaks?** Attackers get ciphertext; even the variable names are hidden.
- **The key file is lost?** Every stored value is lost; users re-enter them. That's why the key is backed up
  separately from the database.
- **A user wants to see a saved value?** They can't (write-only secrets). Updates merge by name: a string sets,
  `null` deletes.
- **When are values decrypted?** Only by the worker when it starts a container _(planned, M1-S6)_, only in memory.

**Q: What would you do in production?** _Move the key to a managed KMS or Secrets Manager, add a key id prefix so
keys can rotate, and bind each ciphertext to its row so blobs can't be swapped between services._

---

## 9. Deployments: outbox, RabbitMQ and an idempotent worker (M1-S4)

**The flow:** Deploy click → `POST /api/services/:id/deployments` saves the deployment **and** an outbox row in one
transaction → 202 → the relay (inside the worker) publishes the outbox row to RabbitMQ and marks it sent after
RabbitMQ confirms → the worker claims the deployment, asks GitHub for the branch's commit, saves the result and the
step, then acks.

### Why each tool
| Choice | Why | Alternatives and their cost |
| --- | --- | --- |
| **Transactional outbox** | saving to Postgres and publishing to RabbitMQ can't be one transaction; the outbox turns "publish" into a database row saved with the deployment | publish directly after saving (a crash in between loses the deploy); pg-boss (queue in Postgres, no outbox needed, but less to learn and harder to swap for SQS later) |
| **RabbitMQ locally, SQS in the cloud** _(SQS planned)_ | a real broker with ack, redelivery and dead-lettering; free locally | BullMQ + Redis (another stateful store); Kafka (built for event streams and replay, far more ops than a job queue needs) |
| **amqplib** | the standard low-level client; I see every ack and confirm | `rabbitmq-client` (auto-reconnect), `amqp-connection-manager` (a wrapper). I chose exit-and-restart over reconnect logic |
| **Quorum queue** | RabbitMQ 4's durable, replicated queue type; supports a delivery limit | classic queues (no delivery limit, older replication model) |
| **Publisher confirms** | the outbox row is marked sent only after RabbitMQ has stored the message | fire-and-forget publishing (a broker crash can drop it) |
| **Idempotency-Key (required)** | a retried request returns the same deployment | optional key (retries without it could double-deploy) |
| **`activeServiceId` unique lock** | the database itself refuses a second active deployment | an app-level "if running" check (racy); a partial unique index (Prisma can't express it) |
| **Worker in `apps/api`, separate process** | shares config, schema and repositories with no duplication | a separate package (duplicated wiring); inside the API process (a slow job starves HTTP) |

### What happens when...
| Situation | What ForgeOps does |
| --- | --- |
| The user double-clicks Deploy, or the browser retries after a timeout | Same Idempotency-Key, so the same deployment comes back (202). One row, one message. |
| A second Deploy with a new key while one is running | 409 `DEPLOYMENT_IN_PROGRESS`, naming the running deployment. |
| Two requests race at the same instant | The unique indexes let exactly one insert win; the other gets the same deployment (same key) or 409. Tested with parallel requests. |
| The API crashes right after the commit | Both rows are saved. The relay still finds the outbox row and sends it. |
| The worker (and relay) is down | The outbox row waits with `sentAt` empty. When the worker starts, it is sent. Tested for real: it waited 9 seconds, then succeeded. |
| RabbitMQ is down | Publishing fails, the relay's transaction rolls back, the row is retried every second. A running worker exits and is restarted. |
| The relay publishes but crashes before marking the row sent | The message is sent again later: a duplicate. The worker skips it because the deployment is already finished. |
| The worker crashes mid-job | No ack, so RabbitMQ redelivers. The deployment is still `running`, which the claim accepts, so it resumes. |
| The worker finishes but crashes before the ack | Redelivered. The worker reads `succeeded` and skips it. Idempotent worker. |
| GitHub is down or slow | Retried after 1 s, 2 s and 4 s. Still failing: `failed`, "GitHub did not respond. Try deploying again." Lock released. |
| The branch was deleted | 404 is permanent: `failed` with "Branch X not found in Y". No retries. Acked anyway; retrying is the user's call. |
| A message keeps crashing the handler (bug, DB down) | Requeued up to 5 deliveries, then moved to `deployments.dead` instead of looping forever. |

### "Walk me through what happens when I click Deploy" (60-second answer)
"The browser sends a POST with an Idempotency-Key. The API checks you're logged in and that the service belongs to
your organization. Then, in one transaction, it saves a deployment row with status `queued` and an outbox row
saying 'run this deployment', and answers 202 straight away. A relay inside the worker picks up unsent outbox rows
every second, publishes them to a RabbitMQ quorum queue, waits for RabbitMQ to confirm, and marks them sent. The
worker takes one message at a time, claims the deployment by moving it from `queued` to `running` in Postgres,
asks GitHub which commit is on the branch, and saves the commit SHA and the step result. It releases the lock and
acks last, so a crash anywhere before that just means the message comes back and the job is resumed or skipped."

### Real evidence from building it (M1-S4)
- 92 API tests, including a real RabbitMQ redelivery test and a full outbox-to-worker run.
- Seven sabotage tests: a claim that accepted finished deployments, ack before the work, no outbox row, no lock, a
  lock never released, a relay that never marked rows sent, and an unscoped read. All seven were caught.
- A real run against GitHub: deployed with the worker off, the message waited in the outbox, then the deployment
  succeeded with the real commit on `main`; a deleted branch failed with a clear reason; restarting RabbitMQ made
  the worker exit; SIGTERM stopped it cleanly.
- Stories to tell (STAR in `ISSUES.md`): **ISS-033**, my smoke-test script reported failures for a deployment that
  had succeeded ("check the checker first"); **ISS-032**, the local database was wiped and I rebuilt the setup
  without exposing credentials ("local data is disposable; keep a repeatable seed").

### Known limits (say these before the interviewer finds them)
- A dead-lettered message used to leave its deployment `running` with the lock held; M1-S5 added a sweeper that
  fails deployments running over 60 minutes.
- Resuming a `running` deployment is only safe with one worker; more workers need a lease (worker id + heartbeat).
- ADR-006's queue interface and SQS adapter come with the cloud phase; today `connectQueue` is that interface.

### Questions
**Q: How do you make sure a deploy is never lost?** _Deployment and outbox row in one transaction; a relay publishes
with publisher confirms and only then marks the row sent. Any crash either rolls both back or leaves the row to be
sent later._

**Q: RabbitMQ delivers at least once. How do you stop a double deploy?** _The worker never trusts the message, only
Postgres. It claims with `UPDATE ... WHERE status IN ('queued','running')`; a duplicate for a finished deployment
updates zero rows and is skipped. The ack is the last thing it does._

**Q: Why not exactly-once delivery?** _Across a network it isn't really achievable: either you might lose a message
or you might deliver it twice. I choose "twice" and make handling twice harmless._

**Q: Why ack a failed deployment?** _The job was handled: it looked, it failed, it recorded why. Not acking would
redeliver it forever and fail the same way every time._

**Q: Why `FOR UPDATE SKIP LOCKED` in the relay?** _So overlapping relay runs, or several workers, never take the
same outbox row. Each one skips rows another has locked._

**Q: Why exit on a lost RabbitMQ connection instead of reconnecting?** _Less code and no half-broken channel state.
Whatever supervises the worker (a terminal now, Docker or Kubernetes later) restarts it, and RabbitMQ redelivers
anything unacked._

---

## 10. Testing

**Real PostgreSQL and RabbitMQ in tests, not mocks:** a mock can't catch a unique-constraint race, a transaction
mistake or a broker that redelivers. Tests run against a separate `forgeops_test` database and a throwaway queue
per test. GitHub is faked in tests and hit for real in manual smoke runs.

**Sabotage tests:** after the tests pass I break each protection on purpose (remove the tenant filter, ack before
the work, drop the outbox row, never release the lock) and confirm a test fails. If none fails, the test was
decoration.

**Q: How do you know your tests actually protect anything?** _I break the code on purpose and check they fail. In
M1-S4, seven sabotages were each caught; in M1-S5, eleven._

---

## 11. Build and push: from commit to image (M1-S5)

**The flow:** after `resolve-commit` pins the SHA, the worker runs three more steps, each with its own step row:
- **fetch-source:** downloads GitHub's tarball of that exact commit with the installation token into a fresh
  per-deployment folder, unpacks it and finds `<source directory>/Dockerfile`.
- **build:** runs `docker build` (BuildKit) on that folder and saves the build log.
- **push:** pushes the image to the registry and stores its digest reference on the deployment. The folder is then
  deleted.

### Why each tool
| Choice | Why | Alternatives and their cost |
| --- | --- | --- |
| **GitHub tarball, not `git clone`** | one HTTP call, files only, no `git` binary, token never written to disk | `git clone` (needed only for submodules or Git LFS; history and token handling to manage) |
| **System `tar`** | already installed; refuses `..` paths and writing through symlinks by default | the `tar` npm package (another dependency to keep patched) |
| **Docker Engine + BuildKit on the worker's machine** | free, already installed, the builder most platforms use, layer cache for free | rootless BuildKit or Kaniko (safer for untrusted code, more setup); CodeBuild or Cloud Build (isolated and scalable, but paid) |
| **`docker` CLI as a child process** | its output is the build log users expect; no library | `dockerode` (Docker Engine API, more control, a dependency and more code); `buildctl` (BuildKit directly) |
| **Local `registry:3`** | free, the real push, pull and digest flow; moving to ECR only changes the address | GHCR, Docker Hub (accounts and quotas), ECR (paid); no registry (works on one machine but loses rollback by digest) |
| **Store the digest, not the tag** | a digest can't change, so "what is running?" and "roll back to what?" have exact answers | tags like `latest` (can be moved, so the record can lie) |
| **Step logs in a database column (last 64 KiB)** | simplest place the status API can return; the end of a log is where errors are | a log-lines table or object storage (S8 can revisit) |

### What happens when...
| Situation | What ForgeOps does |
| --- | --- |
| The app's code doesn't compile | `build` fails: "Build failed with exit code 1. See the build log." The log holds the compiler error. Nothing is pushed and the running version is untouched. |
| A build hangs | Killed after 15 minutes: "Build took longer than the time limit. See the build log." |
| The commit has no Dockerfile in the source directory | `fetch-source` fails: "No Dockerfile at api/Dockerfile in f2edcd7". |
| The repo makes the source directory a symlink to `/` | Refused: the resolved path must stay inside the unpacked code. Tested. |
| A crafted archive contains `../../etc/x` | `tar` refuses the entry; nothing lands outside the folder. Checked by hand. |
| The repository was removed from the GitHub App installation | The installation token can't open it: "Commit X not found in Y". |
| GitHub's download fails halfway | Retried like other GitHub calls (1 s, 2 s, 4 s); every GitHub request now has a 2-minute limit. |
| Docker isn't running when the worker starts | The worker refuses to start: "Docker is not available." Better than failing every deployment later. |
| The registry is down | `push` fails: "Could not push the image to the registry", with the push log. The user deploys again. |
| The worker crashes mid-build | Redelivered; the deployment resumes with the commit it already pinned and rebuilds (mostly from cache). |
| A message dead-letters and the deployment is stuck `running` | The sweeper fails it after 60 minutes and releases the lock, so the user can deploy again. |

### "What happens after the commit is pinned?" (30-second answer)
"The worker downloads the tarball of that exact SHA with a short-lived, read-only installation token into a fresh
folder, unpacks it and checks the Dockerfile is inside the service's source directory. It runs `docker build`, so
BuildKit builds the image with layer caching, and saves the log on the build step. Then it pushes to the registry
and records the digest, the image's immutable fingerprint, on the deployment. Every command has a time limit, the
folder is always deleted, and a failed build never touches the running version."

### Real evidence (M1-S5)
- 103 API tests; builds and pushes run against the real local Docker and registry, not mocks.
- Eleven sabotage tests, all caught: no tag cleanup after push, no symlink containment, time-out not detected, digest not parsed, workspace not
  cleaned, a resumed deployment resolving the branch again, build log not saved, failed step log dropped, image not
  recorded, sweeper keeping the lock, sweeper failing fresh deployments.
- Real run: `demilade111/forgeops-sample-api` at `f2edcd7` was fetched, built and pushed in 22 seconds. I deleted
  the local copy, pulled the image back **by digest**, ran it, and it answered 200 on `/` and `/health/ready` as the
  non-root `node` user.
- Stories: **ISS-034**, a time-out was reported as a normal failure because the Docker CLI exits with 130 when
  stopped ("don't infer why a process stopped from its exit code"); **ISS-035**, the local database was wiped a third
  time, so the smoke test now creates its own data.

### Known limits
- Builds use the host's Docker, which is close to root: fine for my own trusted repos, not for strangers' code.
  Before that: rootless BuildKit or a managed builder, plus CPU and memory limits.
- No submodules or Git LFS. A disk-full error while saving the download is reported as a GitHub problem.
- The registry has no login and plain HTTP; it only listens on localhost.

### Questions
**Q: What's the difference between an image and a container?** _An image is the frozen package: OS, runtime,
dependencies, code and start command. A container is a running copy of it. One image can run as many containers._

**Q: Why push to a registry if you build and run on the same machine?** _So any server can pull it, old versions
stay available for rollback without rebuilding, and the deployment records an immutable digest. It also makes moving
to a cloud registry a configuration change._

**Q: Tag or digest?** _A tag is a label that can be moved to another image; a digest is a hash of the content and
can't change. I deploy and roll back by digest, the same reason I pin a commit SHA instead of a branch._

**Q: How do you stop a repository from escaping the build folder?** _`tar`'s defaults refuse `..` paths and writing
through symlinks, and I resolve the build context and Dockerfile with `realpath` and require them to stay inside the
unpacked folder. A test points the source directory at `/` with a symlink and expects a refusal._

**Q: Why not run builds in the API process?** _Builds take minutes and lots of CPU. In the worker they don't block
HTTP requests, and a crash is recovered by queue redelivery._

**Q: How would you build other people's code safely?** _Not with the host's Docker socket. I'd use rootless BuildKit
or a managed builder with a fresh machine per build, CPU, memory and time limits, no network access to internal
services, and secrets passed only as build secrets that never land in the image._

---

## 12. Run and expose: from image to URL (M1-S6)

**The flow:** after `push`, two more steps:
- **run:** decrypt the service's env vars into a private file, `docker run` the image by digest as
  `fo-<deploymentId>` on the `forgeops-apps` network.
- **route:** tell Caddy "`api.sample-shop.localhost` goes to `fo-<deploymentId>:8080`", then remove the service's older
  containers. The URL is saved on the deployment.

### Why each tool
| Choice | Why | Alternatives and their cost |
| --- | --- | --- |
| **Caddy + admin API** | routes change at runtime with one HTTP call, no reload; single binary; HTTPS later | Traefik (follows Docker labels, but the proxy needs the Docker socket); nginx (reload per change, config templating) |
| **`<service>.<project>.localhost`** | readable, no DNS setup, no ports in URLs, one name per service | path-based (breaks apps with absolute links); one host port per service (ugly, leaks into the product) |
| **Host Docker via the CLI** | already used for builds, free, same commands I'd type | local Kubernetes (the later target, much more setup); ECS (paid) |
| **Name containers by deployment id** | never clashes across projects or organizations; short enough for Docker DNS | `svc-<service>` (clashes between orgs; old and new can't run side by side) |
| **Env file (mode 600)** | values never appear in `ps` output | `-e NAME=value` (visible to any process listing) |

### What happens when...
| Situation | What ForgeOps does |
| --- | --- |
| The new image can't start (bad command) | `run` fails: "Could not start the container", Docker's error in the step log. The live version keeps serving. Tested. |
| Caddy is down during a deploy | `route` fails: "Could not update the router"; the new container is removed; the old one keeps serving. Tested. |
| Another organization's service wants the same URL | Refused: "api.sample-shop.localhost is already used by another service". Tested. |
| Caddy restarts | Routes come back from its autosave (`--resume`). Checked for real: 200 after restart. |
| Docker restarts | Containers come back (`--restart unless-stopped`); Caddy finds them by name. |
| The app crashes after starting | Not caught yet: the URL returns 502. Readiness checks are M1-S7. |
| Someone visits an unknown name | Caddy's catch-all: 404 "No service at this address". |

### "How does a deployed service get its URL?" (30-second answer)
"After the image is pushed, the worker starts it as a container on a private Docker network, with env vars passed
through a file only it can read. Then it calls Caddy's admin API to add a route: this host goes to that container
and port. Caddy is the only thing listening on port 80, so every service gets a clean name like
`api.sample-shop.localhost`. On a redeploy the new container starts first, the route moves to it, and only then is
the old one removed, so a failed deploy never takes the live version down."

### Real evidence (M1-S6)
- 110 API tests, with real containers and a real test Caddy. Five sabotage tests, all caught: old containers not
  removed, URL collision not checked, new container left behind when routing fails, env vars not passed, URL not
  saved.
- Real run through the API with the seeded account: Deploy 202, then all six steps succeeded for
  `demilade111/forgeops-sample-api` at `f2edcd7`. `curl http://api.sample-shop.localhost` returned
  `{"message":"Hello from the ForgeOps sample API","version":"1.0.0"}` and `/health/ready` returned 200. After a Caddy
  restart it still returned 200. A second deploy left exactly one container, the new one.
- Stories: **ISS-038** (malformed test fixture, found by watching the running system), **ISS-037** (Caddy's
  autosave beat the edited file).

### Known limits
- No readiness check: a crashing release is routed (M1-S7). No connection draining on swap.
- Caddy's admin API has no auth and is reachable from app containers on the same network; fine for trusted repos.
- No CPU or memory limits on containers. No HTTPS. Env var values can't contain line breaks.
- The same project and service name in two organizations can't both be served.

### Questions
**Q: What does a reverse proxy do?** _It's the single entry point. It reads the `Host` header of each request and
forwards it to the right backend, so the apps stay private and get clean names._

**Q: Why not just publish each container's port?** _Users would need `localhost:49213`-style addresses, ports would
change on every deploy, and there's no place to add HTTPS or switch versions. A proxy gives a stable name and lets
me move traffic between containers._

**Q: How do you swap versions without downtime?** _Start the new container next to the old one, move the route, then
remove the old one. If the new one fails to start or the route can't be updated, the old one keeps serving. True
zero-downtime also needs a readiness check before the switch and connection draining, which come next._

**Q: How do secrets reach the container?** _Decrypted only in the worker, written to a file readable only by the
worker, passed with `--env-file`, and deleted with the workspace. Never on the command line or baked into the image._

---

## 13. Readiness and health (M1-S7)

**The idea to explain:** ForgeOps records three separate outcomes, because each failure points at a different fix:
- **Build:** did the code become an image? Fails: your code.
- **Rollout:** did the new version start and take over the URL? Fails: your settings (wrong port, missing env var).
- **Health:** does it answer its health check? Fails: the app is broken or not ready. The old version keeps serving.

**The flow:** after `run`, a new `health` step calls the service's health check path (default `/health/ready`) every
second for up to 60 seconds. Only a 2xx or 3xx answer moves on to `route` (go live).

### Why each tool
| Choice | Why | Alternatives and their cost |
| --- | --- | --- |
| **Readiness check before switching traffic** | a release that can't serve never receives users | check after switching (users hit errors first); no check (the old behaviour) |
| **Temporary Caddy route to reach the container** | reuses the proxy, works on any Docker, no new image | a checker container per deploy (slower, another image); container IP (Docker Desktop can't reach it) |
| **Marker header on app answers** | tells the app's 502 apart from Caddy's own 502 when nothing is listening yet | treat any 502 as "not ready" (an app that really answers 502 would look like it never started) |
| **Container status check each second** | a crashing app fails in a second with its own output, not after 60 seconds | only wait for the timeout (slow, no clue why) |
| **Default `/health/ready`, empty allowed** | matches the sample app and common practice; empty supports apps with no health endpoint | `/` (says the server is up, not that it's ready); required path (blocks simple apps) |

### What happens when...
| Situation | What ForgeOps does |
| --- | --- |
| The app answers `/health/ready` with 200 | Health passes (about 1 second for the sample), then go live. Real run: `GET /health/ready returned 200` in 1.2 s. |
| The path returns 404 or 503 for a minute | Fails: "Your app did not pass its health check within 60 seconds", last answer and app output in the log, new container removed, old version serving. Real run: the URL answered 200 the whole minute. |
| The app crashes on start (missing env var) | Fails at once: "Your app stopped while starting", with the app's own error. Tested. |
| The app listens on the wrong port | Caddy can't reach it, no marker header, so it never counts as an answer: fails after 60 s with "got no answer". Tested. |
| No health path set | Any answer from the app passes, even 404. Tested. |
| Caddy is down | The temporary route can't be added: "Could not update the router". |
| The app breaks an hour after going live | Not watched yet: that is automatic rollback (M1-S10) and alerts (M1-S12). |

### "How do you know a deploy actually works?" (30-second answer)
"Starting a container isn't proof. Before ForgeOps moves traffic, it calls the app's health check path through a
temporary private route, every second for up to a minute. Only a 2xx or 3xx answer counts, and only if it came from
the app itself, not from the proxy. If the app crashes, it fails at once with the app's own output. If it never gets
healthy, the new container is removed and the old version keeps serving, so a bad release never reaches users."

### Real evidence (M1-S7)
- 123 API tests. New ones cover: a path that never passes (old version keeps serving, temporary route removed), a
  crash on start (fails in seconds with the app's output), no path set (any answer passes), an app listening on the
  wrong port (proxy errors don't count), and health path validation.
- Sabotage: accepting any status, or counting the proxy's own errors as answers, failed two tests.
- Real runs with `forgeops-sample-api` at `f2edcd7`: healthy deploy, all seven steps, health 1.2 s, live URL 200.
  Then with the path set to `/nope`: failed after 60 seconds with `GET /nope returned 404` and the app's log; the URL
  answered 200 throughout; one container left, the old one.
- Story: **ISS-042** (my sabotage cleanup with `git checkout` wiped the feature; restored from a backup).

### Known limits
- The 60-second limit and 1-second interval are fixed for now.
- Health after go-live isn't monitored yet (M1-S10, M1-S12). No connection draining on swap.
- A worker crash during a check leaves a harmless temporary route behind.

### Questions
**Q: Liveness vs readiness?** _Liveness says "the process is alive, don't restart me". Readiness says "I can take
traffic now", for example after connecting to the database. ForgeOps checks readiness before go-live; the sample app
has both endpoints._

**Q: Why not just check that the container is running?** _A running process can still be broken: wrong port, failed
database connection, every request erroring. Only an HTTP answer from the app proves it can serve._

**Q: Your platform has automatic rollback. Does every bad deploy recover?** _No. A readiness check stops a bad release
before it gets traffic. Rollback (M1-S10) is for a release that breaks after going live, and it's an attempt: if the
release ran a destructive migration, the old version can fail too. ForgeOps records the outcome._

---

## 14. Logs and history (M1-S8)

**The flow:** three kinds of record, each answering a different question:
- **Step logs:** "what did the build say?" Saved every second while a step runs, so you watch it happen.
- **App logs:** "what is my app printing right now?" The Logs tab reads the live container's output.
- **Deploy page:** "what exactly went out?" Commit, image digest, who triggered it, timings, each step's log.

### Why each tool
| Choice | Why | Alternatives and their cost |
| --- | --- | --- |
| **Save the log every second while running** | the page already polls; no new protocol | WebSockets or server-sent events (real-time, but a second channel to secure and keep open); save only at the end (looks frozen for minutes) |
| **API reads `docker logs` for the live container** | simplest, no new service, real output | worker copies logs into Postgres (table growth, delay); Loki or CloudWatch (the cloud answer, more setup) |
| **Container name from the database** | the request only names a service the user is a member of | taking a container name from the request (could read another tenant's container) |
| **Deploy page with its own URL** | shareable in a chat or incident ticket | expandable rows only (can't link to one deploy) |
| **Image digest, not tag** | the digest is the exact build; a tag can be moved | show the tag (could point at a different build later) |

### What happens when...
| Situation | What ForgeOps does |
| --- | --- |
| A slow build step prints a line, then works for minutes | The line shows within about a second. Tested (ISS-043 was this bug). |
| The live container was removed (Docker reset) | Logs tab: "Your app is not running. Deploy to start it again." Tested. |
| Docker can't be reached | 503 "Logs are not available right now". The page keeps retrying every 3 s. |
| Someone asks for another organization's logs | 404, same as every other service route. Tested. |
| `?lines=5000` | 400; the limit is 1 to 1000. Tested. |
| The app prints a secret | It shows in the Logs tab to members of that workspace. Apps should not log secrets. |

### "How do you debug a failed deploy on ForgeOps?" (30-second answer)
"Open the deploy page. The badges tell me which part failed: Build, Rollout or Health. The failed step has its own
log, for a build that's the Docker output, for a health check it's the last answer and the app's own output. The page
also shows the exact commit and image, so I know precisely what was running. If it got live and broke later, the Logs
tab shows what the app is printing right now."

### Real evidence (M1-S8)
- 126 API tests. New: build log saved while the build runs (real Docker), live app output with timestamps through
  the API, container gone, empty logs before the first deploy, `lines` validation, other organizations get 404,
  deploy detail includes trigger and service but never env vars.
- Sabotage: turning off streaming and reading the wrong container both failed tests.
- Browser: Logs tab showed `Sample API listening on port 8080` with its time; the deploy page showed commit, image
  digest, timings and the three badges. A real deploy through the restarted worker succeeded and served 200.
- Story: **ISS-043** (a flaky test that was a real bug).

### Known limits
- Only the live container's logs, only what Docker keeps; no search; old logs go with the old container.
- Polling, not streaming: up to 3 seconds behind.
- The API needs Docker access in M1; in the cloud it reads a log service instead.

### Questions
**Q: Polling or WebSockets for logs?** _Polling every 1.5 to 3 seconds is simple, works through any proxy and reuses
the normal auth. WebSockets or server-sent events are better when many people watch or when sub-second updates
matter. For a deploy page, a second's delay is fine._

**Q: How do you make sure one tenant can't read another's logs?** _The request names a service; the API checks
membership through the service's organization, then takes the container name from our own database. Nothing in the
request becomes part of the Docker command except a validated line count._

**Q: Why show the image digest?** _It's the fingerprint of the exact build. Tags like `latest` can move; the digest
can't. It's what rollback (M1-S9) will redeploy._

---

## 15. Manual rollback (M1-S9)

**The idea:** every successful deploy left an image in the registry, a frozen copy of the app at that commit. A
rollback runs an old image again. It's a new deploy marked "Rollback of #5" that skips download and build and goes
straight to start, health check and go live.

### Why each choice
| Choice | Why | Alternatives and their cost |
| --- | --- | --- |
| **Reuse the image by digest** | exact same build, seconds instead of minutes | rebuild the old commit (slow, and the base image or dependencies may have changed) |
| **Rollback as a new deployment** | history shows what happened, in order; the same lock, health check and outcome badges apply | flip the route back silently (fast, but no record and no health check) |
| **Store port and health path per deploy** | an old image starts on the port it was built for | always use current settings (a port change breaks rollback) |
| **Env vars use current values** | no extra copies of secrets | snapshot env vars per deploy (exact, but more secret copies to protect) |
| **Simple confirm, no typing** | nothing is lost; you can roll forward by deploying | type-to-confirm (friction when speed matters most) |

### What happens when...
| Situation | What ForgeOps does |
| --- | --- |
| The live version is broken, an older one worked | Roll back: real run took 2.0 s (start 0.5, health 1.2, go live 0.3) against 24.6 s for a full deploy. |
| The old version fails its health check | The rollback fails, the current version stays live. It's an attempt, not a guarantee. |
| The old image is gone from the registry | Fails at "Start app" with Docker's error; live unchanged. Tested. |
| The port was changed since | The rollback uses the port that deploy had. Tested. |
| Someone clicks rollback while a deploy runs | 409, wait for it to finish. Tested. |
| The bad release changed the database | Not undone. The old code meets the new data. Migrations must be backward-compatible (expand, then contract). |

### "How do you roll back on ForgeOps?" (30-second answer)
"Every successful deploy keeps its image, identified by its digest. Rolling back creates a new deployment that reuses
that exact image, so there's no rebuild. It still goes through the health check before traffic moves, so a rollback
can't make things worse: if the old version won't start, the current one keeps serving. History shows the bad deploy
and the rollback side by side. In my run it took two seconds."

### Real evidence (M1-S9)
- 130 API tests. New: a real rollback to an earlier image without rebuilding (no GitHub calls, three steps, the old
  page served again, one container left), the port snapshot, a missing image keeps the live version, and the API
  rules (live target, failed target, deploy running, missing key, other organization, replay with the same key).
- Sabotage: running the full pipeline for rollbacks, and ignoring the stored port, both failed the test.
- Real rollback of the demo service: succeeded in 2.0 s, URL 200, one container. Browser: "Roll back to this", the
  confirm text, and the "Rollback" label in history.

### Known limits
- No automatic rollback yet (M1-S10). Env vars are not restored. Images are kept forever (no cleanup).
- The database is never rolled back.

### Questions
**Q: Why not just redeploy the old commit?** _A rebuild can produce a different image: base images and dependencies
move. Rolling back by digest runs exactly what worked before, and it's much faster._

**Q: Can a rollback fail?** _Yes: the old image might be gone, or the old code might not work with today's database
or env vars. ForgeOps still health-checks it, so a failed rollback never takes the current version down._

**Q: How do you make database changes rollback-safe?** _Expand and contract: add new columns or tables first, deploy
code that works with both, and only remove the old ones once no version needs them._

---

## 17. Started is not working (ADR-066)

**30-second answer:** "`docker run -d` returns success the moment the process launches, so a crash a second later
looked like a successful start. ForgeOps now watches the container for three seconds; if it stops, Start app fails
with the app's own log and the health check never runs. The health check only judges an app that stayed up, and
still catches one that dies later. So a crash is a rollout failure and a bad answer is a health failure."

- *Why not just make the health check longer?* It would still blame the wrong step; the user needs to know the app
  never stayed up, which usually means a missing setting or start command, not a slow app.
- *What does Kubernetes do?* The same split: a container that keeps exiting shows `CrashLoopBackOff`, while a running
  pod that fails its readiness probe gets no traffic.

## 16. Connecting GitHub for anyone (ADR-065)

**30-second answer:** "Connect GitHub starts with GitHub sign-in. ForgeOps then asks GitHub which installs of our
App that person can reach. One is linked at once, none sends them to install it, several show a picker. Any id
that comes back in a URL is checked against GitHub's list before it is linked, so nobody can attach someone else's
repositories. Because of that check, one install can safely serve several workspaces."

### What happens when...
- **The App is already installed:** sign-in finds it and links it. No GitHub settings page dead end.
- **Someone edits the install id or the picker link:** it is not in their GitHub list, so `INSTALLATION_NOT_YOURS`.
- **The state cookie is missing or forged:** the callback refuses it before calling GitHub.
- **OAuth is not configured:** the dashboard says so instead of showing an error page.

### Real evidence
- 11 GitHub tests; breaking the ownership check or the single-install link made them fail.
- A real run against GitHub found the Client ID and secret had never been set (ISS-045).

### Known limits
- The repo list stops at 100 repos (ISS-031). Removing an install on GitHub does not unlink it in ForgeOps yet.

### Questions
- *Why not trust `installation_id` from the redirect?* Anyone can type it; only GitHub's list for the signed-in
  person proves access.
- *Why OAuth if you already have a GitHub App?* The App reads code; OAuth tells us who is clicking.
- *Why let several workspaces share one install?* Teams and second workspaces need it; access is still checked per
  person.

## Product questions

**Q: Why build this when Vercel, Render and Railway exist?** _It runs on infrastructure you own, its internals
(queue, state, rollback) are visible, and it's reliability-first. It's also honestly a learning platform: the value
is being able to design it, break it and recover it._

**Q: How do you support many languages?** _A Dockerfile build works for any language, because the container image
is the interface between the user's code and the platform. Automatic builds will cover a deliberately small set
with tested conventions._

**Q: Why lead with reliability instead of deploying?** _Deploying is a solved problem. Recovery is where real systems
fail and where the hard engineering is: state, idempotency, rollout tracking and observability._

**Q: Why require real login in the first milestone?** _Adding authorization later means auditing every endpoint for
missing checks. And a platform that builds code from GitHub must never have an open control plane._
