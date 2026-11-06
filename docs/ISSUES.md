# ForgeOps — Behavioural Interview Stories (STAR)

Every real problem hit while building ForgeOps, written in **STAR** form so it can be told in a behavioural
interview: **Situation → Task → Action → Result**, plus the lesson. First person. Newest first.

Good for questions like: *"Tell me about a bug you found"*, *"a time you debugged something unclear"*,
*"a time you made a trade-off"*, *"a time you prevented a security problem"*.

---

## ISS-040 — The landing page showed "Can't reach ForgeOps" whenever the API was down (mini frontend)
- **Situation:** After a restart, the new landing page rendered only an error box: the app waited for `/api/me`
  before rendering any route, and the database containers were stopped.
- **Task:** A marketing page must not depend on the backend.
- **Action:** I moved the session check into a gate used only by `/login`, `/signup` and `/app`; `/` renders at once.
- **Result:** the landing page loads with the API off; the app pages still show a clear error or redirect.
- **Lesson:** decide per route what each page really depends on.

## ISS-039 — A package removal crashed halfway and left package.json out of step (mini frontend)
- **Situation:** `pnpm remove` of two old font packages crashed in a worker thread. The packages were gone from
  `node_modules` but still listed in `package.json`, and a later check ran under Node 18 instead of 24 and failed.
- **Task:** Get the dependency list and the checks back to a trustworthy state.
- **Action:** I removed the entries by hand, ran `pnpm install` under the project's Node version (`nvm use`), and
  reran lint, tests and build.
- **Result:** clean install; lint, 5 frontend tests and the build pass.
- **Lesson:** after a tool crashes, check the files it was editing; and run checks with the pinned runtime.

## ISS-038 — My first runtime test timed out because its Dockerfile was malformed, not because of the code (M1-S6)
- **Situation:** All new run and route tests timed out waiting for a 200 through the test router, while the same
  steps done by hand worked.
- **Task:** Find whether the bug was in the release code or in the test.
- **Action:** I ran the test in the background and inspected Docker and Caddy while it waited: the route was correct
  but the container was "Restarting (127)", and its logs said `[sh,: not found`. The test Dockerfile's JSON `CMD` had
  lost its quote escaping on the way through a script and a template string, so Docker ran it as a broken shell
  command. I switched it to the shell form, which needs no escaping.
- **Result:** 110 tests pass. I then broke the real code five ways (no old-container cleanup, no URL collision check,
  no cleanup when routing fails, env vars not passed, URL not saved) and each was caught by a test.
- **Lesson:** when a test fails, look at the running system before changing code; the bug can be in the test's own
  fixture.

## ISS-037 — Caddy kept serving an old configuration after I edited its config file (M1-S6)
- **Situation:** I added a 404 catch-all to `caddy/caddy.json` and restarted Caddy, but unknown hosts still got an
  empty 200.
- **Task:** Make the config change take effect without losing the reason Caddy runs with `--resume`.
- **Action:** I realized `--resume` loads Caddy's last autosaved config, written on its first start, in preference to
  the file. The volume had been created minutes earlier and held nothing else, so I reset it and restarted.
- **Result:** unknown hosts now get "No service at this address" (404). The trade-off is documented in ADR-019:
  routes survive restarts, and file changes need the autosave reset.
- **Lesson:** persistence features change what "restart" means; know which copy of the config wins.

## ISS-036 — The local Docker data was gone a fourth time before I started a slice (M1-S6)
- **Situation:** Starting M1-S6, no ForgeOps containers existed and the volumes were created fresh by my
  `docker compose up -d`.
- **Task:** Get a working local environment without losing time.
- **Action:** I ran the seed script built after the third loss (ADR-053).
- **Result:** account, GitHub link, project and service were back in one command, and the real deploy ran minutes
  later. The cause of the losses is still unknown.
- **Lesson:** automating recovery turned a recurring hour-long problem into a non-event; the root cause still
  deserves a look.

## ISS-035 — The local database was wiped a third time, in the middle of a smoke test (M1-S5)
- **Situation:** After the M1-S5 tests passed, my smoke test against the real GitHub sample failed with "No record
  was found": the local `api` service was gone. All ForgeOps containers and volumes had been created that evening
  by my own `docker compose up`, while another project's volumes on the same machine were untouched.
- **Task:** Finish verifying the slice against real GitHub without losing more time, and stop treating this as a
  one-off.
- **Action:** I checked the volume's creation time and the other project's volumes to confirm only ForgeOps' Docker
  state had been removed (not a migration, not a full OrbStack reset). The smoke script then created its own
  records (organization, installation 177099801, project, service with source directory `api` and port 8080) instead
  of relying on hand-made local data.
- **Result:** the smoke run completed: real commit resolved, sample built and pushed in 22 seconds, image pulled back
  by digest and served 200. The deferred local seed script is now due; it is the third loss (ISS-029, ISS-032).
- **Lesson:** when the same environment problem happens three times, automate the recovery instead of redoing it by
  hand; verification scripts should create the data they need.

## ISS-034 — A build that hit its time limit was reported as an ordinary build failure (M1-S5)
- **Situation:** My test for the 15-minute build limit (shortened to 2 seconds) expected "Build took longer than
  the time limit" but got "Build failed with exit code 130".
- **Task:** Find out why the time-out was not recognised, because users need to know whether their code failed or
  the build was simply too slow.
- **Action:** I had assumed a process killed by the timer exits with no code (`null`). The Docker CLI actually
  catches the stop signal, cancels the build itself and exits with 130. I changed the runner to record whether
  ForgeOps' own timer fired (`signal.aborted`) instead of guessing from the exit code, for `tar`, `docker build`
  and `docker push` alike.
- **Result:** the time-out test passes, and a sabotage that ignores the time-out flag is caught by it.
- **Lesson:** don't infer why a child process stopped from its exit code; programs handle signals their own way.
  Track your own decision (the timer) directly.

## ISS-033 — My smoke-test script reported errors for a deployment that had actually succeeded (M1-S4)
- **Situation:** During the real end-to-end run, my polling loop printed thirty Python `KeyError` tracebacks and
  then "Not found", which looked like the deployment API was broken.
- **Task:** Work out whether ForgeOps or the test script was wrong before changing any code.
- **Action:** I saved the first response with `curl -w "HTTP %{http_code}" | tee`, so the file held the JSON plus an
  extra status line. Reading the id from it failed, so every poll asked for an empty id. I read the deployment by
  its id directly instead.
- **Result:** the deployment had succeeded with the right commit SHA all along. No code change was needed.
- **Lesson:** when a check fails, check the checker first; keep raw responses separate from decorations like status
  codes.

## ISS-032 — The local database was empty again at the start of M1-S4 (M1-S4)
- **Situation:** Starting M1-S4, `docker ps` showed no containers. `docker compose up` created a new Postgres
  container and a new `forgeops_postgres-data` volume, so yesterday's local account, GitHub link and service were gone.
- **Task:** Get back to a working local setup without guessing, and without exposing any credentials.
- **Action:** I confirmed from the volume's creation time and the migration history that the data was fresh, not
  deleted by a migration. Then I recreated a local test account with a random password that was never printed,
  re-linked the GitHub installation with one SQL insert, and recreated the service through the API.
- **Result:** back to a working setup in a few minutes; the API's own validation caught that the sample's
  Dockerfile lives in `api/`.
- **Lesson:** local Docker data is disposable. Keep a short, repeatable seed path (account, installation link,
  service) instead of relying on a volume surviving. Same root cause family as ISS-029.

## ISS-031 — The GitHub App could read all ~95 of my repositories, not just the one it needs (M1-S3)
- **Situation:** The first real call to list repositories through the GitHub App returned about 95 repos,
  including private client and personal projects. The App had been installed with "All repositories".
- **Task:** Keep the App to least privilege (ADR-008): it only needs the sample repo for M1.
- **Action:** I flagged it instead of quietly carrying on, and noted that the listing also stops at 100 repos
  (`per_page=100`), so pagination is needed before real users connect large accounts.
- **Result:** Restricting the installation to "Only select repositories" is a two-click change on GitHub,
  tracked in `CURRENT.md`.
- **Lesson:** Check the scope a credential actually has, not the scope you intended to give it.

## ISS-030 — A public repository passed the "is this repo in your installation?" check (M1-S3)
- **Situation:** All 71 tests passed for the new service API. Then I ran it against real GitHub with `curl` and
  asked for a service from `torvalds/linux`, a repo my GitHub App is not installed on. ForgeOps didn't refuse
  the repo; it only failed later because Linux has no Dockerfile at the top level.
- **Task:** Make the ownership check mean what it says.
- **Action:** The check was "can the installation token read `/repos/{repo}`?" Installation tokens can read every
  **public** repo, so only private repos were blocked. My fake GitHub client in the tests couldn't show this.
  I switched to `GET /repos/{repo}/installation` with the App's own token, which returns the installation that
  covers that repo, and accept it only if it is the organization's installation. I added a test for "readable
  but covered by another installation".
- **Result:** `torvalds/linux` is refused with `REPOSITORY_NOT_FOUND`; the sample repo still passes.
- **Lesson:** Fakes test my logic, not my assumptions about the real API. A real smoke test against the real
  service catches what mocks can't.

## ISS-029 — The local database was empty after switching Docker engines (M1-S3)
- **Situation:** Linking my GitHub installation to my local account, I found no accounts at all in the local
  database.
- **Task:** Work out whether something had deleted data.
- **Action:** `_prisma_migrations` showed every migration applied that day, so the volume was brand new. The
  earlier data lived in Docker Desktop's storage; OrbStack (ISS-020) keeps its own volumes, so
  `docker compose up` created a fresh database.
- **Result:** Nothing important lost (local test data only). I created a fresh local test account.
- **Lesson:** Docker volumes belong to the engine. Switching engines means migrating volumes or starting fresh
  on purpose.

## ISS-028 — A validation message was swallowed by the library (M1-S3)
- **Situation:** A test sent an env var named `BAD-NAME` and expected "Env var names use letters, numbers and
  underscores". The API answered "Invalid key in record".
- **Task:** Show users the plain message.
- **Action:** Zod 4 wraps errors from a record's key schema in its own generic message. I validated the names
  with a `refine` over the whole object instead.
- **Result:** The plain message comes through; the test passes.
- **Lesson:** Test the exact user-facing message, not just the status code; libraries rewrite messages.

## ISS-027 — A new database table "didn't exist" right after its migration ran (M1-S3)
- **Situation:** After `prisma migrate dev` created the `GitHubInstallation` table, TypeScript said
  `gitHubInstallation does not exist on type PrismaClient`.
- **Task:** Find out whether the migration had failed.
- **Action:** The migration had applied fine. In Prisma 7, `migrate dev` no longer regenerates the typed client
  as earlier versions did, so the code was still using the old client. I ran `prisma generate`.
- **Result:** Typecheck passed. The step is now part of the workflow notes for schema changes.
- **Lesson:** After a major version upgrade, re-check which steps a tool still does automatically.

## ISS-026 — A private key was exposed in a chat, so I rotated it before first use (M1-S3)
- **Situation:** While setting up the ForgeOps GitHub App, its newly downloaded private key was attached to
  the AI assistant chat by mistake, so the key's full contents became part of the chat transcript.
- **Task:** Contain the exposure before the key was ever used, and stop it happening again.
- **Action:** I treated the key as compromised even though its reach was small (read-only access to one
  private repo). On GitHub I generated a new key and deleted the old one, so the leaked key stopped working.
  The new key went to `~/.forgeops/github-app.pem`, outside the repo, with permissions `600` (owner only)
  in a `700` folder, moved by file name only so its contents were never displayed. From now on the API is
  given only the key's *path* through a git-ignored `.env` file.
- **Result:** The exposed key was revoked within minutes and never used. The working key has never appeared
  in a log, chat, commit or terminal output.
- **Lesson:** Once a secret shows up anywhere it shouldn't, rotate it. Hoping nobody saw it is not a plan.

## ISS-025 — Tests worked in one repo and failed in another with the same tools (M1-S2)
- **Situation:** The sample API's tests failed at startup with `Cannot find package 'vite'`, while the same
  Vitest version ran fine in ForgeOps.
- **Task:** Explain the difference and fix it properly.
- **Action:** `npm view vitest peerDependencies` showed `vite` is a required peer. ForgeOps uses pnpm and
  already had Vite installed for the frontend, which hid the requirement; the sample uses npm and has no
  Vite. I added `vite` as an explicit dev dependency.
- **Result:** 3 tests pass; the Docker image builds and behaves correctly (healthy, broken, non-root, clean stop).
- **Lesson:** A monorepo can hide missing dependencies. Declare everything a package needs, and test it alone.

## ISS-024 — A UI library's installer behaved differently from its docs and my memory (shadcn setup)
- **Situation:** Setting up shadcn/ui, the installer failed with `unknown option '--base-color'`.
- **Task:** Install it correctly for a Vite app without guessing again.
- **Action:** I read the installer's own `--help`. The option was gone, and `--defaults` now meant "assume a
  Next.js project", which would have set up the wrong framework. With explicit flags it then stopped at an
  interactive preset prompt that can't be answered in a script, so I passed the preset by name (`-p nova`).
- **Result:** shadcn installed for Vite with the intended preset in three attempts, without ever writing a
  wrong configuration.
- **Lesson:** CLIs change fast. Check the tool's own help for the installed version before trusting docs or memory.

## ISS-023 — Every API test failed with the same vague message (M1-S1 frontend refactor)
- **Situation:** After moving the frontend to axios, all API tests failed with "Something went wrong. Try
  again.", the friendly fallback message, which said nothing about the cause.
- **Task:** Find the real error that my own error handling was hiding.
- **Action:** I wrote a throwaway probe test without the interceptor. The real error was "Failed to parse URL
  from /api/me": in a browser, `/api` resolves against the page's address, but tests have no page. I pointed
  the axios instance at `http://localhost/api` in tests. One test still failed, and the cause was my fake
  server: it built a `204 No Content` response with a body, which the platform forbids.
- **Result:** All tests pass, and both problems were in the test setup, not the app.
- **Lesson:** Friendly error handling for users can hide causes from developers. Strip it away to debug.

## ISS-022 — Error messages contained symbols the UI shouldn't show (M1-S1)
- **Situation:** The API built validation messages with Zod's formatter, which writes lines like
  `✖ Too small → at password`.
- **Task:** Give the login screen messages people can read, and keep the project's no-emoji rule.
- **Action:** I replaced the formatter with plain, custom messages ("Enter a valid email address", "Password
  must be at least 12 characters") and added a test that the message is printable ASCII.
- **Result:** The form shows clear sentences; the server's config errors use the same plain format.
- **Lesson:** Library output is a developer format. Anything shown to users should be written on purpose.

## ISS-021 — Sign-up took over 5 seconds in the browser (M1-S1)
- **Situation:** Testing the sign-up screen, the button stayed greyed out for more than 5 seconds with no
  other feedback.
- **Task:** Find out whether the API was slow, and make sure users can tell something is happening.
- **Action:** The network log showed the request completing normally. `uptime` showed a load average of
  **172 on 8 cores**, and `ps` showed a video encoder, several browsers and other apps using the CPU, nothing
  from ForgeOps. Password hashing is CPU-bound by design, so it slowed the most. I added a "Please wait..." label.
- **Result:** The code was fine; the cause was the environment, and the UI now shows progress either way.
- **Lesson:** Check the machine before tuning the code, and design for slow paths, because users will hit them.

## ISS-020 — Tests failed with "No test files found" after the Docker engine changed (M1-S1)
- **Situation:** Tests that passed the day before failed with "No test files found" and the same Vitest
  printer crash as ISS-016.
- **Task:** Find the real cause behind a misleading message.
- **Action:** `docker compose ps` showed no container at all. `docker context show` said **OrbStack**: the
  machine's Docker engine had switched from Docker Desktop, so the old container and its data were in an
  engine that wasn't running. I started the database in OrbStack, re-applied migrations, and changed the test
  setup to print "Is PostgreSQL running (docker compose up -d)?" before Vitest can swallow the error.
- **Result:** Tests pass again, and a down database now produces a readable message (verified by stopping it).
- **Lesson:** When "nothing changed" but things broke, check the environment, and make failures say what to do.

## ISS-019 — A failing test got committed because the check looked at the wrong exit code (M1-S1)
- **Situation:** My commit command ran the tests and only committed if they passed, but it piped the output
  through `grep` to shorten it. One test failed and the commit still went through and was pushed.
- **Task:** Find the failing test, fix it, and stop failed checks from ever being committed again.
- **Action:** The chain checked `grep`'s exit code (it found the summary line, so "success"), not the test
  runner's. The test itself was flaky: it passed three times in a row. Measuring showed one password hash took
  0.6–0.8 s on a heavily loaded machine (load average 27–53 on 8 cores), and the login test hashes about five
  times, which sometimes exceeded Vitest's 5 s per-test limit. I raised the API test limit to 30 s, kept the
  real hashing settings, and pushed the fix straight away.
- **Result:** The test suite is stable, and the fix landed in the next commit. I now check the test command's
  own exit status before committing.
- **Lesson:** A pipe hides the exit code of everything but the last command. This is exactly why the CI
  pipeline (Phase 7) should block merges on failed checks, instead of relying on a person's command line.

## ISS-018 — Logout worked in tests but not from a real client (M1-S1)
- **Situation:** All 34 auth tests passed, but a smoke test with `curl` against the running API showed logout
  returning **415** and the session staying valid.
- **Task:** Find why a passing test suite missed it, and make sure it can't come back.
- **Action:** Logout sends no body, and my JSON-only guard (a CSRF defence) rejected any POST that wasn't
  JSON. The test passed only because Supertest happened to send a body. I changed the guard to check the
  content type only when there is content, and rewrote the test to send logout exactly like a browser.
- **Result:** Logout returns 204 and the session is deleted; with the old guard the new test fails, so the
  bug is now covered.
- **Lesson:** Tests can share the code's blind spots. Always finish with a real client against the real server.

## ISS-017 — A password-hashing setting could have let a few logins exhaust the server's memory (M1-S1)
- **Situation:** I first recorded scrypt with N = 2^17, a common recommendation, for password hashing.
- **Task:** Check the cost of that choice before implementing it.
- **Action:** That setting needs 128 MiB of memory per hash, so a few simultaneous logins, or an attacker
  hammering the login endpoint, could exhaust a small server. OWASP lists equally strong settings, and I chose
  N = 2^14, p = 5 (16 MiB), updating the decision record with the reason.
- **Result:** Same brute-force resistance at an eighth of the memory, caught before any code shipped.
- **Lesson:** Security settings have operational costs. Size them for the machine they'll run on.

## ISS-016 — The test runner crashed while reporting an error, hiding the real one (M1-S1)
- **Situation:** After adding database tests, Vitest stopped at startup with `code.charCodeAt is not a
  function`, an error from inside Vitest's own error printer.
- **Task:** Find the real failure underneath.
- **Action:** The only thing running at startup was my setup step, so I ran it by hand: the migration worked.
  The real cause was that `prisma` wasn't on the PATH when Vitest was started directly, and the failed
  command's raw byte output broke Vitest's error printer. I called Prisma by its exact path and turned any
  failure into a plain-text message.
- **Result:** Tests run the same way directly and through `pnpm test`, and setup failures now show readable
  errors.
- **Lesson:** When the error message makes no sense, isolate each step and run it alone.

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
