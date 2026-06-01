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

## Latest completed phase

Phase 17H.1 CRM List UX Cleanup for AI-created Records is completed and validated.

Current CRM list UX:
- Tasks list truncates long AI-generated descriptions.
- Notes list truncates long AI-generated content.
- Leads list truncates long AI-generated next steps/descriptions.
- AI-created notes and leads show `AI suggestion` badges when source data is available.
- Full content remains available in detail pages.
- No backend, Prisma, email, Gmail draft, or AI apply behavior changed.

## Latest completed phase

Phase 17H.2 AI-created CRM Detail Polish is completed and validated.

Current AI-created CRM detail UX:
- Task details show long AI-generated descriptions in readable cards.
- Note details show long AI-generated content in readable cards.
- Lead details show long AI-generated next steps/descriptions in readable cards.
- AI-sourced notes and leads show AI suggestion notices when source data is available.
- Full content remains visible on detail pages.
- No backend, Prisma, API, email, Gmail draft, or AI apply behavior changed.

## Latest completed phase

Phase 17I.1 AI Suggestion Detail Light Polish is completed and validated.

Current AI Suggestion detail UX:
- Detail page has clearer header, type/status/confidence badges, and key metadata.
- Source context is shown based on suggestion type.
- Safety messaging is centralized and easier to understand.
- AI output is displayed with better visual hierarchy.
- Existing review, apply, and Gmail draft actions keep the same behavior.
- No backend, Prisma, API, email, Gmail send, background job, or automatic action behavior changed.

## Latest completed phase

Phase 17I.2 AI Suggestions List / Review Queue Polish is completed and validated.

Current AI Suggestions list UX:
- `/dashboard/ai-suggestions` now behaves more clearly as a review queue.
- Suggestion cards show readable type/status labels, confidence, provider/model, source context, and applied indicators.
- Pending suggestions show `Review`.
- Reviewed suggestions show `View details`.
- Apply/create actions remain only on detail pages.
- No email sending, Gmail draft creation, CRM apply action, backend, Prisma, or API behavior changed.

## Latest completed phase

Phase 17I.3 Board-first CRM Navigation is completed and validated.

Current CRM navigation:
- `/dashboard/leads` now opens the Lead Pipeline board.
- `/dashboard/leads/list` shows the Leads list.
- `/dashboard/tasks` now opens the Tasks Board.
- `/dashboard/tasks/list` shows the Tasks list.
- Sidebar Leads and Tasks now land on board-first views.
- List views remain available through `List view` / `Board view` buttons.
- No backend, Prisma, API, email, Gmail, AI, or CRM automation behavior changed.

## Latest completed phase

Phase 17I.5 Board UX Enhancements is completed and validated.

Current board UX:
- AI Suggestions is now board-first.
- AI Suggestions list is available at `/dashboard/ai-suggestions/list`.
- Lead Pipeline and Tasks Board have independent per-column pagination.
- Leads and Tasks can be moved between columns with native drag-and-drop.
- Existing dropdown status controls remain as fallback.
- No backend, Prisma, API, email, Gmail, or CRM automation behavior changed.

## Latest completed phase

Phase 17I.6 Notes Board and AI Workspace Board-like Polish is completed and validated.

Current board UX:
- Notes is now board-first.
- `/dashboard/notes` opens the Notes Board.
- `/dashboard/notes/list` shows the Notes list.
- Notes Board is read-only and grouped by source.
- Notes Board has independent per-column pagination.
- AI Workspace now uses a clearer board-like layout with Needs Review, Ready for Action, Completed, Quick Actions, and Recent Synced Inputs.
- No backend, Prisma, API, email, Gmail, drag/drop mutation, or CRM automation behavior changed.


## Latest completed phase

Phase 17J.1 Dashboard Command Center Redesign is completed and validated.

Current dashboard UX:
- `/dashboard` is now a clearer Command Center.
- Action Required appears first.
- Dashboard highlights pending AI reviews, ready-for-action items, pending tasks, and next meeting.
- Next meeting card shows countdown, meeting metadata, Google Calendar link, and Calendar Board link.
- CRM Health, Quick Workspaces, External Sync Snapshot, Task Focus, and Recent Activity are organized into clearer sections.
- Recent synced emails/calendar no longer dominate the page.
- No backend, Prisma, API, email, Gmail draft, CRM apply, or automation behavior changed.

## Latest completed phase

Phase 17J.2 Sidebar Navigation Polish is completed and validated.

Current navigation UX:
- Sidebar is grouped into Overview, AI, CRM Work, CRM Data, and System.
- Nested active states still work for board/list/detail routes.
- Platform Admin remains restricted to SUPER_ADMIN.
- User card, logout, and existing routes are preserved.
- No backend, Prisma, API, email, Gmail, CRM automation, or background job behavior changed.

## Latest completed phase

Phase 17K.1 i18n Foundation is completed and validated.

Current i18n foundation:
- Frontend has lightweight JSON-based internationalization.
- English and Spanish dictionaries exist.
- `I18nProvider` and `useI18n()` are available.
- Locale selection persists in localStorage.
- Sidebar includes an EN/ES selector.
- Sidebar navigation and main dashboard labels are translated.
- Future languages can be added by adding a locale JSON file and registering it in config.
- No backend, Prisma, API, route, email, Gmail, CRM automation, or background job behavior changed.

## Latest completed phase

Phase 17K.2 i18n for AI Workspace and AI Suggestions is completed and validated.

Current i18n coverage:
- Sidebar and dashboard are translated.
- AI Workspace is translated.
- AI Suggestions board, list, and detail pages are translated.
- Common AI statuses, suggestion types, safety messages, and applied action labels have translated display helpers.
- Backend enum values, API payloads, routes, and AI-generated content remain unchanged.
- No backend, Prisma, API, email, Gmail, CRM automation, or background job behavior changed.

## Latest completed phase

Phase 17K.3B i18n AI and Dashboard Translation Cleanup is completed and validated.

Current i18n coverage:
- Sidebar and dashboard are translated.
- Dashboard fallback labels and next-meeting copy are translated.
- AI Workspace is translated.
- AI Suggestions board/list/detail are translated.
- Synced Emails and Synced Calendar board/list are translated.
- Shared display helpers cover AI suggestion types/statuses, priorities, task statuses, sync statuses, and applied action labels.
- Dynamic API data, AI-generated output, backend enum values, routes, and API payloads remain unchanged.
- No backend, Prisma, API, email, Gmail, CRM automation, or background job behavior changed.

## Latest completed phase

Phase 17K.6 i18n for Platform Admin is completed and validated.

Current i18n coverage:
- Platform Admin organization list is translated.
- Platform Admin new organization page is translated.
- Platform Admin organization detail page is translated.
- Platform statuses, account types, and invitation statuses have translated display helpers.
- Current frontend enum values were preserved: `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `INDIVIDUAL`, `COMPANY`.
- No backend, Prisma, API, route, RBAC, organization creation, invitation, billing, usage, email, Gmail, CRM automation, or background job behavior changed.

## Latest completed phase

Phase 17L.1 AI Output Language Preference is completed and validated in build/typecheck.

New AI generations now respect the current app locale:
- Frontend sends `X-App-Locale: en|es` from the existing i18n/localStorage preference.
- Backend normalizes the locale safely and falls back to English for invalid/missing values.
- Lead next steps, external email analysis, email reply draft generation, and external calendar analysis receive output locale.
- Mock and OpenAI providers generate natural-language output in English or Spanish.
- New `AiSuggestion.metadataJson` includes `outputLocale` and `outputLanguage`.
- Existing saved AI outputs remain unchanged by design.
- No auto CRM changes, no auto email sending, and no automatic Gmail draft creation were added.


## Latest completed phase

Phase 17L.3 AI Suggestion Detail Component Refactor is completed and validated.

The AI Suggestion Detail page was refactored into focused frontend components:
- `AiSuggestionHero`
- `AiSuggestionSummaryCards`
- `AiRecommendationSection`
- `AiSourceContextSection`
- `AiSafetyPanel`
- `AiAdvancedMetadataSection`
- `DetailPrimitives`

`page.tsx` keeps the important logic:
- fetch/state
- permissions
- handlers
- accept/reject
- apply actions
- explicit Gmail draft creation

Behavior preserved:
- No API calls changed.
- No routes changed.
- No auth/RBAC changed.
- No action visibility rules changed.
- No disabled/applied states changed.
- No safety flags changed.
- No AI generation changed.
- AI-generated text still displays exactly as stored.

## Latest completed phase

Phase 18A Production Readiness Audit is completed and validated.

Audit conclusion:
- Local demo / early private beta level.
- Private beta needs work.
- Public production is blocked until production config, secrets, CI/CD, rate limiting, Google OAuth production readiness, backups, monitoring/logging, and background workers are addressed.

Top blockers:
- No CI/CD pipeline.
- No API rate limiting.
- Production secrets strategy not defined.
- Google OAuth production config not finalized.
- No backup/restore plan.
- No monitoring/logging strategy.
- Worker/background sync not implemented.
- Docker production commands need verification.
- API port config mismatch: config exposes `API_PORT`, but `main.ts` listens on `4000` directly.

## Latest completed phase

Phase 18C CI/CD and Smoke Tests is completed and validated.

Implemented:
- GitHub Actions CI workflow for PRs and pushes to main.
- Static smoke checks.
- Generated artifact guard.
- CI-safe dummy environment variables.
- Validation commands for Prisma schema, web typecheck, API build, and full build.

Validation passed:
- `corepack pnpm smoke:static`
- `corepack pnpm check:generated`
- `corepack pnpm db:validate`
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`
- `corepack pnpm --filter @sales-ai/api build`
- `corepack pnpm build`

No runtime behavior, backend routes, Prisma schema, auth/RBAC, OAuth, AI, email, Gmail, CRM automation, or background jobs changed.


## Latest completed phase

Phase 18D Security Hardening and Rate Limiting is completed and validated locally.

Implemented:
- In-memory rate limiting for sensitive API areas:
  - auth login
  - auth refresh
  - Google OAuth start/callback
  - manual Gmail/Calendar sync
  - AI generation
  - explicit Gmail draft creation
- Basic anti-brute-force login protection by IP and email.
- Security headers similar to Helmet without adding new dependencies.
- `X-Request-Id` generation/acceptance and CORS exposure.
- Global exception filter with token/secret redaction.
- Generic 500 responses for uncontrolled server errors.
- Configurable request body limit via `REQUEST_BODY_LIMIT=1mb`.
- Security hardening documentation in `docs/security-hardening.md`.

Validation passed locally:
- `corepack pnpm --filter @sales-ai/api build`
- `corepack pnpm db:validate`
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`
- `corepack pnpm smoke:static`
- `corepack pnpm check:generated`
- `corepack pnpm build`
- `git diff --check`

Known production limitation:
- Current rate limiting is per-process. Multi-instance production still needs Redis/shared rate limiting or ingress/proxy-level rate limiting.

Remaining production security work:
- Structured logging and redaction policy.
- Alerts for 401/403/429/500 spikes.
- RBAC and tenant-isolation tests.
- Runtime smoke tests in staging.
- Google OAuth production hardening.
- Backup/restore drill.
- Background/scheduled sync workers.

## Latest completed phase

Phase 18E Google OAuth Production Hardening is completed and validated locally.

Implemented:
- Google OAuth production checklist.
- Production-only config validation for Google OAuth settings.
- `FRONTEND_URL` support for OAuth success redirects.
- Fallback aliases for Google env vars while preserving canonical `GOOGLE_OAUTH_*` names.
- Static smoke checks updated for Google OAuth production docs/config.
- OAuth audit documented start/callback endpoints, state handling, scopes, token encryption, refresh behavior, and disconnect behavior.

Validation passed:
- `git diff --check`
- `corepack pnpm smoke:static`
- `corepack pnpm check:generated`
- `corepack pnpm db:validate`
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`
- `corepack pnpm --filter @sales-ai/api build`
- `corepack pnpm build`

Remaining Google OAuth production blockers:
- Google consent screen / branding setup.
- Test users vs production publishing decision.
- Google verification and possible security assessment for Gmail scopes.
- Staging OAuth smoke test with real Google test account.
- Monitoring for OAuth/token refresh/sync failures.

## Latest completed phase

Phase 18F Logging and Monitoring Foundation is completed and validated locally.

Implemented:
- `SafeLoggerService` with JSON/pretty log formats, log levels, redaction, and safe identifier hashing.
- Request completion logging using existing `X-Request-Id`.
- Successful `/api/health` logs are kept quiet to reduce noise.
- Global exception filter now uses structured safe logs.
- Event logs for auth, rate limits, Google OAuth, connected account disconnects, Gmail/Calendar sync, token refresh failures, AI generation, AI usage, and explicit Gmail draft creation.
- Logging config via `LOG_LEVEL`, `REQUEST_LOGGING_ENABLED`, `LOG_FORMAT`, and `LOG_REDACT_SENSITIVE`.
- Observability runbook in `docs/observability-runbook.md`.

Validation passed:
- `git diff --check`
- `corepack pnpm smoke:static`
- `corepack pnpm check:generated`
- `corepack pnpm db:validate`
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`
- `corepack pnpm --filter @sales-ai/api build`
- `corepack pnpm build`

Remaining observability blockers:
- No external log/monitoring provider wired yet.
- No dashboards or alert rules provisioned.
- No uptime monitor configured.
- Worker observability remains pending until workers exist.
- Rate limiting remains process-local until Redis/shared limiter or ingress limiter.

## Latest completed phase

Phase 18H Backup and Restore Runbook is completed and validated.

Implemented:
- Provider-neutral Postgres backup/restore runbook.
- Critical data inventory.
- Migration safety checklist.
- Restore drill plan.
- Initial RPO/RTO recommendations.
- Incident response checklist.
- Backup security/privacy notes.
- Special handling for `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` and key version.

Validation passed:
- `git diff --check`
- `corepack pnpm smoke:static`
- `corepack pnpm check:generated`
- `corepack pnpm db:validate`
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`
- `corepack pnpm --filter @sales-ai/api build`
- `corepack pnpm build`

Remaining blockers:
- Execute a real restore drill in staging or isolated DB.
- Confirm managed backups/PITR with selected provider.
- Define retention policy.
- Design OAuth token encryption key rotation.

## Latest completed phase

Phase 18I Private Beta Deployment Execution Readiness is completed and validated.

Implemented:
- Private beta deployment plan.
- Staging provider checklist.
- Staging environment template.
- Recommended first architecture:
  - managed Next.js/web hosting
  - managed API container/web service
  - managed Postgres
  - Redis/workers deferred
  - provider-native logs first
  - AI starts with `AI_PROVIDER=mock`
- Exact staging deployment order.
- Go/no-go checklist.
- GitHub Actions billing fallback.
- Auth Recovery/Forgot Password decision documented as future phase.

Validation passed:
- `git diff --check`
- `corepack pnpm smoke:static`
- `corepack pnpm check:generated`
- `corepack pnpm db:validate`
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`
- `corepack pnpm --filter @sales-ai/api build`
- `corepack pnpm build`

No deployment, real secrets, Prisma/schema/API/routes/runtime behavior changes.