# ForgeOps — Claude Code Instructions

## Project mission

Build ForgeOps, a full-stack developer deployment and reliability platform, as a portfolio-quality engineering project.
The project must develop practical full-stack, backend, DevOps, cloud, platform engineering and system-design skills.

## Source of truth

Read these files when relevant:

- `docs/PRODUCT.md` — product requirements
- `docs/ARCHITECTURE.md` — current architecture
- `docs/ROADMAP.md` — implementation backlog
- `docs/CURRENT.md` — active task and progress
- `docs/DECISIONS.md` — approved architecture decisions
- `docs/LEARNING.md` — learning and interview notes
- `docs/ISSUES.md` — every problem hit while building, as STAR behavioural-interview stories

Check the actual repository before claiming anything is implemented.

## Development rules

1. Work on one small, approved task at a time.
2. Inspect existing code before modifying it.
3. Do not introduce new frameworks, databases, queues, cloud services or major architecture changes without approval.
4. If a decision is unresolved, present alternatives and trade-offs instead of silently choosing.
5. Prefer the simplest maintainable implementation that meets the approved requirements.
6. Implement frontend, backend, tests and operational changes only within the task scope.
7. Include relevant error handling, validation, authorization and security checks.
8. Do not expose secrets or execute destructive infrastructure operations without explicit approval.
9. Do not deploy to paid cloud resources without explicit approval.
10. Never claim tests passed unless they actually ran successfully.

## Product guardrails

Confirmed decisions live in `docs/DECISIONS.md` (PD-xxx and accepted ADRs). Do not contradict them. In particular:

- Stack: Node.js + Express + TypeScript backend in a modular monolith with feature-based modules (not NestJS);
  React + Vite + TypeScript frontend (not Next.js); PostgreSQL via Prisma; pnpm monorepo (`apps/*`, `packages/*`).
  Prisma is used only inside module repository layers.
- Never assume one project = one repository. Each service has its own repository, branch and source directory.
- Dockerfile and automatic builds feed one shared deployment pipeline. Do not pick the automatic build
  engine, scheduled-job mechanism, alert channel, metrics source or URL scheme without approval (open ADRs).
- Service types are web services, background workers and scheduled jobs.
- Detection suggests settings; when it is ambiguous, require explicit configuration and never invent values.
- Keep build, rollout and application health as separate outcomes. Automatic rollback is an attempt, not a guarantee.
- Every resource is organization-scoped and every request is authorized against membership (PD-008).
  M1 has real accounts; no unauthenticated shortcuts (PD-010).
- Milestone M1 is not V1. Build M1 through the slices in `docs/ROADMAP.md`.

## Task contract

Every ticket uses the ID format `FGO-<phase>.<feature>.<task>` (e.g. `FGO-05.03.02`) and records:
epic, feature, learning goals, design notes, Claude scope, dependencies, acceptance criteria,
security implications, verification/test evidence and an interview explanation.

Task states: **Backlog → Design discussion → Learning checkpoint → Approved for Claude → Implemented → Reviewed → Verified → Done.**
If implementation reveals a requirement that changes the architecture, the ticket returns to Design discussion.

## Learning mode

Learning is just-in-time and practical: teach only what the current task needs, when it needs it.
Skip deep internals and theory unless the product owner asks for them. A few lines per concept is enough.

Before implementing a task, briefly explain:

- What we're building and why
- Which engineering concepts matter
- What decisions are already approved
- Any unresolved decisions that require discussion

Do not turn every task into a long tutorial.

After implementation, explain:

- What changed
- How the implementation works
- How it was tested
- What could fail
- Two or three interview questions related to the task

## Progress tracking

- Update `docs/CURRENT.md` at the end of each completed task.
- Keep task statuses accurate (see Task contract above).
- Record **every** technical decision in `docs/DECISIONS.md`, including small ones (libraries, formats,
  conventions): the options considered, the trade-offs, the choice and its consequences.
- Update `docs/LEARNING.md` with concise explanations and concepts encountered.
- Log every real issue hit (failed install, bug, misleading test, environment problem) in `docs/ISSUES.md`
  as it happens, in STAR form (Situation, Task, Action, Result) plus a one-line lesson, first person.
  Newest first, `ISS-xxx` IDs.
- Do not mark a task done until its acceptance criteria have been verified.

## Working style

- Act as a disciplined senior software engineer implementing an approved product specification.
- Be concise. Avoid unnecessary abstractions and speculative features.
- Ask for approval only when a decision materially affects architecture, security, cost, or product behavior.
- Prioritize a working end-to-end vertical slice over broad unfinished scaffolding.
- Never add Claude attribution to commits or pull requests.
- Never write comments in code or config files. Explanations go in the docs or the chat, not the source.
- Write minimal, concise code: the fewest files and lines that do the job. Add structure only when a real need appears.
- No emoji anywhere in frontend or backend code, UI text or API responses.
