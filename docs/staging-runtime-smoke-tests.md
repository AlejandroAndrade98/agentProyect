# Staging Runtime Smoke Tests

Date: 2026-05-31

This runbook defines safe runtime smoke tests for local and staging environments. It does not deploy the app, use real production secrets, send email, create Gmail drafts, create CRM records by default, run background jobs, or change OAuth/AI behavior.

For the full first-deploy sequence, start with [private-beta-deployment-plan.md](./private-beta-deployment-plan.md). Use this document when running the smoke steps from that plan.

## Purpose

Use the runtime smoke test after starting local services or after deploying to staging to confirm:

- API health and database connectivity work.
- Authentication works with a staging user or pre-issued access token.
- Authenticated read endpoints return expected shapes.
- API responses include `X-Request-Id` for log correlation.
- Optional CRM mutation, AI generation, and external sync checks remain explicit and safe.

The default command is read-only except for login token creation on the API side.

## Prerequisites

- API is running and reachable.
- Database migrations have already been applied in the target environment.
- A staging user exists if authenticated checks should use email/password.
- `NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`, `JWT_ACCESS_SECRET`, database env vars, and logging env vars are configured for the target app.
- Use `AI_PROVIDER=mock` for AI smoke unless the environment intentionally tests OpenAI.
- Use Google test users only for OAuth, Gmail, and Calendar smoke.

Recommended preflight:

```bash
corepack pnpm smoke:static
corepack pnpm check:generated
corepack pnpm db:validate
corepack pnpm --filter @sales-ai/api build
corepack pnpm --filter @sales-ai/web exec tsc --noEmit
```

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SMOKE_API_URL` | Yes | none | API base URL including `/api`, for example `http://localhost:4000/api`. |
| `SMOKE_EMAIL` | No | none | Staging login email. Used only when `SMOKE_ACCESS_TOKEN` is not set. |
| `SMOKE_PASSWORD` | No | none | Staging login password. Used only when `SMOKE_ACCESS_TOKEN` is not set. |
| `SMOKE_ACCESS_TOKEN` | No | none | Optional bearer token alternative to email/password login. |
| `SMOKE_RUN_MUTATIONS` | No | `false` | Enables temporary CRM company create/delete smoke. |
| `SMOKE_RUN_AI` | No | `false` | Enables a safe AI next-steps generation smoke against an existing lead. |
| `SMOKE_RUN_EXTERNAL_SYNC` | No | `false` | Enables manual Gmail/Calendar sync smoke when a connected account exists. |
| `SMOKE_VERBOSE` | No | `false` | Prints per-request method/path/status/requestId. |

Do not store real production credentials in shell history, docs, source control, or CI logs. Prefer secret manager injection for staging automation.

## Local Instructions

Start local dependencies and app services using the normal local flow. Then run read-only smoke:

PowerShell:

```powershell
$env:SMOKE_API_URL="http://localhost:4000/api"
$env:SMOKE_EMAIL="<staging-or-local-user>"
$env:SMOKE_PASSWORD="<password>"
corepack pnpm smoke:runtime
```

Bash:

```bash
SMOKE_API_URL=http://localhost:4000/api \
SMOKE_EMAIL=<staging-or-local-user> \
SMOKE_PASSWORD=<password> \
corepack pnpm smoke:runtime
```

Token alternative:

```bash
SMOKE_API_URL=http://localhost:4000/api \
SMOKE_ACCESS_TOKEN=<access-token> \
corepack pnpm smoke:runtime
```

## Staging Instructions

Confirm provider URLs and smoke env values using [staging-provider-checklist.md](./staging-provider-checklist.md) and [staging-env-template.md](./staging-env-template.md).

Run after staging deploy and migration:

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_EMAIL=<staging-user> \
SMOKE_PASSWORD=<staging-password> \
SMOKE_VERBOSE=true \
corepack pnpm smoke:runtime
```

Expected default checks:

- `GET /health`
- `POST /auth/login` when email/password is provided
- `GET /users/me`
- `GET /dashboard/summary`
- `GET /companies?page=1&pageSize=1`
- `GET /contacts?page=1&pageSize=1`
- `GET /leads?page=1&pageSize=1`
- `GET /tasks?page=1&pageSize=1`
- `GET /notes?page=1&pageSize=1`
- `GET /products?page=1&pageSize=1`
- `GET /ai-suggestions?page=1&pageSize=1`

The script checks status codes, light JSON shape, and `X-Request-Id`.

## Optional CRM Mutation Smoke

This is disabled by default.

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_ACCESS_TOKEN=<access-token> \
SMOKE_RUN_MUTATIONS=true \
corepack pnpm smoke:runtime
```

Behavior:

- Creates one temporary company named `SMOKE_TEST_DO_NOT_USE_<timestamp>`.
- Deletes it immediately.
- Prints a warning with the company ID if cleanup fails.

Do not enable this against production unless an approved operator has confirmed the environment and cleanup plan.

## Optional AI Mock Smoke

This is disabled by default.

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_ACCESS_TOKEN=<access-token> \
SMOKE_RUN_AI=true \
corepack pnpm smoke:runtime
```

Behavior:

- Finds one existing lead.
- Calls `POST /ai-suggestions/leads/:leadId/next-steps`.
- Does not accept, reject, apply, create CRM records, create Gmail drafts, or send email.
- Checks that the response includes a suggestion ID and preserves safety metadata when present.
- Skips clearly if no lead exists.

Prefer `AI_PROVIDER=mock` for this check. If OpenAI is intentionally tested, keep the run minimal.

## Optional External Sync Smoke

This is disabled by default.

```bash
SMOKE_API_URL=https://<api-domain>/api \
SMOKE_ACCESS_TOKEN=<access-token> \
SMOKE_RUN_EXTERNAL_SYNC=true \
corepack pnpm smoke:runtime
```

Behavior:

- Reads connected accounts.
- Runs manual Gmail sync only when a connected `EMAIL` account exists.
- Runs manual Calendar sync only when a connected `CALENDAR` account exists.
- Logs safe counts/status only.
- Does not run AI analysis, create CRM records, create Gmail drafts, or send email.

Do not print or paste Gmail subjects, snippets, Calendar descriptions, tokens, or OAuth codes while troubleshooting.

## Manual Google OAuth Checklist

Use a staging Google OAuth client and test user.

1. Confirm Google Cloud redirect URI exactly matches `https://<api-domain>/api/connected-accounts/oauth/google/callback`.
2. Confirm `GOOGLE_OAUTH_REDIRECT_URI`, `FRONTEND_URL`, and `CORS_ORIGIN`.
3. Open Settings, Connected Accounts.
4. Connect Google.
5. Confirm callback returns to `/dashboard/settings/connected-accounts?connected=google`.
6. Confirm account status is connected.
7. Run manual Gmail sync from the UI.
8. Run manual Calendar sync from the UI.
9. Request disconnect or disconnect using the intended role.
10. Reconnect and confirm sync still works.
11. Confirm no email is sent automatically.
12. Confirm no CRM record is created automatically.

## Rate Limit Guidance

The runtime smoke script is not a load test.

- Keep normal smoke runs low volume.
- Test auth brute-force protection separately with approved staging accounts only.
- For 429 validation, use a narrow staging scenario and confirm `rate_limit.exceeded` logs appear.
- Do not run aggressive rate tests against production or shared staging without coordination.

## Observability Verification

For each runtime smoke run:

1. Run with `SMOKE_VERBOSE=true` to print response request IDs.
2. Copy one `X-Request-Id`.
3. Search API logs for that exact value.
4. Confirm `http.request.completed` exists for non-health requests.
5. Confirm login emits `auth.login.success` when credentials are used.
6. Confirm optional AI emits `ai.generation.started` and `ai.generation.completed`.
7. Confirm optional sync emits `external_sync.gmail.*` or `external_sync.calendar.*`.
8. Confirm logs do not contain passwords, authorization headers, OAuth codes, Google tokens, email bodies, Gmail snippets, Calendar descriptions, AI output text, or Gmail draft bodies.

## Expected Results

A passing read-only smoke run prints:

- Health passed.
- Login or access-token auth passed.
- Current user passed.
- Dashboard summary passed.
- CRM read endpoints passed.
- AI suggestions read passed.
- Optional checks skipped unless explicitly enabled.
- Zero failures.

Warnings indicate a possible shape change or cleanup issue that needs review. Failures should block promotion until understood.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `SMOKE_API_URL is required` | Set the API base URL and include `/api`. |
| Health fails | Check API process, database connectivity, migrations, and `DATABASE_URL`. |
| Login fails | Confirm staging user credentials, active user state, active organization state, and auth rate limits. |
| `X-Request-Id` missing | Confirm request ID middleware is registered and no proxy strips the header. |
| Authenticated read fails | Confirm bearer token, CORS/proxy routing, RBAC, and tenant state. |
| Optional mutation cleanup fails | Delete the printed `SMOKE_TEST_DO_NOT_USE_*` company manually after checking logs. |
| Optional AI fails | Confirm `AI_PROVIDER`, credits/limits, existing lead data, provider credentials if OpenAI is enabled. |
| Optional sync fails | Confirm connected account status, encrypted token configuration, Google scopes, and reconnect if refresh failed. |
| 429 responses | Confirm whether this is expected rate limiting; wait for the window or use a fresh staging user. |

## Rollback Notes If Smoke Fails

- Do not promote the build to production.
- Keep the previous known-good web/API build available.
- If only web smoke fails, roll back the web build if API/schema are compatible.
- If API smoke fails after a schema change, do not roll back API behind an incompatible migration without a compatibility plan.
- If database migration caused the failure, use the migration rollback/restore plan from `docs/deployment-checklist.md`.
- If OAuth or sync fails, disable Google onboarding for the release until the issue is understood.
- If AI generation fails, keep `AI_PROVIDER=mock` or disable AI generation in staging until provider config/usage limits are fixed.
