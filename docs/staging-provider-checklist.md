# Staging Provider Checklist

Date: 2026-05-31

Use this fill-in checklist when configuring the first staging/private beta provider. Do not paste real secrets into this document. Store real values in the provider secret manager.

## Deployment Owner

| Item | Value |
| --- | --- |
| Provider | `<provider-name>` |
| Deployment owner | `<name>` |
| Backup/DB owner | `<name>` |
| Security/secrets owner | `<name>` |
| Staging deploy date | `<date>` |

## Repository Connection

| Item | Value |
| --- | --- |
| Repository URL | `<repo-url>` |
| Branch to deploy | `main` or `<staging-branch>` |
| Monorepo root | repository root |
| Package manager | `pnpm` through Corepack |
| Node version | `20` |
| Install command | `corepack pnpm install --frozen-lockfile` |
| Local validation command | `corepack pnpm smoke:static && corepack pnpm check:generated && corepack pnpm db:validate && corepack pnpm --filter @sales-ai/web exec tsc --noEmit && corepack pnpm --filter @sales-ai/api build && corepack pnpm build` |

## API Service Settings

| Item | Value |
| --- | --- |
| Service name | `<sales-ai-api-staging>` |
| Root directory | repository root |
| Build command | `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @sales-ai/api build` |
| Start command | `node apps/api/dist/main.js` |
| Runtime | Node.js 20 |
| Port env | `API_PORT` or provider-assigned port |
| Health check path | `/api/health` |
| Public API base URL | `https://api-staging.example.com/api` |
| Logs location | `<provider-log-url-or-location>` |
| Rollback control | `<provider-rollback-button-or-previous-deploy>` |

## Web Service Settings

| Item | Value |
| --- | --- |
| Service name | `<sales-ai-web-staging>` |
| Root directory | repository root |
| Build command | `corepack pnpm install --frozen-lockfile && corepack pnpm --filter @sales-ai/web build` |
| Start command | `corepack pnpm --filter @sales-ai/web start` |
| Runtime | Node.js 20 / managed Next.js |
| Public web URL | `https://app-staging.example.com` |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.example.com/api` |
| Logs location | `<provider-log-url-or-location>` |
| Rollback control | `<provider-rollback-button-or-previous-deploy>` |

## Postgres Settings

| Item | Value |
| --- | --- |
| Database name | `<sales_ai_staging>` |
| Managed Postgres enabled | `<yes/no>` |
| Connection string secret | `DATABASE_URL` |
| SSL required | `<provider-setting>` |
| Automated backups enabled | `<yes/no>` |
| PITR enabled | `<yes/no/not-supported>` |
| Backup retention | `<duration>` |
| Restore drill scheduled | `<date>` |
| Restore drill completed | `<yes/no>` |

## Redis Settings

Redis is optional/deferred for the first beta unless the selected host needs it or a later phase enables shared rate limiting/background jobs.

| Item | Value |
| --- | --- |
| Redis used for staging | `<yes/no>` |
| Redis URL secret | `REDIS_URL` |
| Provider | `<provider-name>` |
| Notes | `<notes>` |

## Environment Variables

Use [staging-env-template.md](./staging-env-template.md).

Required placeholder values:

```text
API_BASE_URL=https://api-staging.example.com/api
WEB_URL=https://app-staging.example.com
NEXT_PUBLIC_API_URL=https://api-staging.example.com/api
CORS_ORIGIN=https://app-staging.example.com
FRONTEND_URL=https://app-staging.example.com
GOOGLE_REDIRECT_URI=https://api-staging.example.com/api/connected-accounts/oauth/google/callback
```

Checklist:

- [ ] API secrets configured in provider secret manager.
- [ ] Web env configured in provider dashboard.
- [ ] Staging and production secrets are different.
- [ ] No `.env.example` placeholder values are used as real secrets.
- [ ] Connected account token encryption key is backed up in secret manager/password vault.
- [ ] Encryption key version is recorded.

## Google OAuth Staging

| Item | Value |
| --- | --- |
| Google OAuth client | `<client-name>` |
| Authorized redirect URI | `https://api-staging.example.com/api/connected-accounts/oauth/google/callback` |
| OAuth consent screen status | `<testing/production>` |
| Test users configured | `<yes/no>` |
| Scopes reviewed | `<yes/no>` |

Checks:

- [ ] `GOOGLE_OAUTH_REDIRECT_URI` exactly matches Google Cloud.
- [ ] `FRONTEND_URL` points to staging web.
- [ ] `CORS_ORIGIN` points to staging web.
- [ ] Connect Google works with a test user.
- [ ] Callback returns to connected accounts settings.

## HTTPS and Domains

| Item | Value |
| --- | --- |
| API HTTPS enabled | `<yes/no>` |
| Web HTTPS enabled | `<yes/no>` |
| API custom domain | `<optional-later>` |
| Web custom domain | `<optional-later>` |
| TLS provider | `<provider/default>` |

Custom domains can wait if provider URLs are stable and accepted by Google OAuth test setup.

## Deployment Rollback Controls

| Item | Value |
| --- | --- |
| API rollback method | `<previous deploy/image>` |
| Web rollback method | `<previous deploy/build>` |
| DB restore method | `<managed backup/PITR>` |
| Last known good deploy | `<deploy-id>` |

Rollback notes:

- Do not roll back API behind an incompatible migration.
- Restore DB into an isolated instance before replacing staging/production.
- Keep the matching connected account encryption key for restored DB snapshots.

## Smoke and Verification

| Check | Result |
| --- | --- |
| `GET /api/health` | `<pass/fail>` |
| `corepack pnpm smoke:runtime` read-only | `<pass/fail>` |
| Safe mutation smoke | `<pass/fail/skipped>` |
| Google OAuth connect | `<pass/fail/skipped>` |
| Gmail sync | `<pass/fail/skipped>` |
| Calendar sync | `<pass/fail/skipped>` |
| Mock AI suggestion | `<pass/fail/skipped>` |
| Request ID visible in logs | `<pass/fail>` |
| Backup configured | `<pass/fail>` |
| Restore drill scheduled/completed | `<scheduled/completed>` |

## Known Limitations Accepted For Beta

- `<limitation>`
- `<owner>`
- `<follow-up phase>`
