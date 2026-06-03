# Private Beta Deployment Plan

Date: 2026-05-31

This is the main execution plan for the first staging/private beta deployment of Sales AI Platform. It does not deploy anything, connect to production services, add secrets, change runtime behavior, or change schema.

## Objective

Deploy a controlled staging/private beta environment that can support a small invited user group while preserving the core safety guarantees:

- No email is sent automatically.
- No Gmail draft is created automatically.
- No CRM record is created automatically by AI analysis.
- AI suggestions remain human-in-the-loop.
- Google OAuth, Gmail sync, Calendar sync, AI generation, login, and CRM reads are validated in staging before inviting users.

## Recommended First Architecture

Recommended first path:

- Frontend: Vercel-style managed Next.js hosting or a managed web container.
- API: managed container/web service running the NestJS API.
- Postgres: managed PostgreSQL.
- Redis: optional/deferred unless the selected host requires it or a later worker/rate-limit store phase needs it.
- Workers: deferred until the background sync phase.
- Logs: provider-native logs first.
- External monitoring: later, after the first staging smoke is stable.
- Backups: managed Postgres automated backups and point-in-time recovery if available.

Why this path:

- Fastest path to a controlled private beta.
- Avoids serverless/Lambda re-architecture for NestJS, Prisma, Google OAuth callbacks, and future worker processes.
- Fits the existing API start path: `node apps/api/dist/main.js`.
- Fits current web start path: `corepack pnpm --filter @sales-ai/web start`.
- Makes `corepack pnpm smoke:runtime` straightforward against a stable API URL.
- Keeps request ID logs close to the runtime where issues will be debugged.

## Architecture Alternatives

| Option | Shape | Notes |
| --- | --- | --- |
| A | Vercel-style web + Render/Railway/Fly-style API + managed Postgres | Recommended practical first path. Good separation of web/API/database and low ops burden. |
| B | All-in-one managed platform for web/API/Postgres | Good if the provider supports monorepo builds, persistent Postgres, secrets, logs, health checks, and rollback clearly. |
| C | AWS ECS/Fargate-style containers + managed Postgres | Stronger production path, but more setup and operational overhead for the first beta. |
| D | VPS/Docker Compose | Not recommended for first beta unless cost is the only priority. Backups, TLS, monitoring, patching, and secrets become manual. |

## Services To Create

For staging/private beta:

- Managed Postgres database.
- API service.
- Web service.
- Secret manager entries for API and web env vars.
- Google OAuth staging client or test-user configuration.
- Provider-native log access for API and web.
- API health check using `/api/health`.
- Managed backup/PITR configuration for Postgres.

Deferred:

- Redis, unless selected provider or future distributed rate limiting requires it.
- Worker service, until background jobs/sync are implemented.
- External monitoring vendor, after provider-native logs are verified.
- Public custom domains, unless needed for Google OAuth staging.

## Environment Variables

Use [staging-env-template.md](./staging-env-template.md) as the fill-in env checklist.

Important:

- Do not use `.env.example` values in staging except as shape examples.
- Do not paste real values into docs, tickets, screenshots, or chat.
- `NEXT_PUBLIC_API_URL` must include `/api`.
- `GOOGLE_OAUTH_REDIRECT_URI` must exactly match the URL registered in Google Cloud.
- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` must be a 32-byte base64 key and backed up in the secret manager/password vault.

## First Staging Deploy Run Order

1. Confirm repo clean enough for deployment and local validation passes.
2. Create staging Postgres.
3. Configure staging secrets.
4. Deploy API with `AI_PROVIDER=mock` first.
5. Run `corepack pnpm db:deploy` against staging.
6. Verify API health at `GET https://<api-domain>/api/health`.
7. Create the first staging `OWNER` with `corepack pnpm bootstrap:staging-admin`.
8. Remove bootstrap password/env values from the provider after the one-off run.
9. Deploy web with `NEXT_PUBLIC_API_URL=https://<api-domain>/api`.
10. Configure Google OAuth staging redirect URI.
11. Invite additional users through the existing owner/admin invitation flow.
12. Run `corepack pnpm smoke:runtime` read-only.
13. Run `corepack pnpm smoke:runtime` with mutations only if safe.
14. Run manual Google OAuth connect test.
15. Run manual Gmail sync.
16. Run manual Calendar sync.
17. Generate a mock AI suggestion.
18. Confirm logs and request IDs.
19. Confirm backup settings.
20. Run or schedule restore drill.
21. Invite limited beta users.
22. Document known limitations.

## First Staging Admin Bootstrap

Staging starts with an empty database after migrations. There is no public signup flow. Create the first owner/admin through the one-off CLI script only:

```bash
corepack pnpm bootstrap:staging-admin
```

Required temporary environment variables:

- `BOOTSTRAP_ADMIN_ENABLED=true`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ORGANIZATION_NAME`
- `BOOTSTRAP_ADMIN_ROLE=OWNER`

Safety notes:

- The script refuses to run unless explicitly enabled.
- It uses `DATABASE_URL` and ignores `DATABASE_URL_HOST`.
- It refuses to create a new bootstrap admin when users already exist unless `BOOTSTRAP_ALLOW_EXISTING_USERS=true`.
- It does not print the password, password hash, tokens, or secrets.
- Remove `BOOTSTRAP_ADMIN_PASSWORD` and disable `BOOTSTRAP_ADMIN_ENABLED` in Railway/provider variables immediately after the one-off run.
- Additional staging users should be invited through the existing owner/admin invitation flow.

## Local CI-Equivalent Validation

GitHub Actions may be blocked until account billing is resolved. CI exists and should not be removed. Before deployment, run the local equivalent:

```bash
corepack pnpm smoke:static
corepack pnpm check:generated
corepack pnpm db:validate
corepack pnpm --filter @sales-ai/web exec tsc --noEmit
corepack pnpm --filter @sales-ai/api build
corepack pnpm build
```

Once GitHub billing is resolved:

- Re-run GitHub Actions.
- Require the `Validate` workflow for `main`.
- Keep local validation as the fallback when provider CI is unavailable.

## API Deployment Notes

Build from repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @sales-ai/api build
```

Start command:

```bash
node apps/api/dist/main.js
```

Alternative root script:

```bash
corepack pnpm start:api
```

API requirements:

- `NODE_ENV=production`
- provider `PORT`, or `API_PORT` when manually configured
- `DATABASE_URL`
- exact `CORS_ORIGIN`
- `FRONTEND_URL`
- production-strength JWT and connected account encryption secrets
- transactional email env for Resend when inviting real users:
  - `EMAIL_PROVIDER=resend`
  - `EMAIL_DELIVERY_ENABLED=true`
  - `EMAIL_FROM`
  - `EMAIL_REPLY_TO` optional
  - `EMAIL_APP_NAME=Sales AI Platform`
  - `EMAIL_PUBLIC_APP_URL`
  - `RESEND_API_KEY`
- `REQUEST_BODY_LIMIT=1mb` unless a documented endpoint needs more
- health check path: `/api/health`
- do not set `DATABASE_URL_HOST` in hosted staging/production providers; use `DATABASE_URL` only

Transactional email notes:

- Resend is the first transactional email provider.
- Password reset and organization invitation links are emailed when delivery is enabled.
- Local/dev can use `EMAIL_PROVIDER=none` and `EMAIL_DELIVERY_ENABLED=false`.
- The app does not use Gmail API for transactional email, does not send marketing email, and does not send CRM emails automatically.
- Verify the Resend sender/domain before inviting real customers.

## Web Deployment Notes

Build from repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @sales-ai/web build
```

Start command:

```bash
corepack pnpm --filter @sales-ai/web start
```

Web requirements:

- `NEXT_PUBLIC_API_URL=https://<api-domain>/api`
- Rebuild the web app when `NEXT_PUBLIC_API_URL` changes.
- Keep access-token lifetimes short. The frontend refreshes an expired access token through the existing `/auth/refresh` flow and retries the failed authenticated request once.

## Database Migration Steps

Before migration:

```bash
corepack pnpm smoke:static
corepack pnpm check:generated
corepack pnpm db:validate
corepack pnpm --filter @sales-ai/api build
corepack pnpm build
```

Then:

1. Confirm backup/PITR exists.
2. Confirm `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` and version are available in the secret manager.
3. Run:

   ```bash
   corepack pnpm db:deploy
   ```

4. Start or restart API.
5. Verify `/api/health`.
6. Run runtime smoke.

Never run `prisma migrate dev` in staging or production.

## Google OAuth Staging Setup

Use [google-oauth-production-checklist.md](./google-oauth-production-checklist.md) for the full checklist.

Staging values:

```text
WEB_URL=https://app-staging.example.com
API_BASE_URL=https://api-staging.example.com/api
GOOGLE_REDIRECT_URI=https://api-staging.example.com/api/connected-accounts/oauth/google/callback
```

Required checks:

- Google Cloud authorized redirect URI exactly matches `GOOGLE_OAUTH_REDIRECT_URI`.
- OAuth consent screen has the staging test user.
- `FRONTEND_URL` is the staging web URL.
- `CORS_ORIGIN` is the staging web URL.
- Connect Google from Settings.
- Confirm callback returns to `/dashboard/settings/connected-accounts?connected=google`.
- Run manual Gmail sync.
- Run manual Calendar sync.
- Disconnect/reconnect if testing admin flows.

## AI Setup

Start staging with:

```text
AI_PROVIDER=mock
```

This avoids external spend and makes smoke tests deterministic enough for beta readiness.

If staging intentionally tests OpenAI:

- Store `OPENAI_API_KEY` in secret manager only.
- Confirm `OPENAI_MODEL`.
- Run one minimal generation in English and Spanish.
- Confirm AI usage and credit records.
- Confirm no email/CRM action happens automatically.

## Runtime Smoke Execution

Read-only:

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_EMAIL=<staging-user> \
SMOKE_PASSWORD=<staging-password> \
SMOKE_VERBOSE=true \
corepack pnpm smoke:runtime
```

Optional mutation, only when safe:

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_ACCESS_TOKEN=<access-token> \
SMOKE_RUN_MUTATIONS=true \
SMOKE_VERBOSE=true \
corepack pnpm smoke:runtime
```

Optional mock AI:

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_ACCESS_TOKEN=<access-token> \
SMOKE_RUN_AI=true \
SMOKE_VERBOSE=true \
corepack pnpm smoke:runtime
```

Optional external sync, only with a staging Google test account:

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_ACCESS_TOKEN=<access-token> \
SMOKE_RUN_EXTERNAL_SYNC=true \
SMOKE_VERBOSE=true \
corepack pnpm smoke:runtime
```

## Backup and Restore Requirement

Before inviting beta users:

- Managed Postgres backup is enabled.
- PITR is enabled or a limitation is documented.
- Backup retention is documented.
- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` and version are backed up in the secret manager/password vault.
- A restore drill is scheduled. Prefer completing it before external users.

See [backup-restore-runbook.md](./backup-restore-runbook.md).

## Observability and Log Verification

Before beta:

- API provider logs are accessible.
- Web provider logs are accessible.
- API responses include `X-Request-Id`.
- Runtime smoke printed request IDs.
- At least one smoke request ID is found in API logs.
- Login success emits `auth.login.success`.
- Optional sync emits safe `external_sync.*` logs.
- Optional AI emits safe `ai.generation.*` logs.
- Logs do not contain passwords, authorization headers, OAuth codes, provider tokens, Gmail snippets, Calendar descriptions, AI output, or Gmail draft bodies.

See [observability-runbook.md](./observability-runbook.md).

## Auth Recovery / Forgot Password Status

Forgot password and reset password foundation is implemented.

Current guarantees:

- Password reset request responses are generic and do not reveal whether an account exists.
- Reset tokens are hashed in the database, one-time use, and expire after `AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES`.
- Successful reset revokes active refresh tokens for the user.
- Recovery endpoints have dedicated rate limits.
- `AUTH_RECOVERY_DEV_MODE=true` can return a reset URL only outside production for local/staging tests.
- Production startup rejects `AUTH_RECOVERY_DEV_MODE=true`.

Before public self-serve production:

- Configure Railway with `EMAIL_PROVIDER=resend`, `EMAIL_DELIVERY_ENABLED=true`, `EMAIL_FROM`, and `RESEND_API_KEY`.
- Verify the Resend sender/domain before real customers.
- Keep reset emails free of raw secrets in logs.
- Run a staging reset test with `AUTH_RECOVERY_DEV_MODE=false`.
- Confirm reset links use the intended `PASSWORD_RESET_PUBLIC_URL` or `FRONTEND_URL`.

## Rollback Plan

Application rollback:

- Keep the previous API build/image available.
- Keep the previous web build available.
- Roll back web and API independently only when schema-compatible.
- Do not roll back API behind incompatible Prisma migrations.

Database rollback:

- Prefer provider point-in-time restore into an isolated DB first.
- Use full restore only when data corruption/loss is broad.
- Use forward corrective migration/repair when the issue is narrow and safe.
- Keep `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` matching the restored DB snapshot.

Operational rollback:

- Disable beta invites while investigating.
- Pause Google onboarding if OAuth/sync fails.
- Keep `AI_PROVIDER=mock` if OpenAI setup is unstable.
- Communicate known impact to invited beta users.

## Go/No-Go Checklist

Must-have before inviting users:

- [ ] Local validation passes.
- [ ] Staging API deployed.
- [ ] Staging web deployed.
- [ ] Staging DB migrations applied with `corepack pnpm db:deploy`.
- [ ] `smoke:runtime` read-only passes.
- [ ] `X-Request-Id` is visible in responses and logs.
- [ ] Login works.
- [ ] Dashboard loads.
- [ ] CRM read works.
- [ ] At least one safe CRM write is tested manually.
- [ ] Google OAuth connect works with test user.
- [ ] Gmail sync works.
- [ ] Calendar sync works.
- [ ] `AI_PROVIDER=mock` suggestion works.
- [ ] AI suggestion detail review is understandable for beta users, with technical metadata collapsed by default.
- [ ] External email suggestions clearly show email context, AI recommendation, safety, and explicit CRM actions.
- [ ] CRM action wording uses opportunity language in the UI while preserving backend Lead model/API contracts.
- [ ] No email is sent automatically.
- [ ] No Gmail draft is created automatically.
- [ ] No CRM record is created automatically by AI analysis.
- [ ] Backup is configured.
- [ ] Restore drill is scheduled or completed.
- [ ] Known limitations are documented.
- [ ] Beta user list is controlled.

Should-have:

- [ ] Restore drill completed before external users.
- [ ] GitHub Actions billing unblocked and CI passing.
- [ ] OpenAI minimal smoke completed if `AI_PROVIDER=openai`.
- [ ] Resend invitation and password reset smoke completed if `EMAIL_DELIVERY_ENABLED=true`.
- [ ] External monitoring provider selected.
- [ ] Rate limit proxy/ingress option identified.

Can wait:

- Billing/plans.
- Background workers.
- Public Google OAuth verification if beta stays test-user only.
- Distributed rate limiting if running a single API instance.

## Known Limitations For First Beta

- Resend sender/domain verification must be completed before inviting real customers.
- GitHub Actions may be blocked by account billing; local CI-equivalent validation is required until fixed.
- Rate limiting is process-local.
- Background sync workers are not implemented.
- Gmail and Calendar sync are manual.
- External monitoring vendor is not wired.
- Restore drill may still need execution.
- Google OAuth may be limited to test users until verification/security assessment.
- AI provider should remain `mock` until OpenAI staging policy and cost controls are confirmed.

## Remaining Blockers After This Phase

- Execute first staging deploy.
- Run runtime smoke against staging.
- Run or complete restore drill.
- Resolve GitHub Actions billing and require CI.
- Confirm Google OAuth staging test users and redirect URI.
- Decide whether beta uses mock AI or minimal OpenAI.
- Select external monitoring provider.
- Plan 18J Auth Recovery and Account Safety.
