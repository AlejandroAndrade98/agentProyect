# Staging Environment Variable Template

Date: 2026-05-31

This template lists staging environment variables by service. Use placeholders only in docs. Store real values in the provider secret manager.

## API Environment

| Variable | Required? | Service | Example placeholder | Secret? | Notes |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Yes | API | `production` | No | Use production mode for deployed staging runtime behavior. |
| `PORT` | Provider-managed | API | `10000` | No | Many managed providers inject this automatically. The API reads `PORT` before `API_PORT`. |
| `API_PORT` | Local/manual | API | `4000` | No | Keep for local Docker/dev or providers that require manual port configuration. |
| `REQUEST_BODY_LIMIT` | Recommended | API | `1mb` | No | Keep conservative unless a documented endpoint needs more. |
| `DATABASE_URL` | Yes | API, Prisma | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` | Yes | Managed Postgres URL. Do not paste real value in docs. |
| `DATABASE_URL_HOST` | Local only | Local Prisma helper | `postgresql://USER:PASSWORD@localhost:15432/DB?schema=public` | Yes | Do not set in hosted staging providers; use `DATABASE_URL` only. |
| `REDIS_URL` | Optional/deferred | API/future worker | `redis://HOST:6379` | Yes | Not required for first beta unless provider/future rate-limit store uses it. |
| `CORS_ORIGIN` | Yes | API | `https://app-staging.example.com` | No | Exact web origin. Comma-separated only if needed. |
| `FRONTEND_URL` | Yes | API OAuth callback | `https://app-staging.example.com` | No | Google OAuth success redirect target. |
| `JWT_ACCESS_SECRET` | Yes | API auth | `replace_with_strong_access_secret` | Yes | Generate unique staging value. |
| `JWT_REFRESH_SECRET` | Yes/current compatibility | API auth config | `replace_with_strong_refresh_secret` | Yes | Keep strong even though refresh tokens are DB random tokens today. |
| `JWT_ACCESS_EXPIRES_IN` | Yes | API auth | `15m` | No | Short access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | Yes | API auth | `7d` | No | Current refresh token creation uses this. |
| `AUTH_RECOVERY_DEV_MODE` | Yes | API auth recovery | `false` | No | Use `true` only for controlled non-production reset-link testing. Production validation rejects it. |
| `AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES` | Recommended | API auth recovery | `30` | No | Short reset token lifetime. |
| `PASSWORD_RESET_PUBLIC_URL` | Recommended | API auth recovery | `https://app-staging.example.com` | No | Frontend base URL for reset links. Defaults to `FRONTEND_URL` when unset. |
| `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` | Yes for Google | API connected accounts | `replace_with_32_byte_base64_key` | Yes | Must decode to exactly 32 bytes. Back it up in secret manager/password vault. |
| `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION` | Yes for Google | API connected accounts | `v1` | No | Store with the key material; increment only with rotation plan. |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes for Google | API connected accounts | `replace_with_google_oauth_client_id` | No | Staging Google OAuth client ID. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes for Google | API connected accounts | `replace_with_google_oauth_client_secret` | Yes | Secret manager only. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Yes for Google | API connected accounts | `https://api-staging.example.com/api/connected-accounts/oauth/google/callback` | No | Must exactly match Google Cloud authorized redirect URI. |
| `AI_PROVIDER` | Yes | API AI | `mock` | No | Use `mock` for first staging deploy. |
| `OPENAI_API_KEY` | If OpenAI | API AI | `replace_with_openai_api_key` | Yes | Leave unset or placeholder if `AI_PROVIDER=mock`. |
| `OPENAI_MODEL` | If OpenAI | API AI | `gpt-5.5` | No | Required only when testing OpenAI intentionally. |
| `AI_MAX_INPUT_CHARS` | Recommended | API AI | `10000` | No | Prompt/context guard. |
| `LOG_LEVEL` | Recommended | API logging | `info` | No | Use `debug` only during controlled troubleshooting. |
| `LOG_FORMAT` | Recommended | API logging | `json` | No | Recommended for provider log ingestion. |
| `REQUEST_LOGGING_ENABLED` | Recommended | API logging | `true` | No | Keep enabled for request ID tracing. |
| `LOG_REDACT_SENSITIVE` | Recommended | API logging | `true` | No | Keep enabled. |

## Web Environment

| Variable | Required? | Service | Example placeholder | Secret? | Notes |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Recommended | Web | `production` | No | Usually set by provider. |
| `NEXT_PUBLIC_API_URL` | Yes | Web | `https://api-staging.example.com/api` | No | Public browser API URL. Must include `/api`. Rebuild web when changed. |

## Optional Smoke Environment

Smoke env vars are used by operators locally or in the provider shell. Do not store real passwords in docs.

| Variable | Required? | Service | Example placeholder | Secret? | Notes |
| --- | --- | --- | --- | --- | --- |
| `SMOKE_API_URL` | Yes for runtime smoke | Operator shell | `https://api-staging.example.com/api` | No | API base URL including `/api`. |
| `SMOKE_EMAIL` | Optional | Operator shell | `<staging-user@example.com>` | Yes | Used when `SMOKE_ACCESS_TOKEN` is not set. |
| `SMOKE_PASSWORD` | Optional | Operator shell | `<staging-password>` | Yes | Used with `SMOKE_EMAIL`. |
| `SMOKE_ACCESS_TOKEN` | Optional | Operator shell | `<access-token>` | Yes | Alternative to email/password. |
| `SMOKE_RUN_MUTATIONS` | Optional | Operator shell | `false` | No | Enables temporary company create/delete only when `true`. |
| `SMOKE_RUN_AI` | Optional | Operator shell | `false` | No | Enables AI suggestion generation only when `true`. Prefer mock. |
| `SMOKE_RUN_EXTERNAL_SYNC` | Optional | Operator shell | `false` | No | Enables manual Gmail/Calendar sync only when `true`. |
| `SMOKE_VERBOSE` | Optional | Operator shell | `true` | No | Prints request IDs for log verification. |

## Secret Generation Notes

Generate a connected account encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Rules:

- Generate staging and production secrets separately.
- Never reuse local/demo secrets.
- Never commit `.env` files with real values.
- Never paste real `DATABASE_URL`, JWT secrets, Google client secrets, OpenAI keys, or smoke credentials into docs.
- Keep `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` outside database backups but backed up in the approved secret manager/password vault.

## Placeholder Staging Values

```text
API_BASE_URL=https://api-staging.example.com/api
WEB_URL=https://app-staging.example.com
NEXT_PUBLIC_API_URL=https://api-staging.example.com/api
CORS_ORIGIN=https://app-staging.example.com
FRONTEND_URL=https://app-staging.example.com
AUTH_RECOVERY_DEV_MODE=false
AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES=30
PASSWORD_RESET_PUBLIC_URL=https://app-staging.example.com
GOOGLE_OAUTH_REDIRECT_URI=https://api-staging.example.com/api/connected-accounts/oauth/google/callback
AI_PROVIDER=mock
LOG_LEVEL=info
LOG_FORMAT=json
REQUEST_LOGGING_ENABLED=true
LOG_REDACT_SENSITIVE=true
REQUEST_BODY_LIMIT=1mb
```
