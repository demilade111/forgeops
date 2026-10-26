# ForgeOps — Behavioural Interview Stories (STAR)

Every real problem hit while building ForgeOps, written in **STAR** form so it can be told in a behavioural
interview: **Situation → Task → Action → Result**, plus the lesson. First person. Newest first.

Good for questions like: *"Tell me about a bug you found"*, *"a time you debugged something unclear"*,
*"a time you made a trade-off"*, *"a time you prevented a security problem"*.

---

## ISS-015 — A clicked file link said "Couldn't find this file" after a rename (1.1.4)
- **Situation:** Mid-ticket, the product owner asked to rename the frontend folder from `apps/web` to
  `apps/frontend`. Afterwards, opening a file from an earlier link failed: the path no longer existed.
- **Task:** Make the rename complete, so nothing in the repo still pointed at the old path.
- **Action:** I searched the whole repo for `apps/web` and `@forgeops/web` (code, docs, config, lockfile),
  updated each match, regenerated the lockfile, and reran every check. Links already sent in chat can't be
  edited, so I pointed to the new path.
- **Result:** Zero references to the old path in the repo; all 20 tests, typecheck, lint and build passed.
- **Lesson:** A rename isn't done when the folder moves. Search for every reference, including docs and lockfiles.

## ISS-014 — The dashboard said "API unreachable" while the API was running (1.4.7)
- **Situation:** On the first browser test, the page showed "API unreachable" even though the API logs said
  "listening" and `curl` returned 200.
- **Task:** Find out whether the frontend's API connection was broken.
- **Action:** I compared a direct call, a call through Vite's proxy, and the Vite logs. The logs showed
  `ECONNREFUSED`: the page's first request arrived before the API had finished starting.
- **Result:** Nothing was broken. Because the page polls every 5 s, it switched to "healthy" on its own. I
  then verified all three states by stopping the database and the API in turn.
- **Lesson:** Distributed systems start in a race. Clients should retry instead of trusting one first result.

## ISS-013 — Shell commands failed because of zsh, not the code (1.1.4)
- **Situation:** Two verification commands failed with `=== not found` and `no matches found: --include=*.md`.
- **Task:** Tell a real failure apart from a tooling quirk.
- **Action:** I found two zsh behaviours: a word starting with `=` is treated as a command lookup, and an
  unquoted glob that matches nothing aborts the command. I quoted the patterns and reran.
- **Result:** Both commands worked; the install they were checking had actually succeeded.
- **Lesson:** Read the error source. A failing check script doesn't mean the thing it checks failed.

## ISS-012 — The generated database client "disappeared" (1.4.3)
- **Situation:** After setting Prisma to regenerate its client on install, I deleted the client and ran
  `pnpm install`. The dev server then crashed with `ERR_MODULE_NOT_FOUND`.
- **Task:** Work out whether automatic generation was broken, because a new clone or CI run would hit the same crash.
- **Action:** I found pnpm skips install scripts when nothing needs installing, so my test was wrong. I
  reproduced the real case by removing `node_modules` and reinstalling.
- **Result:** Generation ran correctly on a true fresh install. No code change was needed; I documented the
  manual `prisma generate` step for schema edits.
- **Lesson:** Test the scenario you care about, not a shortcut that only looks like it.

## ISS-011 — A scaffolding tool wanted to write more than we needed (1.4.3)
- **Situation:** Setting up Prisma 7, whose behaviour changed from earlier versions: it no longer reads `.env`
  itself, and its template adds the `dotenv` package.
- **Task:** Follow the current conventions without adding unneeded files or dependencies to the repo.
- **Action:** I ran `prisma init` in a scratch folder first. It also created AI-agent config folders
  (`.claude`, `.agents`, `.windsurf`). I copied only the two config files we needed and loaded `.env` with
  Node's built-in `process.loadEnvFile()`.
- **Result:** A clean setup with one less dependency and no stray files in the repo.
- **Lesson:** Sandbox code generators and inspect their output before letting them touch your project.

## ISS-010 — A dependency install timed out and pulled a pre-release (1.4.3)
- **Situation:** Installing the Prisma CLI on a slow network took over 5 minutes, then failed with a timeout
  while resolving `prisma@8.0.0-rc.27`, a release candidate.
- **Task:** Get a working install that matched the runtime library already installed (7.10.1).
- **Action:** I pinned the CLI to exactly `7.10.1`, the same version as `@prisma/client`, and ran the install
  in the background while I carried on with config work that didn't depend on it.
- **Result:** The install succeeded, CLI and client matched, and no time was lost waiting.
- **Lesson:** Pin tightly coupled packages to the same version, and never let `latest` pull in pre-releases.

## ISS-009 — The database looked broken right after starting (1.4.1)
- **Situation:** On the first `docker compose up`, PostgreSQL rejected queries with "the database system is
  shutting down" for about 30 seconds.
- **Task:** Decide whether the setup was misconfigured before changing anything.
- **Action:** I read the container logs instead of guessing. On first start the image initialises with a
  temporary server, then restarts, and the shutdown's disk sync took **26.8 s** on Docker Desktop.
- **Result:** Nothing was wrong, so I changed no config. I added real checks (connect from the host, data
  survives a restart), and later starts take a few seconds.
- **Lesson:** Read the logs before "fixing" things. A check can land in the middle of a startup sequence.

## ISS-008 — The default database port was already taken (1.4.1)
- **Situation:** Before starting ForgeOps' PostgreSQL, I checked port 5432 and it was in use.
- **Task:** Run our database without breaking anything else on the machine.
- **Action:** I used `lsof` to trace the port to a Homebrew PostgreSQL 14 service that had been running
  for two weeks. Instead of stopping it, I mapped ForgeOps to port **5433**, bound to `127.0.0.1` only.
- **Result:** Both databases ran side by side, ForgeOps' was reachable only from the machine itself, and the
  existing service was untouched.
- **Lesson:** Check before assuming defaults, and don't break other people's software to make yours work.

## ISS-007 — A health check "failed" when the server was actually fine (1.3.x, 1.4.3)
- **Situation:** My verification script waited a fixed 3 seconds, then called the dev server, and got no answer.
- **Task:** Find out whether dev mode was broken.
- **Action:** The log showed the server had started; it just took longer than 3 seconds. I replaced fixed
  sleeps with a **poll loop** that retries until the endpoint answers, with a time limit.
- **Result:** The checks became reliable, and I stopped chasing a bug that didn't exist.
- **Lesson:** Wait for a condition, not a guessed amount of time. It's the same idea as Kubernetes readiness probes.

## ISS-006 — A server kept running after I stopped it (1.4.3)
- **Situation:** After stopping the dev server, port 4000 was still busy.
- **Task:** Clean up test processes reliably so later tests didn't collide.
- **Action:** I found `tsx watch` is a supervisor that restarts its child when it dies. I stopped the
  watcher first, then the child, and confirmed with `lsof` that the port was free.
- **Result:** Clean shutdowns, and no leftover processes interfering with later checks.
- **Lesson:** Understand the process tree. Supervisors restart children, so always verify cleanup.
  Also: `lsof -ti tcp:PORT` lists clients too; use `-sTCP:LISTEN` to see only the server holding the port.

## ISS-005 — Dependencies asked to run code at install time (1.1.5, 1.4.3)
- **Situation:** pnpm refused to run install scripts for `esbuild`, `prisma` and `@prisma/engines`.
- **Task:** Decide whether to allow them. Install scripts are a common supply-chain attack route.
- **Action:** I kept each one blocked, recorded the decision explicitly in `pnpm-workspace.yaml`, and
  verified the tools still worked (dev server, Prisma generate, migrations).
- **Result:** Zero install scripts allowed, and everything works.
- **Lesson:** Least privilege applies to dependencies: allow a script only when it's proven necessary.

## ISS-004 — The server said "listening" when it had actually failed (1.1.5)
- **Situation:** I was testing the API's failure path by starting a second server on a port already in use.
- **Task:** Make sure a failed start is obvious, both to a person and to a supervisor such as Docker or Kubernetes.
- **Action:** The log printed `listening on http://localhost:4102` and then crashed with `EADDRINUSE`. I found
  that in **Express 5** the `listen()` callback also runs on failure and receives the error, which my code
  ignored. I handled the error first and exited with a non-zero code.
- **Result:** A busy port now gives a clear error and exit code 1, with no false "listening" message.
- **Lesson:** Re-read API contracts after major version upgrades, and always test the failure path.

## ISS-003 — My test was wrong, not the code (1.1.5)
- **Situation:** To simulate a busy port, I had a helper occupy `127.0.0.1:4101`, but the API still started.
- **Task:** Work out why the conflict didn't happen.
- **Action:** I found Node listens on `::` (all addresses), which on macOS doesn't clash with a socket bound only
  to `127.0.0.1`. I recreated the conflict properly by starting the API twice on the same port.
- **Result:** The proper test exposed a real bug (ISS-004).
- **Lesson:** When a result surprises you, check the test before the code.

## ISS-002 — Upgrading to the newest TypeScript broke linting (1.1.3)
- **Situation:** Setting up the toolchain, the install picked **TypeScript 7.0.2**, and pnpm warned about an
  unmet peer dependency.
- **Task:** Get a stable toolchain without silently ignoring the warning.
- **Action:** I checked the peer range: `typescript-eslint` 8.72 supports TypeScript `<6.1` only. I pinned
  TypeScript `~6.0` and recorded why in ADR-024, with a trigger to upgrade later.
- **Result:** Zero peer-dependency issues, lint and typecheck both working, and a documented upgrade path.
- **Lesson:** "Latest" isn't always compatible. Treat peer warnings as errors and record version decisions.

## ISS-001 — The machine's runtime was out of support (1.1.1)
- **Situation:** The machine had Node v18.17.1, end-of-life since April 2025, and current Vite and Prisma
  need a newer version.
- **Task:** Upgrade for ForgeOps without breaking other projects on the same machine.
- **Action:** I used nvm to run Node 24 LTS for this project only and pinned it in `.nvmrc`, leaving the
  system default unchanged.
- **Result:** ForgeOps runs on a supported runtime, and other projects keep working.
- **Lesson:** Pin runtime versions per project so laptops and CI behave the same.
