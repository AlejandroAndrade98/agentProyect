# Deployment Checklist and Runbook

Date: 2026-05-31

This runbook prepares deployment but does not deploy the app. It is provider-neutral and assumes a first private beta architecture:

- Frontend: managed Next.js hosting or a web container.
- API: managed container/web service running NestJS.
- Database: managed PostgreSQL.
- Redis: managed Redis later, when background workers are enabled.
- Workers: deferred until Phase 18F or deployed as a separate worker service later.

This is preferred over serverless Lambda for the first beta because it avoids re-architecting the NestJS API, Prisma lifecycle, OAuth callback behavior, and future worker process model. It is the fastest path to a controlled beta.

## 1. Pre-Deploy Checks

Run locally or in CI before deployment:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm smoke:static
corepack pnpm check:generated
corepack pnpm db:validate
corepack pnpm --filter @sales-ai/web exec tsc --noEmit
corepack pnpm --filter @sales-ai/api build
corepack pnpm build
```

Confirm:

- No generated artifacts are committed accidentally.
- No real secrets appear in `.env.example`, docs, logs, or source.
- `NEXT_PUBLIC_API_URL` points to the target API URL and includes `/api`.
- `CORS_ORIGIN` includes the target frontend origin.
- `GOOGLE_OAUTH_REDIRECT_URI` matches the production or staging API callback URL.
- `FRONTEND_URL` points to the frontend URL that should receive successful Google OAuth callbacks.
- `REQUEST_BODY_LIMIT` is conservative for the deployed API.
- Security hardening notes are reviewed in [security-hardening.md](./security-hardening.md).
- Google OAuth production readiness is reviewed in [google-oauth-production-checklist.md](./google-oauth-production-checklist.md).
- Observability runbook is reviewed in [observability-runbook.md](./observability-runbook.md).
- Staging runtime smoke tests are reviewed in [staging-runtime-smoke-tests.md](./staging-runtime-smoke-tests.md).
- Backup and restore runbook is reviewed in [backup-restore-runbook.md](./backup-restore-runbook.md).
- Private beta deployment plan is reviewed in [private-beta-deployment-plan.md](./private-beta-deployment-plan.md).
- Provider setup checklist is filled in from [staging-provider-checklist.md](./staging-provider-checklist.md).
- Staging env vars are prepared from [staging-env-template.md](./staging-env-template.md).

CI foundation:

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main`.
- CI uses Node 20 because the repository engines and version files require `>=20 <21`.
- CI enables Corepack, installs with `corepack pnpm install --frozen-lockfile`, runs static smoke checks, verifies generated artifacts are clean, validates Prisma schema, typechecks the web app, builds the API, and runs the monorepo build.
- CI uses dummy environment values only. It does not deploy, run migrations against a live database, connect Google OAuth, call OpenAI, send email, create Gmail drafts, create CRM records, or start background jobs.
- No Postgres service is required for the current CI path because `db:validate` performs Prisma schema validation only.
- Staging runtime smoke tests are available through `corepack pnpm smoke:runtime`, but they require a running local/staging API and explicit smoke env vars. CI does not run them by default.
- If GitHub Actions is temporarily blocked by account billing, run the CI-equivalent local command set from [private-beta-deployment-plan.md](./private-beta-deployment-plan.md) before deployment.

## 2. Required Runtime Configuration

Minimum required for API:

- `NODE_ENV=production`
- `PORT` from managed provider, or `API_PORT` when manually configured
- `REQUEST_BODY_LIMIT`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `AUTH_RECOVERY_DEV_MODE=false`
- `AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `PASSWORD_RESET_PUBLIC_URL` or `FRONTEND_URL`
- `EMAIL_PROVIDER`
- `EMAIL_DELIVERY_ENABLED`
- `EMAIL_FROM` when using Resend
- `EMAIL_REPLY_TO` optional
- `EMAIL_APP_NAME`
- `EMAIL_PUBLIC_APP_URL` or `FRONTEND_URL`
- `RESEND_API_KEY` when using Resend
- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY`
- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION`
- `AI_PROVIDER`
- `LOG_LEVEL`
- `REQUEST_LOGGING_ENABLED`
- `LOG_FORMAT`
- `LOG_REDACT_SENSITIVE`

Required when Google OAuth is enabled:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

Required when OpenAI is enabled:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_MAX_INPUT_CHARS`

Minimum required for web:

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_URL`

Temporary one-off bootstrap env vars for an empty staging database:

- `BOOTSTRAP_ADMIN_ENABLED=true`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ORGANIZATION_NAME`
- `BOOTSTRAP_ADMIN_ROLE=OWNER`

Remove `BOOTSTRAP_ADMIN_PASSWORD` and disable `BOOTSTRAP_ADMIN_ENABLED` after the first owner/admin is created.

See [env-production-checklist.md](./env-production-checklist.md) for the full table.

## 3. Database Migration Runbook

Never run `prisma migrate dev` in production.

Production migration flow:

1. Take or verify a fresh managed Postgres backup. Follow [backup-restore-runbook.md](./backup-restore-runbook.md).
2. Confirm the migration files in `packages/database/prisma/migrations` are the intended release set.
3. Validate schema:

   ```bash
   corepack pnpm db:validate
   ```

4. Run production migrations:

   ```bash
   corepack pnpm db:deploy
   ```

5. Deploy API after migrations if the API expects the new schema.
6. If the staging database is empty, run `corepack pnpm bootstrap:staging-admin` once from the API service environment.
7. Remove temporary bootstrap password/env values from the provider.
8. Run smoke tests.

Rollback notes:

- Prisma migrations are not automatically reversible.
- For destructive changes, create a separate rollback plan before deploying.
- If a migration corrupts data or schema, restore from backup or apply an explicitly prepared corrective migration.
- Do not roll back application code past a schema-incompatible migration without a compatibility plan.
- Confirm `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` and `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION` are available in the secret manager before restore. Database backup alone is not enough for encrypted Google tokens.

## 4. API Deployment Steps

Recommended command after build:

```bash
corepack pnpm --filter @sales-ai/api start
```

Equivalent direct runtime:

```bash
node apps/api/dist/main.js
```

Notes:

- The API reads provider `PORT` first, then `API_PORT`, then falls back to `4000`.
- The API logs the actual listen port.
- Health endpoint: `GET /api/health`.
- Ensure the runtime has Prisma client generated during install/build.
- Do not set `DATABASE_URL_HOST` in hosted staging/production providers; use `DATABASE_URL` only.

## 5. Web Deployment Steps

Recommended command after build:

```bash
corepack pnpm --filter @sales-ai/web start
```

Notes:

- `NEXT_PUBLIC_API_URL` is baked into the Next.js client bundle at build time.
- Rebuild the web app when changing `NEXT_PUBLIC_API_URL`.
- If using a web container, set `PORT` or `WEB_PORT` according to the provider/container strategy.

## 6. Docker Notes

Existing Dockerfiles are suitable as a baseline, with these assumptions:

- API Docker command: `node apps/api/dist/main.js`
- Worker Docker command: `node apps/worker/dist/main.js`
- Web Docker command: `corepack pnpm --filter @sales-ai/web start`
- API and web Dockerfiles use Corepack and frozen pnpm installs for deterministic monorepo builds.

Docker compose:

- API host/container port follows provider `PORT`, then `API_PORT`, with fallback `4000`.
- Web host/container port follows `WEB_PORT` with fallback `3000`, and compose maps `PORT` for Next.
- Compose is useful for local/self-hosted testing, but managed Postgres is preferred for beta production.

## 7. Post-Deploy Smoke Tests

Follow the complete first-deploy order in [private-beta-deployment-plan.md](./private-beta-deployment-plan.md).

Run the automated runtime smoke in staging first:

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_EMAIL=<staging-user> \
SMOKE_PASSWORD=<staging-password> \
SMOKE_VERBOSE=true \
corepack pnpm smoke:runtime
```

The default runtime smoke is read-only except for login/session token creation. Optional CRM mutation, AI generation, and external sync checks require explicit env flags. See [staging-runtime-smoke-tests.md](./staging-runtime-smoke-tests.md).

Manual checks after the automated smoke:

1. `GET https://<api-domain>/api/health` returns healthy DB check.
2. Open the frontend URL.
3. Login with a staging user.
4. Confirm session loads `/dashboard`.
5. After the access token expires, confirm authenticated UI requests recover through `/auth/refresh` and stay on the dashboard.
6. Request forgot password and confirm the transactional reset email is received when `EMAIL_DELIVERY_ENABLED=true`.
7. Create a test organization/user invitation and confirm the invitation email is received when `EMAIL_DELIVERY_ENABLED=true`.
8. Load CRM list endpoints through the UI, such as companies, contacts, leads, tasks, or notes.
9. Create and delete/archive a temporary CRM record if safe for the environment.
10. Open Settings.
11. If using Google in staging, connect Google OAuth with a test user.
12. Run manual Gmail sync.
13. Run manual Calendar sync.
14. Generate a mock AI suggestion, or a minimal OpenAI suggestion if the environment intentionally uses OpenAI.
15. Confirm AI analysis does not send email automatically.
16. Confirm AI analysis does not create CRM records automatically.
17. If testing reply drafts, confirm Gmail draft creation requires an explicit click and does not send the email.
18. Switch language EN/ES and confirm the UI still renders.

Confirm at least one smoke request ID is visible in API logs and correlates with `http.request.completed`.

## 8. Backup and Restore Minimum Plan

Before private beta:

- Complete [backup-restore-runbook.md](./backup-restore-runbook.md).
- Use managed Postgres automated daily backups.
- Enable point-in-time recovery if available.
- Document backup retention duration.
- Run one restore drill into a separate staging database.
- Confirm restored DB can boot the API and pass health checks.
- Confirm restored DB passes `corepack pnpm smoke:runtime`.
- Confirm backup storage is encrypted and access-restricted.
- Confirm the connected account token encryption key and version are backed up in the secret manager or password vault.

For self-hosted Docker only:

- Do not rely only on Docker volumes.
- Schedule `pg_dump` or provider equivalent.
- Store backups off-host.
- Encrypt backups at rest.
- Test restore before onboarding beta users.

## 9. Google OAuth Checklist

Before enabling Google for beta:

- Complete [google-oauth-production-checklist.md](./google-oauth-production-checklist.md).
- Configure OAuth consent screen.
- Add test users if app verification is not complete.
- Register exact callback URL:

  ```text
  https://<api-domain>/api/connected-accounts/oauth/google/callback
  ```

- Set `GOOGLE_OAUTH_REDIRECT_URI` to the same URL.
- Set `FRONTEND_URL` to the frontend app URL.
- Set `CORS_ORIGIN` to exact frontend origins; do not use wildcards.
- Confirm requested scopes:
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.compose`
  - `https://www.googleapis.com/auth/calendar.events.readonly`
- Test connect, manual Gmail sync, manual Calendar sync, disconnect, and reconnect.
- Test token refresh by running sync after access token expiry or in a staging scenario that forces refresh.
- Confirm Google OAuth callback redirects to `/dashboard/settings/connected-accounts?connected=google`.
- Confirm Google verification/security assessment requirements before broad external production access.

## 10. OpenAI Checklist

Before enabling `AI_PROVIDER=openai`:

- Store `OPENAI_API_KEY` in the secret manager.
- Confirm `OPENAI_MODEL`.
- Confirm `AI_MAX_INPUT_CHARS`.
- Run one staging generation in English and Spanish.
- Confirm AI usage records and credit debits are created.
- Confirm no email or CRM record is created automatically.

## 11. Monitoring and Logging Placeholders

Before production:

- Confirm structured API logs with request IDs are enabled.
- Confirm log redaction for tokens, auth headers, OAuth codes, provider tokens, and secrets remains enabled.
- Add uptime check for `/api/health`.
- Add error monitoring for API and web.
- Add alerts for:
  - API health failure
  - DB connectivity failure
  - elevated 401/403/429/500 rates
  - Google OAuth failure spike
  - AI provider failure spike
  - AI usage/credit exhaustion
- Confirm logs do not contain email bodies, Gmail snippets, AI output text, OAuth tokens, authorization headers, cookies, passwords, or Gmail draft bodies.
- Confirm staging smoke tests emit traceable `X-Request-Id` values.
- Run `corepack pnpm smoke:runtime` against staging and verify request IDs in logs before beta promotion.

## 12. Rollback Notes

Application rollback:

- Keep the previous image/build available.
- Roll back web and API independently if schema-compatible.
- Do not roll back API behind incompatible migrations.

Database rollback:

- Prefer restore from backup for severe migration/data failures.
- Prepare corrective migrations for small schema issues.
- Do not run `migrate dev` or manual destructive SQL in production without an approved incident plan.

## Latest completed phase

Phase 18G Staging Runtime Smoke Test Plan and Scripts is completed and validated locally.

Implemented:
- `smoke:runtime` script for safe local/staging runtime checks.
- Read-only default checks for health, auth, `/users/me`, dashboard summary, CRM read endpoints, AI suggestions read, and `X-Request-Id`.
- Optional mutation, AI generation, and external sync modes guarded by explicit env flags.
- Staging runtime smoke runbook.
- Deployment and observability docs updated.
- Static smoke checks now verify runtime smoke script/docs exist.

Validation passed:
- `git diff --check`
- `corepack pnpm smoke:static`
- `corepack pnpm check:generated`
- `corepack pnpm db:validate`
- `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`
- `corepack pnpm --filter @sales-ai/api build`
- `corepack pnpm build`
- `corepack pnpm smoke:runtime` fails gracefully without `SMOKE_API_URL`, as expected.

No backend, Prisma, routes, auth, OAuth, AI behavior, email sending, or dependencies changed.

Phase 18H Backup and Restore Runbook is completed and validated locally.

Implemented:
- Backup and restore runbook.
- Critical data inventory from Prisma schema.
- Encrypted Google OAuth token restore/key handling.
- Postgres backup/restore placeholder commands.
- Migration safety checklist.
- Restore drill plan and RPO/RTO recommendations.
- Incident response checklists.
- Deployment, env, observability, production readiness, and static smoke references updated.

No production database was contacted, no backup/restore command was run against real data, and no schema/runtime behavior changed.

Phase 18I Private Beta Deployment Execution Readiness is completed and validated locally.

Implemented:
- Private beta deployment plan.
- Provider-specific staging checklist template.
- Staging env variable template.
- Auth recovery / forgot password decision documented as future work.
- GitHub Actions billing fallback documented with local CI-equivalent commands.
- Deployment, env, staging smoke, backup/restore, production readiness, and static smoke references updated.

No deployment was performed, no real services were contacted, no secrets were added, and no runtime behavior changed.

Phase 18J Auth Recovery and Account Safety is completed and validated locally.

Implemented:
- Forgot password and reset password endpoints with generic request responses.
- Hashed, one-time, expiring password reset tokens.
- Refresh token revocation after successful password reset.
- Rate limiting for forgot/reset recovery endpoints.
- Frontend forgot/reset password pages with EN/ES i18n.
- Production guard rejecting auth recovery dev reset links.
- Security, environment, deployment, private beta, and static smoke references updated.

No email provider was configured, no real email was sent, no OAuth/AI/sync behavior changed, and no background jobs were added.
