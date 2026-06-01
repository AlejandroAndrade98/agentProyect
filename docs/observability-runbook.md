# Observability Runbook

Date: 2026-05-31

This runbook describes the current logging and monitoring foundation. It does not configure an external vendor, deploy the app, print secrets, change auth/OAuth/AI/email behavior, create background jobs, or add automatic CRM actions.

## Current Logging Foundation

The API emits structured logs through `SafeLoggerService`.

Default env:

```text
LOG_LEVEL=info
REQUEST_LOGGING_ENABLED=true
LOG_FORMAT=json
LOG_REDACT_SENSITIVE=true
```

Supported log levels:

- `debug`
- `info`
- `warn`
- `error`

Supported formats:

- `json`, recommended for production
- `pretty`, useful for local debugging

## Log Shape

JSON logs include:

- `timestamp`
- `level`
- `message`
- `event`
- `requestId` when available
- `method`
- `path`
- `statusCode`
- `durationMs`
- `userId` when authentication has populated it
- `organizationId` when authentication has populated it
- safe event metadata such as provider, model, feature, counts, and status

The request logger does not log request bodies. It logs path without query string values. Successful `/api/health` requests are skipped to reduce noise.

## Request IDs

The API accepts a safe incoming `X-Request-Id` or generates one. The same value is returned as `X-Request-Id`.

Use it to trace a request:

1. Copy `X-Request-Id` from browser/devtools/API client.
2. Search production logs for that exact value.
3. Review `http.request.completed` and any related domain event logs.

## Redaction Rules

When `LOG_REDACT_SENSITIVE=true`, logs redact:

- authorization headers
- cookies
- access tokens
- refresh tokens
- ID tokens
- OAuth codes
- passwords
- secrets
- API keys
- Google client secrets
- connected account encrypted token payloads
- JWT-looking strings

The app should not log:

- raw passwords
- password hashes
- Google/OAuth tokens
- OpenAI API keys
- full email bodies
- Gmail snippets or subjects by default
- Calendar descriptions by default
- AI output text
- Gmail draft body

## Logged Events

HTTP:

- `http.request.completed`
- `http.exception.unhandled`

Rate limiting:

- `rate_limit.exceeded`

Auth:

- `auth.login.success`
- `auth.login.failed`
- `auth.refresh.success`
- `auth.refresh.failed`
- `auth.logout`

Google OAuth / connected accounts:

- `oauth.google.start`
- `oauth.google.callback.success`
- `oauth.google.callback.failed`
- `google.token_refresh.failed`
- `connected_account.disconnect_requested`
- `connected_account.disconnected`

External sync:

- `external_sync.gmail.started`
- `external_sync.gmail.completed`
- `external_sync.gmail.failed`
- `external_sync.calendar.started`
- `external_sync.calendar.completed`
- `external_sync.calendar.failed`

AI:

- `ai.generation.started`
- `ai.generation.completed`
- `ai.generation.failed`
- `ai.usage.recorded`
- `ai.usage.blocked`

Gmail draft explicit action:

- `gmail_draft.create.started`
- `gmail_draft.create.completed`

## Health Endpoint

Existing endpoint:

```text
GET /api/health
```

It runs a simple database connectivity check through Prisma/Terminus and returns no secret configuration.

Recommended uptime checks:

- alert when `/api/health` fails
- alert when response latency is consistently high
- keep successful health logs suppressed unless debugging

## Recommended Alerts

Configure these in the eventual log/monitoring provider:

| Alert | Suggested signal |
| --- | --- |
| High 500 rate | `http.request.completed` with `statusCode >= 500` above baseline |
| High auth failure rate | `auth.login.failed`, 401, or 403 spike |
| High 429 rate | `rate_limit.exceeded` or `statusCode=429` spike |
| OAuth callback failures | `oauth.google.callback.failed` spike |
| Google token refresh failures | `google.token_refresh.failed` spike |
| Gmail sync failures | `external_sync.gmail.failed` spike |
| Calendar sync failures | `external_sync.calendar.failed` spike |
| AI generation failures | `ai.generation.failed` spike |
| AI usage blocked spikes | `ai.usage.blocked` spike |
| API unavailable | `/api/health` failing |

## Troubleshooting

### Investigate OAuth failure

1. Find `oauth.google.callback.failed`.
2. Check `reason`, `statusCode`, and `requestId`.
3. Confirm `GOOGLE_OAUTH_REDIRECT_URI` exactly matches Google Cloud.
4. Confirm `FRONTEND_URL` and `CORS_ORIGIN`.
5. Confirm consent screen status and test users.
6. Do not print or inspect OAuth tokens in logs.

### Investigate Gmail or Calendar sync failure

1. Find `external_sync.gmail.failed` or `external_sync.calendar.failed`.
2. Check `connectedAccountId`, `userId`, `organizationId`, and safe `errorMessage`.
3. Check nearby `google.token_refresh.failed`.
4. Ask user to reconnect Google if refresh authorization fails.
5. Confirm no email was sent and no CRM record was created automatically.

### Investigate AI generation failure

1. Find `ai.generation.failed`.
2. Check `feature`, provider/model, status code, and error code.
3. Check related `ai.usage.blocked` if the failure is usage/credit related.
4. Do not log or paste AI input/output text unless a future support process explicitly redacts it.

### Investigate rate limiting

1. Find `rate_limit.exceeded`.
2. Check category, key strategy, route, and user/org if available.
3. For public production or multi-instance deployments, confirm ingress/Redis-backed throttling exists.

## Production Provider Options

No vendor is wired in this phase. Suitable later options:

- managed app platform logs
- cloud provider log router
- OpenTelemetry collector
- Datadog, New Relic, Sentry, Grafana/Loki, or similar

Before adding a vendor, confirm:

- logs are encrypted in transit and at rest
- retention matches privacy policy
- redaction is preserved before export
- access to logs is restricted

## Staging Smoke Logging Checklist

1. Start API and web.
2. Run the default runtime smoke:

   ```bash
   SMOKE_API_URL=https://<api-domain>/api \
   SMOKE_EMAIL=<staging-user> \
   SMOKE_PASSWORD=<staging-password> \
   SMOKE_VERBOSE=true \
   corepack pnpm smoke:runtime
   ```

3. Copy one printed `X-Request-Id` and find it in API logs.
4. Confirm login emits `auth.login.success`.
5. Trigger one failed login and confirm `auth.login.failed`.
6. Trigger a safe 404/401/403 and confirm `http.request.completed`.
7. Trigger one safe 429 if practical and confirm `rate_limit.exceeded`.
8. Run Google OAuth with a staging test user.
9. Run manual Gmail sync or `SMOKE_RUN_EXTERNAL_SYNC=true` only when a connected staging Google account exists.
10. Run manual Calendar sync or `SMOKE_RUN_EXTERNAL_SYNC=true` only when a connected staging Google account exists.
11. Generate one mock AI suggestion manually or with `SMOKE_RUN_AI=true`.
12. Confirm logs contain no passwords, tokens, Gmail body/snippets, Calendar descriptions, AI output text, or Gmail draft body.

See [staging-runtime-smoke-tests.md](./staging-runtime-smoke-tests.md) for the full local/staging smoke plan.

## Current Limitations

- No external monitoring vendor is configured.
- No dashboard/alert rules are provisioned.
- Request logs are emitted by the API process only.
- Rate limiting is still process-local until a shared Redis/ingress limiter is added.
- Background worker observability is minimal because scheduled workers are not implemented yet.
