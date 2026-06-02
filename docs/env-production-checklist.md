# Production Environment Checklist

Date: 2026-05-31

Use this checklist for staging and production environment setup. Do not store real values in this document or in source control. Put real secrets in the deployment provider's secret manager.

For the first staging/private beta deploy, use [private-beta-deployment-plan.md](./private-beta-deployment-plan.md), [staging-provider-checklist.md](./staging-provider-checklist.md), and [staging-env-template.md](./staging-env-template.md).

## Environment Variables

| Variable | Required | Used by | Purpose | Example placeholder | Production notes |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Yes | API, web, worker | Runtime mode. | `production` | Use `production` for deployed environments. |
| `PORT` | Provider-managed | API | Provider injected listen port. | `10000` | Many managed platforms inject this automatically. The API reads `PORT` before `API_PORT`. |
| `API_PORT` | Local/manual | API, Docker compose | API listen port fallback. | `4000` | Keep for local Docker/dev or providers that require manual port configuration. |
| `REQUEST_BODY_LIMIT` | Recommended | API | Maximum JSON/urlencoded request body size accepted by the API. | `1mb` | Keep conservative; raise only for a documented upload/import endpoint. |
| `WEB_PORT` | Docker only | Docker compose, Next container | Web listen port. | `3000` | For hosted Next platforms this may be ignored. |
| `NEXT_PUBLIC_API_URL` | Yes | Web browser bundle | API base URL for frontend requests. | `https://api.example.com/api` | Must include `/api` with the current frontend client. |
| `FRONTEND_URL` | Yes for Google | OAuth callback redirect | Canonical frontend URL. | `https://app.example.com` | Used as the preferred frontend success redirect after Google OAuth. Falls back to the first `CORS_ORIGIN` only when unset. |
| `CORS_ORIGIN` | Yes | API, OAuth callback redirect | Allowed browser origins. | `https://app.example.com` | Comma-separated exact origins. The first origin is used for Google OAuth callback redirect. |
| `DATABASE_URL` | Yes | API, Prisma, worker | PostgreSQL connection URL. | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` | Use managed Postgres and provider-required SSL settings. |
| `DATABASE_URL_HOST` | Local only | Local Prisma helper script | Host-side DB URL for local scripts. | `postgresql://USER:PASSWORD@localhost:15432/DB?schema=public` | Do not set in hosted staging/production providers; use `DATABASE_URL` only. |
| `POSTGRES_DB` | Docker only | Local/self-hosted Docker Postgres | Database name. | `sales_ai_db` | Managed Postgres does not need this. |
| `POSTGRES_USER` | Docker only | Local/self-hosted Docker Postgres | Database user. | `postgres` | Managed Postgres does not need this. |
| `POSTGRES_PASSWORD` | Docker only | Local/self-hosted Docker Postgres | Database password. | `replace_with_strong_password` | Never use demo values outside local dev. |
| `REDIS_URL` | Later / worker | Future worker queues | Redis connection URL. | `redis://redis:6379` | Required once background jobs/queues are enabled. |
| `REDIS_URL_HOST` | No | Local tooling | Host-side Redis URL. | `redis://localhost:16379` | Usually not production runtime. |
| `JWT_ACCESS_SECRET` | Yes | API auth | Signs access tokens. | `replace_with_strong_access_secret` | Generate high entropy; rotate with a planned user logout window. |
| `JWT_REFRESH_SECRET` | Currently optional | API config compatibility | Reserved refresh secret. | `replace_with_strong_refresh_secret` | Current refresh tokens are random DB tokens, but keep a strong value until config is cleaned up. |
| `JWT_ACCESS_EXPIRES_IN` | Yes | API auth | Access token lifetime. | `15m` | Keep short for production. |
| `JWT_REFRESH_EXPIRES_IN` | Yes | API auth | Refresh token lifetime. | `7d` | Required by refresh token creation. |
| `BOOTSTRAP_ADMIN_ENABLED` | One-off only | Bootstrap script | Enables first admin creation. | `false` | Set to `true` only for the one-off staging bootstrap run, then disable/remove. |
| `BOOTSTRAP_ADMIN_EMAIL` | One-off only | Bootstrap script | First owner/admin email. | empty | Temporary provider env only. Do not use demo addresses. |
| `BOOTSTRAP_ADMIN_PASSWORD` | One-off only | Bootstrap script | First owner/admin password. | empty | Secret. Remove from provider variables immediately after the one-off run. |
| `BOOTSTRAP_ADMIN_NAME` | One-off only | Bootstrap script | First owner/admin display name. | empty | Temporary provider env only. |
| `BOOTSTRAP_ORGANIZATION_NAME` | One-off only | Bootstrap script | First organization name. | empty | Temporary provider env only. |
| `BOOTSTRAP_ADMIN_ROLE` | One-off only | Bootstrap script | First user role. | `OWNER` | Defaults to `OWNER`; only manager roles are accepted. |
| `BOOTSTRAP_ALLOW_EXISTING_USERS` | One-off only | Bootstrap script | Allows bootstrap when users already exist. | `false` | Keep false unless intentionally recovering a controlled staging setup. |
| `BOOTSTRAP_UPDATE_EXISTING_PASSWORD` | One-off only | Bootstrap script | Updates existing bootstrap user's password. | `false` | Explicit recovery-only flag. Never leave enabled. |
| `AUTH_RECOVERY_DEV_MODE` | Yes | API auth recovery | Enables dev-only reset URL responses. | `false` | Must be `false` in production; startup validation rejects `true`. |
| `AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES` | Recommended | API auth recovery | Password reset token lifetime. | `30` | Keep short. Tokens are one-time use and stored only as hashes. |
| `PASSWORD_RESET_PUBLIC_URL` | Recommended | API auth recovery | Frontend base URL used to build reset links. | `https://app.example.com` | Optional when `FRONTEND_URL` is correct; set explicitly if reset links need a different public base. |
| `EMAIL_PROVIDER` | Yes | API transactional email | Transactional email provider. | `none` or `resend` | Use `resend` for staging/private beta delivery. Use `none` for local/dev. |
| `EMAIL_DELIVERY_ENABLED` | Yes | API transactional email | Enables sending invitation and password reset emails. | `true` or `false` | Production startup rejects `true` with provider `none` or missing provider config. |
| `EMAIL_FROM` | If Resend | API transactional email | Verified sender address. | `Sales AI Platform <no-reply@example.com>` | Required when `EMAIL_PROVIDER=resend`. Verify the sender domain before real customers. |
| `EMAIL_REPLY_TO` | Optional | API transactional email | Reply-to address. | `support@example.com` | Optional; do not use personal inboxes for production support. |
| `EMAIL_APP_NAME` | Recommended | API transactional email | Product name in transactional emails. | `Sales AI Platform` | Used in invitation and reset subjects/bodies. |
| `EMAIL_PUBLIC_APP_URL` | Recommended | API transactional email | Frontend base URL for invitation/reset links. | `https://app.example.com` | Optional when `FRONTEND_URL` is correct. Used for organization invitation links. |
| `RESEND_API_KEY` | If Resend | API transactional email | Resend API key. | `replace_with_resend_api_key` | Secret manager only. Never print or commit. |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes for Google | Connected accounts | Google OAuth client ID. | `replace_with_google_client_id` | Must belong to the production OAuth web client. Alias `GOOGLE_CLIENT_ID` is supported, but prefer this canonical name. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes for Google | Connected accounts | Google OAuth client secret. | `replace_with_google_client_secret` | Secret manager only. Alias `GOOGLE_CLIENT_SECRET` is supported. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Yes for Google | Connected accounts | Google callback URL. | `https://api.example.com/api/connected-accounts/oauth/google/callback` | Must exactly match Google Cloud authorized redirect URI. Alias `GOOGLE_REDIRECT_URI` is supported. |
| `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` | Yes for Google | Connected accounts, sync, Gmail draft | Encrypts OAuth access/refresh tokens. | `replace_with_32_byte_base64_key` | Must decode to exactly 32 bytes. Losing it makes stored tokens undecryptable. |
| `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION` | Yes for Google | Connected accounts | Encryption key version marker. | `v1` | Increment only with a migration/rotation plan. Legacy `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_VERSION` is still supported. |
| `AI_PROVIDER` | Yes | AI suggestions | Selects AI provider. | `mock` or `openai` | Use `mock` for staging smoke tests without AI spend; use `openai` only with a real key. |
| `OPENAI_API_KEY` | If OpenAI | AI provider | OpenAI API credential. | `replace_with_openai_api_key` | Secret manager only. |
| `OPENAI_MODEL` | If OpenAI | AI provider | Model name. | `gpt-5.5` | Keep model policy explicit per environment. |
| `AI_MAX_INPUT_CHARS` | Recommended | AI provider | Prompt/context size guard. | `10000` | Keep conservative for beta. |
| `SYNC_GMAIL_ENABLED` | Later | Future worker config | Placeholder for background Gmail sync. | `false` | Current sync is manual; do not enable nonexistent jobs. |
| `SYNC_CALENDAR_ENABLED` | Later | Future worker config | Placeholder for background Calendar sync. | `false` | Current sync is manual; do not enable nonexistent jobs. |
| `SYNC_WORKER_CONCURRENCY` | Later | Future worker config | Placeholder worker concurrency. | `1` | Use after 18F worker implementation. |
| `LOG_LEVEL` | Recommended | API logging | Minimum emitted log level. | `info` | Use `info` for normal production; temporarily use `debug` only during controlled troubleshooting. |
| `REQUEST_LOGGING_ENABLED` | Recommended | API logging | Enables structured request completion logs. | `true` | Keep enabled in production unless the platform provides an equivalent request log with request IDs. |
| `LOG_FORMAT` | Recommended | API logging | Structured log output format. | `json` | Use `json` for production log ingestion; `pretty` is local-debug only. |
| `LOG_REDACT_SENSITIVE` | Recommended | API logging | Redacts sensitive keys and token-like strings. | `true` | Keep enabled in production. Do not disable unless using a stronger external redaction layer. |
| `SENTRY_DSN` | Optional | Future monitoring | Error monitoring DSN. | empty | Do not set until monitoring integration exists. |
| `MONITORING_ENVIRONMENT` | Optional | Future monitoring | Monitoring environment tag. | `production` | Useful after monitoring integration. |
| `EXPORTS_DIR` | If exports enabled | API/worker future storage | Export file path. | `/data/exports` | Prefer durable object storage over container disk. |
| `BACKUPS_DIR` | Self-hosted only | Backup scripts/runbooks | Local backup path. | `/data/backups` | Managed Postgres backups are preferred. |
| `RETENTION_AI_PENDING_DAYS` | Recommended | Future retention jobs | Pending AI retention window. | `30` | Verify cleanup job before relying on it. |
| `RETENTION_AI_REJECTED_DAYS` | Recommended | Future retention jobs | Rejected AI retention window. | `30` | Verify cleanup job before relying on it. |
| `RETENTION_PROMPT_TEXT_DAYS` | Recommended | Future retention jobs | Prompt text retention window. | `30` | Privacy-sensitive. |
| `RETENTION_TECHNICAL_LOGS_DAYS` | Recommended | Future retention jobs | Technical log retention window. | `30` | Requires cleanup job. |
| `RETENTION_AUDIT_LOGS_DAYS` | Recommended | Future retention jobs | Audit log retention window. | `365` | Confirm compliance needs before production. |
| `RETENTION_EXPORT_FILES_DAYS` | Recommended | Future retention jobs | Export file retention window. | `7` | Requires cleanup job/storage lifecycle. |

## Secret Generation Notes

Generate a 32-byte base64 connected account token encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Generate strong JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Production notes:

- Generate separate secrets for staging and production.
- Never reuse local/demo `.env` values in production.
- Store secrets in the provider secret manager, not in `.env` files committed to git.
- Record the `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION` with the key in the secret manager.
- Back up `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` and its version in the approved secret manager or password vault. A database backup cannot decrypt connected account tokens without the matching key.
- Do not rotate the token encryption key until there is a token re-encryption/reconnect plan.
- Never commit Google OAuth client secrets or downloaded OAuth client JSON files.

## URL Setup Notes

- `NEXT_PUBLIC_API_URL` must be the public browser-reachable API URL and must include `/api`.
- `CORS_ORIGIN` must include the deployed frontend URL exactly, with scheme.
- `FRONTEND_URL` should be set to the canonical frontend origin because the Google OAuth callback redirects there after success.
- If `FRONTEND_URL` is not set, the callback falls back to the first `CORS_ORIGIN`.
- `PASSWORD_RESET_PUBLIC_URL` should point to the same frontend origin unless reset links are served through a different public URL.
- `EMAIL_PUBLIC_APP_URL` should point to the same frontend origin unless invitation/reset links need a different public base.
- `GOOGLE_OAUTH_REDIRECT_URI` must exactly match the API callback URL registered in Google Cloud.
- Production startup validates Google OAuth env, frontend URL, optional password reset/email public URLs, transactional email provider config, exact CORS origins, disabled auth recovery dev mode, and the 32-byte connected account encryption key when `NODE_ENV=production`.

## Staging vs Production

Variables that must differ between staging and production:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY`
- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_API_URL`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `MONITORING_ENVIRONMENT`

Staging-specific fill-in guidance lives in [staging-env-template.md](./staging-env-template.md). Keep staging secrets separate from production secrets.

## Backup and Restore Notes

- Follow [backup-restore-runbook.md](./backup-restore-runbook.md) before private beta.
- `DATABASE_URL` values are secrets. Do not paste real values into docs, tickets, or shared logs.
- Hosted staging/production should use `DATABASE_URL` only. `DATABASE_URL_HOST` is for local host-side Prisma scripts and overrides `DATABASE_URL` in `scripts/prisma-host.mjs`.
- Bootstrap variables are temporary. Remove `BOOTSTRAP_ADMIN_PASSWORD` and disable/remove `BOOTSTRAP_ADMIN_ENABLED` after the first staging owner/admin is created.
- Backup artifacts may contain personal/customer data, password hashes, AI output, Gmail metadata, Calendar metadata, and encrypted OAuth tokens.
- Store backup artifacts in encrypted, access-restricted storage.
- Never commit backup files or restore dumps.
- Never restore production backups into local development without sanitization.
- Keep the connected account token encryption key outside database backups and source control.
