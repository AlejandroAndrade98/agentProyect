# Current Session State

Compact active summary for Sales AI Platform / agenteProject.

Full historical archive:
- `docs/current-session-state-full-archive.md`

## Project Stack

- Monorepo: pnpm Workspaces + Turborepo
- Frontend: Next.js + TypeScript + Tailwind
- Backend: NestJS + TypeScript
- Worker: NestJS + BullMQ + Redis
- Database: PostgreSQL 16
- ORM: Prisma 5.22.0 with migrations
- Local infra: Docker Compose
- Runtime: Node 20, pnpm 9.0.0

## Core Rules

- Do not commit or push unless explicitly requested.
- Keep changes small, phased, and reviewable.
- Do not introduce broad refactors.
- Do not use `prisma db push` as the main workflow.
- Do not use SQLite, MySQL, or `latest` for critical dependencies.
- API keys and provider tokens stay backend-only.

Tenant safety:
- Scope commercial data by `organizationId`.
- Use `currentUser.organizationId`; do not accept `organizationId` from bodies.
- Validate linked records within the same tenant.
- Do not return another organization's data.

AI safety:
- AI suggestions remain human-in-the-loop.
- Suggestions start as `PENDING_REVIEW`.
- Users must explicitly accept, edit, reject, or apply.
- No autonomous CRM record creation.
- No autonomous email sending.
- No Gmail draft creation until a later approved phase.
- External email analysis uses synced metadata/snippet only, not full bodies.
- Do not leak secrets, tokens, API keys, or unsafe provider internals.

## Milestone Summary

- CRM foundation, auth, roles, tenant-safe CRUD, pagination, relation includes, activity events, dashboard, and frontend CRM flows are in place.
- Google connected accounts and manual Gmail/Calendar sync are in place.
- External email/calendar AI review queue exists for synced metadata.
- OpenAI generation exists for lead next steps, external email analysis, and external calendar analysis with safe provider error handling.
- Accepted external email/calendar suggestions can be explicitly applied by a human to create CRM notes, tasks, or leads.

## Latest Completed Phase

Phase 17D.1A foundation is complete:
- Added `AiUsageFeature.EXTERNAL_EMAIL_REPLY_DRAFT`.
- Added `AiSuggestionType.GENERATE_EMAIL_REPLY_DRAFT`.
- Added Prisma migrations for both enum values.

Not implemented in 17D.1A:
- No reply draft generation endpoint.
- No frontend reply draft UI.
- No provider generation path.
- No Gmail draft creation.
- No email sending.
- No background jobs.

## Immediate Roadmap

- 17D.1B: backend endpoint to generate external email reply draft AI suggestions as `PENDING_REVIEW`; no Gmail draft and no sending.
- 17D.1C: frontend review UI for reply draft suggestions.
- 17D.2: create a real Gmail draft only after approval.

Do not implement future subphases early.

## Validation Commands

```powershell
pnpm db:generate
pnpm build
pnpm db:migrate
```

Useful focused checks:

```powershell
git diff --check
git status --short
```
