# ForgeOps — Issues Log

Every real problem hit while building ForgeOps, written so it can be told in an interview:
**what happened → why → how it was fixed → the lesson.** Newest first.

---

## ISS-012 — `pnpm install` didn't regenerate the Prisma client (1.4.3)
- **What happened:** After deleting the generated Prisma client, `pnpm install` finished but didn't regenerate
  it, and the dev server crashed with `ERR_MODULE_NOT_FOUND: generated/prisma/client.js`.
- **Why:** pnpm skips lifecycle scripts like `postinstall` when nothing needs installing. On a fresh checkout
  (new clone, CI) `postinstall` does run; that was confirmed by removing `node_modules` and reinstalling.
- **Fix:** No code change. Documented that after editing `schema.prisma` you run `prisma generate` manually.
- **Lesson:** Test the scenario you actually care about (fresh clone), not a shortcut that only looks similar.
- **Interview line:** "My test simulated a fresh install wrongly. Reproducing the real case showed the setup
  was fine and the gap was documentation."

## ISS-011 — Prisma 7 templates add files and dependencies we didn't want (1.4.3)
- **What happened:** Prisma 7 no longer reads `.env` itself; its template adds the `dotenv` package.
  `prisma init` also creates AI-agent config folders (`.claude`, `.agents`, `.windsurf`).
- **Fix:** Ran `prisma init` in a scratch folder to read the template, copied only what we needed, and loaded
  `.env` with Node's built-in `process.loadEnvFile()` instead of adding `dotenv`.
- **Lesson:** Generators and templates change between major versions. Inspect what they produce before
  letting them write into your repo.
- **Interview line:** "I sandboxed the scaffolding tool, kept two config files, and avoided a dependency by
  using a Node built-in."

## ISS-010 — Installing the Prisma CLI timed out and picked a pre-release (1.4.3)
- **What happened:** The install took over 5 minutes, then failed with a registry timeout while resolving
  `prisma@8.0.0-rc.27`, a release candidate, not the stable 7.x the client was on.
- **Fix:** Pinned the CLI to `prisma@7.10.1`, exactly matching `@prisma/client`, and retried in the background.
- **Lesson:** Keep tightly coupled packages (CLI + client) on the exact same version, and don't let
  `latest` pull in pre-releases.
- **Interview line:** "A version mismatch between a CLI and its runtime library is a classic source of
  confusing bugs, so I pinned them together."

## ISS-009 — PostgreSQL said "the database system is shutting down" right after starting (1.4.1)
- **What happened:** The first `docker compose up` looked broken: queries failed with "the database system is
  shutting down" for about 30 seconds.
- **Why:** On first start the Postgres image runs a temporary server to initialise the database, then
  restarts. The logs showed the shutdown's disk sync took **26.8 s** on Docker Desktop for Mac.
- **Fix:** Nothing was broken. Waited, confirmed from the logs, then added real checks (connect from the
  Mac, data survives a restart).
- **Lesson:** Read the logs before "fixing" anything. Startup is a sequence, and a check can run mid-sequence.
- **Interview line:** "The logs showed a one-time slow disk sync during initialisation, not a failure, so the
  right fix was waiting and adding a readiness wait, not changing config."

## ISS-008 — Port 5432 was already taken (1.4.1)
- **What happened:** Before starting Postgres in Docker, `lsof` showed port 5432 in use.
- **Why:** A Homebrew PostgreSQL 14 service had been running on the machine for two weeks.
- **Fix:** Left the existing service alone and mapped ForgeOps to host port **5433**, bound to `127.0.0.1` only.
- **Lesson:** Check ports before assuming defaults. Don't break other software on a shared machine.
- **Interview line:** "I found the conflict with `lsof`, traced it to a launchd service, and avoided it
  instead of stopping someone else's database."

## ISS-007 — Dev server "failed" a check that it actually passed (1.3.x, 1.4.3)
- **What happened:** A test script curled the dev server after a fixed 3-second sleep and got no answer.
  The log later showed the server had started; it just took longer than 3 seconds.
- **Fix:** Replaced fixed sleeps with a **poll loop**: retry until the endpoint answers, with a time limit.
- **Lesson:** Fixed sleeps make flaky checks. Wait for the condition, not for a guess of the time.
- **Interview line:** "Same idea as Kubernetes readiness probes: poll for ready instead of assuming a startup time."

## ISS-006 — Stopping the dev server didn't stop it (1.4.3)
- **What happened:** After `kill`, port 4000 was still busy. `tsx watch` restarts its child process when it dies.
- **Fix:** Stop the watcher process first, then the child. Check `lsof` afterwards to confirm the port is free.
- **Lesson:** Know your process tree: supervisors restart children. Always verify cleanup.

## ISS-005 — pnpm blocked install scripts from esbuild and Prisma (1.1.5, 1.4.3)
- **What happened:** pnpm refused to run install scripts for `esbuild`, `prisma` and `@prisma/engines`.
- **Why:** pnpm blocks dependency install scripts by default, because malicious packages often attack
  through `postinstall` (a supply-chain risk).
- **Fix:** Denied each one explicitly in `pnpm-workspace.yaml` and confirmed the tools still work without them.
- **Lesson:** Least privilege applies to dependencies too: allow a script only if it's proven necessary.
- **Interview line:** "I treated install scripts as untrusted code and only allow-listed what was required,
  which turned out to be nothing."

## ISS-004 — The server printed "listening" even when it failed to start (1.1.5)
- **What happened:** Starting a second API on a busy port printed `listening on http://localhost:4102`, then
  crashed with `EADDRINUSE`.
- **Why:** In **Express 5**, the `app.listen()` callback also runs on failure and receives the error. The
  code ignored that argument.
- **Fix:** Check the `error` argument first; if present, fail with a non-zero exit code.
- **Lesson:** Read the API contract after major version upgrades. Test the failure path, not just the happy path.
- **Interview line:** "Testing the failure case showed a misleading log line that would have confused anyone
  debugging a production start-up."

## ISS-003 — A test was wrong, not the code (1.1.5)
- **What happened:** To simulate a busy port, a helper bound `127.0.0.1:4101`, but the API still started.
- **Why:** Node listened on `::` (all addresses, IPv6 dual-stack), which doesn't collide with a socket bound
  only to `127.0.0.1` on macOS.
- **Fix:** Simulated the conflict properly by starting the API twice on the same port.
- **Lesson:** When a test result surprises you, check the test first.

## ISS-002 — TypeScript 7 broke the linting setup (1.1.3)
- **What happened:** Installing the latest TypeScript gave **7.0.2**, and pnpm reported an unmet peer dependency.
- **Why:** `typescript-eslint` 8.72 only supports TypeScript `<6.1`.
- **Fix:** Pinned TypeScript to `~6.0` (6.0.3). Recorded in ADR-024 with a note to upgrade later.
- **Lesson:** "Latest" isn't always compatible. Peer-dependency warnings are real errors waiting to happen.
- **Interview line:** "I chose the newest version the whole toolchain supports, recorded why, and set a revisit trigger."

## ISS-001 — Node 18 was out of support (1.1.1)
- **What happened:** The machine had Node v18.17.1, end-of-life since April 2025; current Vite and Prisma need newer.
- **Fix:** Switched to Node 24 LTS with nvm and pinned it in `.nvmrc`, leaving the system default unchanged
  so other projects aren't affected.
- **Lesson:** Pin runtime versions per project so laptops and CI match.
