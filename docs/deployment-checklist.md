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

CI foundation:

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main`.
- CI uses Node 20 because the repository engines and version files require `>=20 <21`.
- CI enables Corepack, installs with `corepack pnpm install --frozen-lockfile`, runs static smoke checks, verifies generated artifacts are clean, validates Prisma schema, typechecks the web app, builds the API, and runs the monorepo build.
- CI uses dummy environment values only. It does not deploy, run migrations against a live database, connect Google OAuth, call OpenAI, send email, create Gmail drafts, create CRM records, or start background jobs.
- No Postgres service is required for the current CI path because `db:validate` performs Prisma schema validation only.
- Staging runtime smoke tests are still required before any deployment.

## 2. Required Runtime Configuration

Minimum required for API:

- `NODE_ENV=production`
- `API_PORT`
- `REQUEST_BODY_LIMIT`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
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

See [env-production-checklist.md](./env-production-checklist.md) for the full table.

## 3. Database Migration Runbook

Never run `prisma migrate dev` in production.

Production migration flow:

1. Take or verify a fresh managed Postgres backup.
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
6. Run smoke tests.

Rollback notes:

- Prisma migrations are not automatically reversible.
- For destructive changes, create a separate rollback plan before deploying.
- If a migration corrupts data or schema, restore from backup or apply an explicitly prepared corrective migration.
- Do not roll back application code past a schema-incompatible migration without a compatibility plan.

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

- The API now reads `API_PORT` through Nest config and falls back to `4000`.
- The API logs the actual listen port.
- Health endpoint: `GET /api/health`.
- Ensure the runtime has Prisma client generated during install/build.

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
- Web Docker command: `pnpm --filter @sales-ai/web start`

Docker compose:

- API host/container port follows `API_PORT` with fallback `4000`.
- Web host/container port follows `WEB_PORT` with fallback `3000`, and compose maps `PORT` for Next.
- Compose is useful for local/self-hosted testing, but managed Postgres is preferred for beta production.

## 7. Post-Deploy Smoke Tests

Run in staging first:

1. `GET https://<api-domain>/api/health` returns healthy DB check.
2. Open the frontend URL.
3. Login with a staging user.
4. Confirm session loads `/dashboard`.
5. Load CRM list endpoints through the UI, such as companies, contacts, leads, tasks, or notes.
6. Create and delete/archive a temporary CRM record if safe for the environment.
7. Open Settings.
8. If using Google in staging, connect Google OAuth with a test user.
9. Run manual Gmail sync.
10. Run manual Calendar sync.
11. Generate a mock AI suggestion, or a minimal OpenAI suggestion if the environment intentionally uses OpenAI.
12. Confirm AI analysis does not send email automatically.
13. Confirm AI analysis does not create CRM records automatically.
14. If testing reply drafts, confirm Gmail draft creation requires an explicit click and does not send the email.
15. Switch language EN/ES and confirm the UI still renders.

## 8. Backup and Restore Minimum Plan

Before private beta:

- Use managed Postgres automated daily backups.
- Enable point-in-time recovery if available.
- Document backup retention duration.
- Run one restore drill into a separate staging database.
- Confirm restored DB can boot the API and pass health checks.

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

## 12. Rollback Notes

Application rollback:

- Keep the previous image/build available.
- Roll back web and API independently if schema-compatible.
- Do not roll back API behind incompatible migrations.

Database rollback:

- Prefer restore from backup for severe migration/data failures.
- Prepare corrective migrations for small schema issues.
- Do not run `migrate dev` or manual destructive SQL in production without an approved incident plan.
