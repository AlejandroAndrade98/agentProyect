# Production Environment Checklist

Date: 2026-05-31

Use this checklist for staging and production environment setup. Do not store real values in this document or in source control. Put real secrets in the deployment provider's secret manager.

## Environment Variables

| Variable | Required | Used by | Purpose | Example placeholder | Production notes |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Yes | API, web, worker | Runtime mode. | `production` | Use `production` for deployed environments. |
| `API_PORT` | Yes | API, Docker compose | API listen port. | `4000` | Managed platforms may provide a required port; set this to that value if needed. |
| `REQUEST_BODY_LIMIT` | Recommended | API | Maximum JSON/urlencoded request body size accepted by the API. | `1mb` | Keep conservative; raise only for a documented upload/import endpoint. |
| `WEB_PORT` | Docker only | Docker compose, Next container | Web listen port. | `3000` | For hosted Next platforms this may be ignored. |
| `NEXT_PUBLIC_API_URL` | Yes | Web browser bundle | API base URL for frontend requests. | `https://api.example.com/api` | Must include `/api` with the current frontend client. |
| `FRONTEND_URL` | Recommended | Runbooks/OAuth setup | Canonical frontend URL. | `https://app.example.com` | Documentation helper; current runtime primarily uses `CORS_ORIGIN`. |
| `CORS_ORIGIN` | Yes | API, OAuth callback redirect | Allowed browser origins. | `https://app.example.com` | Comma-separated exact origins. The first origin is used for Google OAuth callback redirect. |
| `DATABASE_URL` | Yes | API, Prisma, worker | PostgreSQL connection URL. | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` | Use managed Postgres and provider-required SSL settings. |
| `DATABASE_URL_HOST` | No | Local Prisma helper script | Host-side DB URL for local scripts. | `postgresql://USER:PASSWORD@localhost:15432/DB?schema=public` | Usually not set in hosted production. |
| `POSTGRES_DB` | Docker only | Local/self-hosted Docker Postgres | Database name. | `sales_ai_db` | Managed Postgres does not need this. |
| `POSTGRES_USER` | Docker only | Local/self-hosted Docker Postgres | Database user. | `postgres` | Managed Postgres does not need this. |
| `POSTGRES_PASSWORD` | Docker only | Local/self-hosted Docker Postgres | Database password. | `replace_with_strong_password` | Never use demo values outside local dev. |
| `REDIS_URL` | Later / worker | Future worker queues | Redis connection URL. | `redis://redis:6379` | Required once background jobs/queues are enabled. |
| `REDIS_URL_HOST` | No | Local tooling | Host-side Redis URL. | `redis://localhost:16379` | Usually not production runtime. |
| `JWT_ACCESS_SECRET` | Yes | API auth | Signs access tokens. | `replace_with_strong_access_secret` | Generate high entropy; rotate with a planned user logout window. |
| `JWT_REFRESH_SECRET` | Currently optional | API config compatibility | Reserved refresh secret. | `replace_with_strong_refresh_secret` | Current refresh tokens are random DB tokens, but keep a strong value until config is cleaned up. |
| `JWT_ACCESS_EXPIRES_IN` | Yes | API auth | Access token lifetime. | `15m` | Keep short for production. |
| `JWT_REFRESH_EXPIRES_IN` | Yes | API auth | Refresh token lifetime. | `7d` | Required by refresh token creation. |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes for Google | Connected accounts | Google OAuth client ID. | `replace_with_google_client_id` | Must belong to the production OAuth client. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes for Google | Connected accounts | Google OAuth client secret. | `replace_with_google_client_secret` | Secret manager only. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Yes for Google | Connected accounts | Google callback URL. | `https://api.example.com/api/connected-accounts/oauth/google/callback` | Must exactly match Google Cloud authorized redirect URI. |
| `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` | Yes for Google | Connected accounts, sync, Gmail draft | Encrypts OAuth access/refresh tokens. | `replace_with_32_byte_base64_key` | Must decode to exactly 32 bytes. Losing it makes stored tokens undecryptable. |
| `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION` | Yes for Google | Connected accounts | Encryption key version marker. | `v1` | Increment only with a migration/rotation plan. Legacy `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_VERSION` is still supported. |
| `AI_PROVIDER` | Yes | AI suggestions | Selects AI provider. | `mock` or `openai` | Use `mock` for staging smoke tests without AI spend; use `openai` only with a real key. |
| `OPENAI_API_KEY` | If OpenAI | AI provider | OpenAI API credential. | `replace_with_openai_api_key` | Secret manager only. |
| `OPENAI_MODEL` | If OpenAI | AI provider | Model name. | `gpt-5.5` | Keep model policy explicit per environment. |
| `AI_MAX_INPUT_CHARS` | Recommended | AI provider | Prompt/context size guard. | `10000` | Keep conservative for beta. |
| `SYNC_GMAIL_ENABLED` | Later | Future worker config | Placeholder for background Gmail sync. | `false` | Current sync is manual; do not enable nonexistent jobs. |
| `SYNC_CALENDAR_ENABLED` | Later | Future worker config | Placeholder for background Calendar sync. | `false` | Current sync is manual; do not enable nonexistent jobs. |
| `SYNC_WORKER_CONCURRENCY` | Later | Future worker config | Placeholder worker concurrency. | `1` | Use after 18F worker implementation. |
| `LOG_LEVEL` | Recommended | Future logging config | Logging verbosity. | `info` | Current app does not fully wire structured logging yet. |
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
- Do not rotate the token encryption key until there is a token re-encryption/reconnect plan.

## URL Setup Notes

- `NEXT_PUBLIC_API_URL` must be the public browser-reachable API URL and must include `/api`.
- `CORS_ORIGIN` must include the deployed frontend URL exactly, with scheme.
- If multiple frontend origins are needed, put the primary production app first because the Google OAuth callback redirects to the first CORS origin.
- `GOOGLE_OAUTH_REDIRECT_URI` must exactly match the API callback URL registered in Google Cloud.

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
- `NEXT_PUBLIC_API_URL`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `MONITORING_ENVIRONMENT`
