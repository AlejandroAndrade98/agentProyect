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

## Phase 17D.1B, Backend AI Email Reply Draft Suggestions

Status: completed, validated in build/runtime, pending commit/push.

Implemented backend-only generation of AI email reply draft suggestions from synced external email metadata.

Endpoint added:

- `POST /api/ai-suggestions/external-sync/email-messages/:emailMessageId/generate-reply-draft`

Behavior:

- Requires auth and CRM write roles.
- Uses only synced email metadata/snippet.
- Creates `AiSuggestion` with:
  - `type = GENERATE_EMAIL_REPLY_DRAFT`
  - `status = PENDING_REVIEW`
  - `entityType = EXTERNAL_EMAIL_MESSAGE`
  - linked `externalEmailMessageId`
  - draft body in `outputText`
- Supports:
  - `AI_PROVIDER=mock`
  - `AI_PROVIDER=openai`
- Uses `AiUsageFeature.EXTERNAL_EMAIL_REPLY_DRAFT`.
- Creates `AiUsageRecord`.
- Creates `AI_SUGGESTION_CREATED` ActivityEvent.
- Blocks duplicate pending draft suggestions for the same email with 409.

Runtime validation completed:

- OpenAI real generation created a pending email reply draft suggestion.
- Suggestion was created with:
  - `provider = openai`
  - `model = gpt-4o-mini`
  - `type = GENERATE_EMAIL_REPLY_DRAFT`
  - `status = PENDING_REVIEW`
  - `tokensInput = 592`
  - `tokensOutput = 142`
- Output text contained the suggested reply draft.
- Metadata included:
  - `suggestedSubject`
  - `tone`
  - `confidence`
  - `reasoning`
  - `aiAnalysisScope = metadata_only`
  - `humanApprovalRequired = true`
  - `canApplyAutomatically = false`
  - `canSendEmailAutomatically = false`
  - `emailSentAutomatically = false`
  - `draftCreatedAutomatically = false`
- Duplicate pending draft request returned 409.
- Usage record was created with:
  - `feature = EXTERNAL_EMAIL_REPLY_DRAFT`
  - `status = SUCCESS`
  - `provider = openai`
- ActivityEvent was created with:
  - `type = AI_SUGGESTION_CREATED`
  - `entityType = EXTERNAL_EMAIL_MESSAGE`
  - `draftCreatedAutomatically = false`
  - `emailSentAutomatically = false`

Safety rules preserved:

- No Gmail draft was created.
- No email was sent.
- No CRM records were created automatically.
- No background job was added.
- Human review is required.

## Latest completed phase

Phase 17D.3 Frontend Gmail Draft Creation Action is completed and validated.

Current AI email reply draft flow:
- Synced Gmail metadata can generate `GENERATE_EMAIL_REPLY_DRAFT` AI suggestions.
- Suggestions remain `PENDING_REVIEW`.
- User can accept or reject suggestions.
- Accepted suggestions can create a real Gmail draft through explicit user action.
- Gmail draft creation works from the frontend.
- Gmail draft ID and thread ID are shown after creation.
- Emails are never sent automatically.
- No Gmail send button exists.
- No CRM records are created automatically.
- Human-in-the-loop workflow remains enforced.

## Latest completed phase

Phase 17D.4 Gmail Draft Review UX Polish is completed and validated.

Current AI email draft workflow:
- Gmail metadata can generate `GENERATE_EMAIL_REPLY_DRAFT` suggestions.
- Suggestions require human review.
- Accepted suggestions can create Gmail drafts through explicit user action.
- Gmail draft review UI is polished with email-style preview, safety cards and draft-created state.
- `Open Gmail Drafts` safely opens Gmail drafts.
- No email is sent automatically.
- No Gmail send button exists.
- No CRM records are created automatically.

## Latest completed phase

Phase 17E.1 Synced Emails AI Actions UI is completed and validated.

Current AI Inbox flow:
- Users can open `/dashboard/external-sync/email-messages`.
- Users can view synced Gmail metadata.
- Users can manually sync Gmail from the frontend.
- Users can generate external email analysis suggestions.
- Users can generate AI email reply draft suggestions.
- Created suggestions link to the AI Suggestions review page.
- No email is sent automatically.
- No Gmail draft is created automatically from the Synced Emails page.
- No CRM records are created automatically.
- Human review remains required.

## Latest completed phase

Phase 17E.2 Synced Calendar Events AI Actions UI is completed and validated.

Current AI Calendar flow:
- Users can open `/dashboard/external-sync/calendar-events`.
- Users can view synced Google Calendar metadata.
- Users can manually sync Calendar from the frontend.
- Users can generate external calendar analysis suggestions.
- Created suggestions link to the AI Suggestions review page.
- Existing calendar suggestions persist visually as `View analysis`.
- No emails are sent automatically.
- No tasks, notes, leads, or CRM records are created automatically.
- Human review remains required.

## Latest completed phase

Phase 17F.1 AI Workspace / Unified Review Hub is completed and validated.

Current AI Workspace flow:
- Users can open `/dashboard/ai-workspace`.
- Users can see pending AI suggestions.
- Users can see recent synced emails.
- Users can see upcoming synced calendar events.
- Users can navigate quickly to AI Suggestions, Synced Emails, and Synced Calendar.
- Users can manually sync Gmail and Calendar from the workspace.
- No email is sent automatically.
- No Gmail draft is created automatically from the workspace.
- No CRM records are created automatically.
- Human review remains required.

## Latest completed phase

Phase 17G.1 Apply External Calendar Suggestion to CRM Task is completed and validated.

Current AI Calendar apply flow:
- Users can analyze synced calendar events.
- Calendar analysis suggestions require human review.
- Accepted calendar suggestions can create CRM Tasks through explicit user action.
- Created task state appears in the AI Suggestion detail page.
- No task is created automatically during analysis.
- No email is sent automatically.
- No lead, contact, company, or note is created automatically.

## Latest completed phase

Phase 17G.2 Apply External Calendar Suggestion to CRM Note is completed and validated.

Current AI Calendar apply flow:
- Users can analyze synced calendar events.
- Calendar analysis suggestions require human review.
- Accepted calendar suggestions can create CRM Tasks through explicit user action.
- Accepted calendar suggestions can create CRM Notes through explicit user action.
- Created task/note states appear in the AI Suggestion detail page.
- No task or note is created automatically during analysis.
- No email is sent automatically.
- No lead, contact, or company is created automatically.

## Latest completed phase

Phase 17G.3 Apply External Calendar Suggestion to CRM Lead is completed and validated.

Current AI Calendar apply flow:
- Users can analyze synced calendar events.
- Calendar analysis suggestions require human review.
- Accepted calendar suggestions can create CRM Tasks through explicit user action.
- Accepted calendar suggestions can create CRM Notes through explicit user action.
- Accepted calendar suggestions can create CRM Leads through explicit user action.
- Created task/note/lead states appear in the AI Suggestion detail page.
- No task, note, or lead is created automatically during analysis.
- No email is sent automatically.
- No company or contact is created automatically.