# Security Hardening Notes

Date: 2026-05-31

This document summarizes the current API security hardening baseline. It does not deploy the app and does not change OAuth behavior, AI behavior, email sending, Gmail draft creation rules, CRM automation, or existing API payload contracts.

## Implemented Controls

### Rate limiting

The API now has a small in-memory Nest guard for sensitive endpoints. It returns HTTP `429` with standard rate limit headers when a bucket is exceeded.

Current buckets:

| Area | Endpoint group | Limit |
| --- | --- | --- |
| Auth login | `POST /api/auth/login` | 10 requests per 15 minutes per IP + email |
| Auth forgot password | `POST /api/auth/forgot-password` | 5 requests per 15 minutes per IP + email |
| Auth reset password | `POST /api/auth/reset-password` | 10 requests per 15 minutes per IP + token |
| Auth refresh | `POST /api/auth/refresh` | 30 requests per 15 minutes per IP |
| Google OAuth start | `GET /api/connected-accounts/oauth/google/start` | 20 requests per 15 minutes per user/IP |
| Google OAuth callback | `GET /api/connected-accounts/oauth/google/callback` | 60 requests per 15 minutes per IP |
| Dev connected account | `POST /api/connected-accounts/dev-connect` | 10 requests per 15 minutes per user/IP |
| Gmail manual sync | `POST /api/external-sync/email-messages/sync` | 10 requests per hour per user/IP |
| Calendar manual sync | `POST /api/external-sync/calendar-events/sync` | 10 requests per hour per user/IP |
| AI generation | lead next steps, email analysis, reply draft, calendar analysis | 20 requests per hour per user/IP |
| Gmail draft creation | `POST /api/ai-suggestions/:id/create-gmail-draft` | 10 requests per hour per user/IP |

Production limitation: this guard is process-local. For multi-instance deployments, keep these app-level guards but add a shared limiter at the ingress/proxy layer or replace the store with Redis.

### Auth brute-force protection

Login attempts are throttled by IP + normalized email. This slows repeated password guessing against one account without storing plaintext credentials or logging attempted passwords.

### Account recovery

Password reset requests use a generic response so the endpoint does not reveal whether an email exists. Reset tokens are generated with cryptographic randomness, stored only as SHA-256 hashes, expire after `AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES` minutes, and are one-time use.

Successful password reset updates the password hash, consumes outstanding reset tokens for that user, and revokes active refresh tokens so existing sessions must authenticate again. Request/consume IP and user-agent values are stored only as safe hashes.

`AUTH_RECOVERY_DEV_MODE=true` may return a reset URL for local/staging testing only. Production startup rejects this mode, and production self-serve recovery still requires a transactional delivery provider before public launch.

### Security headers

The API sets conservative security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `X-DNS-Prefetch-Control: off`
- `Cross-Origin-Resource-Policy: same-site`
- `Permissions-Policy` disabling camera, microphone, geolocation, and payment
- API-focused `Content-Security-Policy`
- `Strict-Transport-Security` only when `NODE_ENV=production`

These headers are intentionally implemented without adding a dependency.

### Request size limits

The API now disables the default body parser and configures JSON/urlencoded parsing with `REQUEST_BODY_LIMIT`, defaulting to `1mb`.

Keep this limit conservative. Increase it only if a future import/upload endpoint explicitly needs larger payloads.

### Request IDs

The API accepts a safe `X-Request-Id` or generates one. It returns the value in `X-Request-Id` so API errors can be correlated with logs without exposing secrets.

### Structured request logging

The API emits structured request completion logs when `REQUEST_LOGGING_ENABLED=true`. Logs include request ID, method, path without query string, status code, duration, and authenticated user/organization IDs when available. Successful `/api/health` requests are skipped to avoid noise.

### Exception behavior and redaction

The global exception filter keeps known HTTP exception responses intact, returns generic `Internal server error` for unknown failures, and logs server-side 5xx details with sensitive fields redacted.

Redaction covers common secret-bearing keys and string patterns such as:

- Authorization bearer tokens
- JWT-looking strings
- access/refresh/id tokens
- OAuth codes
- passwords, secrets, API keys, and client secrets

Do not log request bodies in production unless a future structured logger applies the same redaction policy.

See [observability-runbook.md](./observability-runbook.md) for log events, alert recommendations, and troubleshooting flows.

## Still Needed Before Public Production

- Shared/distributed rate limiting for multi-instance deployments.
- Monitoring/alerting for 401/403/429/500 spikes.
- Tenant-isolation and RBAC automated tests.
- Session storage decision for public production; frontend currently stores tokens in `localStorage`.
- Google OAuth production verification and reconnect/disconnect QA.
- Backup restore drill.
- Transactional password reset email delivery for public self-serve production.
