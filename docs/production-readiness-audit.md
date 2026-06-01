# Production Readiness Audit

Date: 2026-05-31  
Scope: Sales AI Platform repository audit only. No application behavior, API contracts, Prisma schema, routes, dependencies, or deployment config were changed.

Phase 18B follow-up: API port alignment, web Docker start command, production env checklist, and deployment runbook were prepared after this audit.

Phase 18C follow-up: a GitHub Actions CI foundation, static smoke script, and generated-artifact guard were added.

Phase 18D follow-up: process-local rate limiting, auth brute-force protection, API security headers, request body limits, request IDs, and production-safe exception redaction were added.

Phase 18E follow-up: Google OAuth production configuration was hardened with `FRONTEND_URL` callback support, production-only config validation, OAuth env aliases, and a production OAuth checklist. Remaining blockers still include Google verification/security assessment completion, distributed rate limiting for multi-instance deployments, deployment automation, structured monitoring/logging, backup restore drills, staging runtime smoke tests, tenant/RBAC test coverage, and background worker implementation.

Phase 18F follow-up: structured API logging, request completion logging, safe event logs for auth/OAuth/sync/AI/rate-limit flows, logging env controls, and an observability runbook were added. Remaining blockers still include external monitoring/alert provisioning, staging runtime smoke validation, distributed rate limiting for multi-instance deployments, Google verification/security assessment completion, backup restore drills, tenant/RBAC test coverage, and background worker implementation.

Phase 18G follow-up: a safe staging/local runtime smoke script and runbook were added. The smoke defaults to read-only checks, verifies request IDs, supports optional explicit CRM mutation cleanup, optional mock AI smoke, and optional manual external sync smoke. Remaining blockers still include actually running the smoke in staging, deployment automation, external monitoring/alert provisioning, distributed rate limiting for multi-instance deployments, Google verification/security assessment completion, backup restore drills, tenant/RBAC test coverage, and background worker implementation.

Phase 18H follow-up: a provider-neutral backup and restore runbook was added, including critical data inventory, encrypted OAuth token key handling, Postgres backup/restore commands, migration safety, restore drill plan, RPO/RTO targets, privacy notes, and incident response checklists. Remaining blockers still include executing a staging restore drill, enabling/confirming managed backup/PITR settings with the deployment provider, deployment automation, external monitoring/alert provisioning, distributed rate limiting for multi-instance deployments, Google verification/security assessment completion, tenant/RBAC test coverage, and background worker implementation.

## 1. Executive Summary

Current readiness level: Local demo to early private beta.

Estimated status:

- Local demo: Mostly ready
- Private beta: Needs work
- Public production: Blocked

Short recommendation: finish production environment decisions, CI/CD, rate limiting, monitoring, database backup/recovery, Google OAuth production configuration, and worker/background job strategy before any public production launch. A controlled private beta is realistic after a small deployment hardening pass and a smoke-test pipeline.

## 2. Production Readiness Matrix

| Area | Status | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Frontend build | Ready | `apps/web/package.json` has `build`; `corepack pnpm build` succeeds. | Low. | Keep build as required CI step. |
| Backend build | Ready | `apps/api/package.json` has `build`; `corepack pnpm --filter @sales-ai/api build` succeeds via full build. | Low. | Keep API build as required CI step. |
| Database migrations | Mostly ready | Prisma schema and timestamped migrations exist; root has `db:deploy`. | Production deploy can fail without a migration runbook. | Use `prisma migrate deploy` in release flow and document rollback/restore steps. |
| Environment variables | Needs decision | `.env.example` exists but is development-oriented. | Missing/weak secrets or wrong URLs can break auth, OAuth, CORS, AI, and token encryption. | Create production-specific env checklist and secret generation process. |
| Authentication | Needs small fix | JWT access/refresh tokens exist; refresh tokens are hashed and rotated. Frontend stores tokens in `localStorage`; refresh flow is not used client-side. | XSS token exposure risk; sessions expire without transparent refresh. | Decide session storage model before public production; wire refresh or use secure cookies. |
| Authorization/RBAC | Mostly ready | `JwtAuthGuard`, `RolesGuard`, role groups, and SUPER_ADMIN platform guards exist. | Route-level RBAC depends on consistent controller coverage. | Add RBAC smoke tests for representative roles. |
| Tenant isolation | Mostly ready | Most service queries include `organizationId`; auth guard validates active user and organization. | Any missed query can leak tenant data. | Add tenant-isolation tests for CRUD/list/detail/apply flows. |
| CORS | Needs decision | `main.ts` reads `CORS_ORIGIN`, supports comma-separated origins, includes `X-App-Locale`. | Wrong origins can block production frontend or allow too much access. | Set exact production origins; avoid wildcards. |
| Secrets management | Blocker | `.env.example` uses placeholder secrets; no production secret manager documented. | Weak/leaked secrets compromise JWTs, OAuth tokens, and database access. | Choose secret manager and generate strong JWT/token encryption keys. |
| OAuth token encryption | Mostly ready | AES-256-GCM service validates a 32-byte base64 key and stores encrypted tokens. | No documented key rotation procedure; version mismatch blocks decrypt. | Document key generation, rotation, and emergency revoke procedure. |
| Google OAuth production readiness | Partially ready | OAuth start/callback, state hashing, token exchange, encrypted token storage, token refresh, disconnect flows, `FRONTEND_URL` callback redirect support, production config validation, and production checklist exist. | Google Cloud consent screen, verification/security assessment, test users, and staging QA are still external setup tasks. | Complete Google OAuth checklist and staging reconnect/refresh/sync QA before beta. |
| Gmail sync | Needs small fix | Manual sync endpoint stores Gmail metadata only, max 10, excludes trash/spam, refreshes token. | No background schedule; limited pagination; operational errors stored in DB. | Keep manual sync for beta; design worker sync for production. |
| Calendar sync | Needs small fix | Manual calendar sync endpoint stores upcoming 30 days, max 10, refreshes token. | No incremental sync token use; no background schedule. | Implement worker-driven incremental sync before broader use. |
| AI provider/OpenAI | Mostly ready | Mock/OpenAI provider flow exists, output locale is supported, usage is recorded. | OpenAI production key/model/cost policy not finalized. | Define AI provider env, model policy, timeout/retry limits, and error handling expectations. |
| AI usage governance | Mostly ready | Organization/user limits, credit balance, records, and transactions exist. | Credit unit is approximate; no billing integration or alerting. | Good for beta; add alerts and billing reconciliation later. |
| Human-in-the-loop safety | Ready | AI suggestions require review; apply endpoints are explicit; safety metadata is stored. | Low if UI and API controls remain unchanged. | Keep safety tests for accept/reject/apply/Gmail draft paths. |
| Email sending safety | Ready | No send email endpoint found; Gmail draft creation is explicit and accepted-suggestion only. | Low. | Preserve no-send invariant in tests. |
| Logging/error handling | Mostly ready for beta | Structured JSON logs, request IDs, request completion logs, safe exception logging, and safe domain event logs exist for auth/OAuth/sync/AI/rate-limit flows. | No external monitoring provider, dashboard, or alert rules are provisioned yet. | Connect logs to a provider and configure alerts before public production. |
| Rate limiting | Partially ready | Sensitive auth, OAuth, sync, AI generation, and Gmail draft creation endpoints use process-local throttling. | In-memory buckets do not coordinate across multiple API instances. | Add shared ingress/Redis-backed rate limiting before multi-instance or public production. |
| Background jobs/sync | Blocker | `apps/worker` starts an application context; Redis/BullMQ dependency exists but no queues/jobs are wired. | Production sync, cleanup, retention, and retries are manual or absent. | Define worker responsibilities and queue architecture. |
| CI/CD | Partially ready | `.github/workflows/ci.yml` runs install, static smoke checks, generated-artifact guard, Prisma validate, web typecheck, API build, and monorepo build on PRs and pushes to `main`. Runtime smoke script exists for local/staging. | No deployment automation, automated staging runtime smoke gate, or migration deploy gate yet. | Keep CI required for PRs; run `corepack pnpm smoke:runtime` after staging deploy and automate it later. |
| Monitoring/health checks | Partially ready | API has `/api/health` with DB check, structured logs with request IDs, and a runtime smoke runbook for log correlation. | No external uptime monitor, dashboards, alert rules, or worker observability yet. | Add managed monitoring/alerts and run staging smoke logging checks before beta. |
| Backups/recovery | Partially ready | Backup and restore runbook exists with critical data inventory, OAuth encryption key handling, migration safety, and restore drill plan. | Managed backup/PITR settings and an actual staging restore drill are not yet verified. | Enable managed Postgres backups/PITR and complete one restore drill before private beta. |
| Data privacy | Needs decision | Email/calendar metadata is stored; body is intentionally not stored in current sync metadata. | Privacy policy, retention enforcement, export/delete flows are incomplete. | Define retention, deletion, and privacy controls before public launch. |
| Billing/plans | Later | Organization plan and limits exist in schema; billing provider not implemented. | Not required for internal/private beta. | Defer billing integration until product packaging is fixed. |
| Seed/demo data | Needs small fix | Seed script creates demo/platform data; `.env.example` is local-demo oriented. | Demo users/data can leak into production if seed is run accidentally. | Document production seeding policy; never seed demo credentials in prod. |
| Production deployment architecture | Needs decision | Dockerfiles and compose files exist, but production topology is not finalized. | Current Dockerfiles are basic and may not be deploy-optimal; web Docker `pnpm start` from root needs verification. | Pick target architecture and harden Docker/start commands accordingly. |

## 3. Environment Variables Checklist

Do not put real secret values in docs or source control.

| Group | Env var | Purpose | Required for production? | Risk if missing | Notes |
| --- | --- | --- | --- | --- | --- |
| Database | `DATABASE_URL` | Prisma runtime database connection. | Yes | API/worker cannot access DB. | Use production Postgres URL with SSL policy as required by provider. |
| Database | `DATABASE_URL_HOST` | Host-side Prisma CLI connection for local scripts. | No | Local migration commands may fail. | Usually not needed in hosted production runtime. |
| Database | `POSTGRES_DB` | Docker Postgres database name. | Only self-hosted Docker | DB container may start incorrectly. | Managed Postgres usually does not need this. |
| Database | `POSTGRES_USER` | Docker Postgres user. | Only self-hosted Docker | DB container may start incorrectly. | Managed Postgres usually does not need this. |
| Database | `POSTGRES_PASSWORD` | Docker Postgres password. | Only self-hosted Docker | DB access failure or weak DB credentials. | Must be strong if self-hosted. |
| Redis | `REDIS_URL` | Redis connection for future queues/cache. | Depends on worker strategy | Worker queues cannot run. | Present in example, but app currently does not wire Redis. |
| Redis | `REDIS_URL_HOST` | Host-side Redis URL for local tooling. | No | Local tooling only. | Usually not production runtime. |
| API/auth | `NODE_ENV` | Runtime mode. | Yes | Dev behavior/logging may leak into prod. | Set to `production`. |
| API/auth | `API_PORT` | Intended API port. | Yes | Port mismatch. | `main.ts` currently listens on `4000` directly; align implementation/config before deployment. |
| API/auth | `JWT_ACCESS_SECRET` | Access token signing secret. | Yes | Auth compromise if weak/missing. | Generate high-entropy secret. |
| API/auth | `JWT_REFRESH_SECRET` | Refresh token signing secret in env. | Possibly | Refresh tokens are random DB tokens, not JWTs in current code. | Keep or remove in a later config cleanup; do not rely on placeholder. |
| API/auth | `JWT_ACCESS_EXPIRES_IN` | Access token lifetime. | Yes | Tokens may be too long/short. | Example: `15m`. |
| API/auth | `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime. | Yes | Refresh creation fails if missing; session policy undefined. | Example: `7d`. |
| Frontend URLs | `WEB_PORT` | Web port for Docker/local. | Depends on hosting | Wrong local/container port. | Hosted platforms often ignore this. |
| Frontend URLs | `NEXT_PUBLIC_API_URL` | Browser API base URL. | Yes | Frontend cannot call API. | Must include `/api` based on current client. |
| CORS | `CORS_ORIGIN` | Allowed frontend origins and OAuth callback redirect base. | Yes | Browser requests blocked or origins too permissive. | Comma-separated exact origins. First origin is used for OAuth callback redirect. |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client id. | Yes for Google connect | OAuth connect fails. | Must match production OAuth client. |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret. | Yes for Google connect | Token exchange/refresh fails. | Store only in secret manager. |
| Google OAuth | `GOOGLE_OAUTH_REDIRECT_URI` | OAuth callback URL. | Yes for Google connect | Google rejects callback. | Must exactly match Google Cloud authorized redirect URI. |
| Token encryption | `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for OAuth tokens. | Yes for Google connect/sync | Cannot encrypt/decrypt OAuth tokens. | Must be base64 for exactly 32 bytes. |
| Token encryption | `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_VERSION` | Encryption key version marker. | Yes | Key rotation/version mismatch risk. | Example `v1`; document rotation. |
| OpenAI/AI | `AI_PROVIDER` | Selects `mock` or `openai`. | Yes | Unexpected mock/provider behavior. | Production should use explicit value. |
| OpenAI/AI | `OPENAI_API_KEY` | OpenAI API credential. | Yes if `AI_PROVIDER=openai` | AI generation fails. | Secret manager only. |
| OpenAI/AI | `OPENAI_MODEL` | OpenAI model name. | Yes if OpenAI | Uncontrolled model/cost behavior. | Define approved model policy. |
| OpenAI/AI | `AI_MAX_INPUT_CHARS` | Prompt/context length guard. | Yes | Cost and prompt-size risk. | Keep conservative for beta. |
| Email/Gmail | Google Gmail scopes | Gmail read/compose capabilities. | Yes for Gmail features | Sync/draft creation fails. | Scopes are code-defined, not env-defined. |
| Deployment/runtime | `EXPORTS_DIR` | Export file location. | Depends on export usage | Exports may fail or fill local disk. | Use durable storage before production exports. |
| Deployment/runtime | `BACKUPS_DIR` | Backup path for local Docker. | No for managed backups | False sense of backup coverage. | Production should use provider backup tooling. |
| Deployment/runtime | Retention envs | Retention policy day counts. | Recommended | Old data may accumulate. | Code enforcement should be verified before relying on them. |

## 4. Security Review

JWT and refresh tokens:

- Access tokens are JWTs signed with `JWT_ACCESS_SECRET`.
- Refresh tokens are random 64-byte hex strings, hashed with SHA-256 in the database, rotated on refresh, and revoked on logout.
- Frontend currently stores access and refresh tokens in `localStorage`. This is acceptable for local demos but raises XSS exposure risk for public production.
- Frontend stores refresh tokens but does not appear to call the refresh endpoint automatically.

Role guards and RBAC:

- `JwtAuthGuard` validates token, user active state, organization active state, and injects a minimal current-user context.
- `RolesGuard` enforces controller/handler roles.
- Platform organizations routes are protected with `Role.SUPER_ADMIN`.
- CRM read/write/delete role groups exist.

Tenant isolation:

- Most services scope queries by `organizationId`.
- Connected account access is additionally limited to the owning user unless the current role can manage organization accounts.
- Production should add automated tenant-isolation tests because this is a high-impact invariant.

Sensitive fields:

- `UsersService.getMe` selects safe user fields and excludes `passwordHash`.
- Auth login returns safe user fields.
- Some admin/user listing code should be included in a later test pass to confirm `passwordHash` never leaves the API.

OAuth token encryption:

- Connected account access and refresh tokens are encrypted with AES-256-GCM.
- Key length is validated.
- Encryption version is stored, but no rotation runbook exists.

CORS:

- CORS uses `CORS_ORIGIN`, supports comma-separated values, and allows `X-App-Locale`.
- Production must use exact allowed origins.

Error handling/logging:

- Default Nest error responses are used.
- Provider/API errors are sometimes stored in `lastError` or usage records. These should be redacted/classified before public production.
- No structured logger/redaction policy was found.

Rate limiting:

- No rate limiting middleware/module was found.
- This is a production blocker for login, OAuth, sync, and AI generation endpoints.

Debug mode risks:

- `.env.example` defaults to development and mock/local values.
- Production must explicitly set `NODE_ENV=production` and avoid demo secrets or seed data.

## 5. Google OAuth Production Checklist

Production requirements:

- Configure a production Google OAuth client.
- Add the exact redirect URI, currently shaped like: `https://<api-domain>/api/connected-accounts/oauth/google/callback`.
- Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI`.
- Ensure `CORS_ORIGIN` first origin is the intended frontend redirect base, because the OAuth callback redirects to `${firstCorsOrigin}/dashboard/settings/connected-accounts?connected=google`.

Scopes currently used:

- Base: `openid`, `email`, `profile`
- Gmail: `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.compose`
- Calendar: `https://www.googleapis.com/auth/calendar.events.readonly`

Capabilities:

- Gmail metadata sync is manual, stores headers/snippet metadata, and does not store body content.
- Calendar sync is manual and stores calendar event metadata.
- Gmail draft creation exists only as an explicit action from an accepted AI reply draft suggestion.
- No email sending endpoint was found.

Disconnect/reconnect:

- Users can request disconnect.
- Admin/owner-level roles can disconnect and clear encrypted tokens.
- Reconnect path should be verified after disconnect in a private beta test.

Token refresh:

- Access tokens are refreshed using encrypted refresh tokens when near expiry.
- Refresh errors ask users to reconnect.

Google verification:

- Gmail compose/read scopes may require Google app verification for external users.
- Private beta may use test users while verification is pending.

## 6. AI Safety and Governance Review

Ready safety controls:

- AI suggestions are human-in-the-loop.
- Suggestions can be accepted/rejected explicitly.
- Applying a lead next step, CRM task, CRM note, CRM lead, or Gmail draft is an explicit action.
- Gmail drafts are not created automatically.
- Emails are not sent automatically.
- CRM records are not created automatically.
- Output language preference exists through `X-App-Locale` and `metadataJson.outputLocale/outputLanguage`.
- AI usage records, credits, monthly limits, user limits, and transactions exist.

Missing for production-grade AI governance:

- Formal AI audit/reporting view for admins.
- Alerting for unusual AI spend or repeated failures.
- Provider timeout/retry policy.
- Redaction policy for sensitive prompt/error data.
- Admin controls for approved models/features.
- End-to-end safety tests for no-send/no-auto-CRM invariants.

## 7. Deployment Architecture Options

### Option A: Managed app platform plus managed Postgres/Redis

- Frontend hosting: Vercel/Netlify-style Next hosting or app platform web service.
- API hosting: Managed container/web service.
- Postgres: Managed Postgres.
- Redis: Managed Redis.
- Worker: Managed worker service/container.
- Pros: Fastest path to private beta, less ops burden.
- Cons: Need careful env, networking, and CORS/OAuth domain setup.
- Complexity: Low to medium.

### Option B: Container platform with separate web/API/worker

- Frontend hosting: Container running Next.
- API hosting: Container running Nest API.
- Postgres: Managed Postgres.
- Redis: Managed Redis.
- Worker: Container running worker process.
- Pros: Matches existing Docker direction; clear process separation.
- Cons: Current Dockerfiles/start commands need hardening; more ops responsibility.
- Complexity: Medium.

### Option C: Single VM or VPS with Docker Compose

- Frontend hosting: `web` compose service.
- API hosting: `api` compose service.
- Postgres: Local compose Postgres or managed external Postgres.
- Redis: Local compose Redis or managed external Redis.
- Worker: `worker` compose service.
- Pros: Simple mental model and close to local setup.
- Cons: Backups, monitoring, patching, scaling, TLS, and secrets become manual.
- Complexity: Medium now, high later.

## 8. Production Blockers

| Blocker | Why it matters | Suggested phase to fix |
| --- | --- | --- |
| Deployment automation not configured | CI validates builds and static smoke checks, and runtime smoke is available for staging, but no staging/prod deploy path or automated runtime smoke gate exists yet. | Next deployment phase |
| No distributed API rate limiting | App-level in-memory throttling exists, but multi-instance production needs shared enforcement. | 18G Private beta deployment |
| Production secrets strategy not defined | JWT, OAuth, DB, OpenAI, and token encryption secrets are high impact. | 18B Production env and deployment config |
| Google OAuth verification not completed | OAuth can remain limited to test users; Gmail scopes may require verification or security assessment for broad external use. | 18G Private beta deployment |
| No completed backup/restore drill | Backup and restore runbook exists, but CRM data, OAuth tokens, AI usage, and audit records still need a verified restore drill before beta. | Next deployment phase |
| No monitoring/logging strategy | Production failures are hard to detect/debug safely. | 18D Security hardening/rate limiting |
| Worker/background sync not implemented | Production sync, retries, retention, and cleanup cannot rely only on manual requests. | 18F Background sync workers |
| Docker production commands need verification | Existing Dockerfiles are basic; web Docker runs `pnpm start` from repo root while root has no `start` script. | 18B Production env and deployment config |
| API port config mismatch | `configuration.ts` exposes `API_PORT`, but `main.ts` listens on `4000` directly. | 18B Production env and deployment config |

## 9. Recommended Phase Plan

### 18B Production env and deployment config

- Goal: make runtime configuration deployable.
- Scope: production env checklist, secret generation notes, API port config alignment, Docker/start command hardening, migration deploy command, basic deployment runbook.
- Risk: medium, because config mistakes can break auth/OAuth.
- Validation: build API/web/worker images or equivalent platform build; run `prisma migrate deploy` against staging DB.

### 18C CI/CD and smoke tests

- Goal: prevent regressions before deployment.
- Scope: GitHub Actions or chosen CI for install, typecheck, API build, web build, Prisma validate, generated-artifact guard, and basic smoke tests.
- Risk: low.
- Validation: CI passes on PR and main branch.

### 18D Security hardening/rate limiting

- Goal: close public production security gaps.
- Scope: rate limiting, structured logging/redaction policy, error response review, auth/session decision, tenant-isolation tests.
- Risk: medium.
- Validation: abuse-rate tests, auth tests, RBAC tests, tenant-isolation tests.

### 18E Google OAuth production hardening

- Goal: make Google integration safe for real users.
- Scope: production OAuth app, redirect URI validation, verification/test-user plan, reconnect/disconnect QA, token refresh QA.
- Risk: medium.
- Validation: connect, sync Gmail, sync Calendar, refresh token, disconnect, reconnect in staging.

### 18F Background sync workers

- Goal: make sync/retention reliable beyond manual clicks.
- Scope: queue architecture, Redis/BullMQ wiring, scheduled Gmail/calendar sync, retry/backoff, retention cleanup jobs.
- Risk: medium to high.
- Validation: worker integration tests and staging soak test.

### 18G Private beta deployment

- Goal: deploy to a controlled beta environment.
- Scope: staging/prod environments, monitoring, managed backups, restore drill, OAuth test users, smoke checks, limited customer onboarding.
- Risk: medium.
- Validation: beta launch checklist, restore drill, and rollback drill.

## 10. Validation

Run during this audit:

- `git diff --check`: passed
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`: passed
- `corepack pnpm --filter @sales-ai/api build`: passed
- `corepack pnpm build`: passed

Generated artifacts restored after validation:

- `apps/web/tsconfig.tsbuildinfo`
- `apps/web/.turbo/turbo-build.log`
