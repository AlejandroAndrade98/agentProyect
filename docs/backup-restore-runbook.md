# Backup and Restore Runbook

Date: 2026-05-31

This runbook defines the backup and restore plan required before staging or private beta. It is documentation only. It does not run backups, connect to production, print secrets, change schema, add migrations, change runtime behavior, or deploy anything.

## Purpose

Protect Sales AI Platform data from accidental deletion, bad migrations, infrastructure failure, leaked backup artifacts, and recoverability gaps. The immediate goal is private beta readiness with a clear operator checklist and at least one successful restore drill before onboarding beta users.

## Scope

Covered:

- PostgreSQL application data managed by Prisma.
- Auth/session records stored in Postgres.
- CRM, activity, AI, Google connected account, and external sync metadata.
- Backup storage expectations, restore drills, and incident response.
- Special handling for encrypted Google OAuth tokens.

Not covered in this phase:

- Implementing backup automation.
- Running a live backup or restore.
- Adding retention cleanup jobs.
- Changing Prisma schema or migrations.
- Implementing object storage export backup.
- Rotating encryption keys.

## Environments

| Environment | Backup expectation | Restore expectation |
| --- | --- | --- |
| Local dev | Disposable. Docker volumes may be reset. Optional developer `pg_dump` only. | Restore only sanitized data. Never restore raw production backups locally. |
| Staging | Managed Postgres backup or provider snapshot. Restore drills should target staging or an isolated staging-like DB. | Restore production-like backup into isolated staging, then run smoke checks. |
| Production/private beta | Managed Postgres automated backups, point-in-time recovery if available, and manual backup before risky migrations. | Restore into isolated DB first. Promote/replace production only under incident plan. |

## Initial RPO and RTO Targets

Initial private beta targets:

- RPO: 24 hours minimum. Prefer shorter RPO with managed Postgres point-in-time recovery.
- RTO: 4 to 8 hours for initial private beta incidents.

Revisit these targets after the first beta cohort, after monitoring is wired, and before any public launch.

## Critical Data Inventory

The following categories were identified from `packages/database/prisma/schema.prisma`.

| Category | Tables/models | Why it matters | Recovery sensitivity | Privacy sensitivity | Special handling |
| --- | --- | --- | --- | --- | --- |
| Platform/admin organization data | `Organization` | Tenant identity, status, plan, limits, AI credit balance, platform controls. | High. Losing or rolling back can block tenants or corrupt limits. | Medium. Billing/support emails and org metadata. | Losing `aiCreditsBalance` affects usage/billing trust. |
| Users | `User` | Authentication identity, roles, organization membership. | High. Users may be locked out or RBAC may regress. | High. Emails, names, password hashes. | Password hashes must stay protected in backups. |
| Refresh/auth records | `RefreshToken` | Session continuity and revocation state. | Medium to high. Restore can revive old sessions or revoke current ones depending on point selected. | High. Token hashes are sensitive auth material. | Consider forcing logout after security incidents or major restore. |
| Organization invitations | `OrganizationInvitation` | Pending/accepted/revoked invite state and owner setup flows. | Medium. Needed for onboarding and auditability. | High. Invitation emails and token hashes. | Token hashes should remain protected; do not expose in support logs. |
| Companies | `Company` | Core CRM account data. | High. Customer/business records. | Medium to high. Notes may contain customer information. | Soft-deleted/archived states should be preserved. |
| Contacts | `Contact` | People records and relationship data. | High. Core CRM. | High. Emails, phone, LinkedIn, notes. | Production backups contain personal data. |
| Products | `Product` | Product catalog linked to sales context. | Medium. | Low to medium. | Needed for CRM context and reports. |
| Leads | `Lead` | Pipeline and opportunity state. | High. | Medium to high. | Losing status/priority/history impacts commercial operations. |
| Tasks | `Task` | Follow-up obligations and workflow state. | High. | Medium. | Restore point can reopen or lose completed work. |
| Notes | `Note` | Manual and AI-assisted CRM notes. | High. | High. Free-text may contain sensitive customer details. | Treat as personal/customer data. |
| Activity/audit data | `ActivityEvent`, `AuditLog` | Timeline, auditability, support investigations. | High for trust and incident review. | Medium to high. Metadata can include entity context. | Losing it weakens audit and postmortem capability. |
| AI suggestions | `AiSuggestion`, `AiExtraction`, `AcceptedAiInsight` | Human-in-loop AI output, review status, accepted insight history. | High. | High. Includes input/output text, metadata, source IDs. | Do not log or paste AI output during restore troubleshooting. |
| AI usage records | `AiUsageRecord`, `OrganizationUsageSummary`, `AiUserUsageLimit` | Credit usage, feature accounting, org/user limits. | High. | Medium. | Losing records affects billing/usage/auditability. |
| AI credit transactions | `AiCreditTransaction` | Credit ledger, grants, debits, refunds, balance evidence. | Critical. | Medium. | Balance reconciliation depends on transaction history. |
| Connected accounts | `ConnectedAccount` | Google account link, capabilities, encrypted tokens, provider state. | Critical for sync. | Critical. Contains encrypted OAuth tokens and account email. | DB backup requires matching encryption key backup. |
| Connected account sync states | `ConnectedAccountSyncState` | Gmail/Calendar sync cursor, status, last errors. | Medium to high. | Medium. | Wrong restore point can re-sync or miss provider changes. |
| OAuth state records | `ConnectedAccountOAuthState` | OAuth state, PKCE verifier, status. | Medium. Mostly short-lived. | High. Encrypted PKCE data and redirect/scopes. | Expired states can usually be discarded, but active flows may fail after restore. |
| External email metadata | `ExternalEmailMessage` | Synced Gmail metadata, AI source context. | High for sync/AI context. | High. Subject, snippet, participants, labels, dates. | No email body by design, but metadata is still personal data. |
| External calendar metadata | `ExternalCalendarEvent` | Synced Calendar metadata, AI source context. | High for sync/AI context. | High. Description, attendees, location, links. | Treat descriptions and attendees as sensitive. |
| Exports and usage summaries | `ExportJob`, `OrganizationUsageSummary` | Export status and usage reporting. | Medium. | Medium to high depending on exported content path. | If export files become durable storage later, back them up separately. |

## Special Handling for Encrypted OAuth Tokens

Connected account access and refresh tokens are encrypted before storage.

Important rules:

- Database backups alone are not enough if `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` is lost.
- Store `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` in a secret manager or password vault with access controls.
- Store `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION` with the key material.
- Restore DB snapshots with the matching encryption key version.
- Restoring a DB with the wrong encryption key can make stored Google tokens unreadable.
- Never store encryption keys in database backups, repo docs, tickets, chat transcripts, or logs.
- Key rotation requires a planned process: decrypt with old key, re-encrypt with new key, update version, test reconnect fallback, and retain old key until all records are migrated.
- If the key is lost, assume connected accounts must be disconnected or reconnected by users.

## Backup Strategy

Preferred for private beta:

1. Use managed PostgreSQL automated backups.
2. Enable point-in-time recovery if the provider supports it.
3. Keep daily backups at minimum.
4. Take a manual backup or provider snapshot before high-risk migrations, bulk imports, or major deployment changes.
5. Store manual backup artifacts in encrypted storage with restricted access.
6. Keep backup access separate from normal app operator access when possible.
7. Test restores before onboarding beta users.

Self-hosted Docker note:

- Do not rely only on the `postgres_data` Docker volume.
- Schedule backups outside the container.
- Store copies off-host.
- Encrypt backup files at rest.
- Verify restore, not just backup creation.

Placeholder logical backup command:

```bash
pg_dump "$DATABASE_URL" --format=custom --file backup.dump
```

Placeholder plain SQL backup command:

```bash
pg_dump "$DATABASE_URL" --format=plain --file backup.sql
```

Warnings:

- Do not paste real `DATABASE_URL` values into docs, terminals that record shared history, tickets, or chat.
- Do not commit backup files.
- Backup files may contain passwords hashes, personal data, customer data, Gmail metadata, Calendar metadata, AI output, and encrypted OAuth tokens.
- Use encrypted storage for backup artifacts.
- Never restore production backups into local dev without a sanitization plan.

## Restore Strategy

Default restore path:

1. Identify the incident window and desired recovery point.
2. Restore into a new isolated database first.
3. Use the matching application build and env vars for that restore point when possible.
4. Provide the matching `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` and version through the secret manager.
5. Run Prisma validation and inspect migration state.
6. Start the API against the restored DB in staging or isolated environment.
7. Run runtime smoke tests.
8. Verify critical data manually.
9. Decide whether to promote the restored DB, write a forward fix, or abandon the restore.

Placeholder custom-format restore:

```bash
pg_restore --dbname "$RESTORE_DATABASE_URL" backup.dump
```

Placeholder plain SQL restore:

```bash
psql "$RESTORE_DATABASE_URL" --file backup.sql
```

Use provider-specific point-in-time restore when available. Prefer restoring to a separate DB/instance rather than overwriting production immediately.

## Restore Drill Plan

Frequency:

- Monthly before private beta.
- Quarterly after private beta begins.
- Before and after any high-risk migration phase.

Drill steps:

1. Select a recent staging or production-like backup.
2. Restore it into an isolated staging database.
3. Inject only the required staging secrets through the secret manager.
4. Verify the matching connected account encryption key exists without exposing it.
5. Run:

   ```bash
   corepack pnpm db:validate
   ```

6. Start the API against the restored database.
7. Run:

   ```bash
   SMOKE_API_URL=https://<restored-api-domain>/api \
   SMOKE_EMAIL=<staging-user> \
   SMOKE_PASSWORD=<staging-password> \
   SMOKE_VERBOSE=true \
   corepack pnpm smoke:runtime
   ```

8. Verify login and `/users/me`.
9. Verify CRM records: companies, contacts, products, leads, tasks, notes.
10. Verify activity events and audit records are present for recent operations.
11. Verify AI usage records, AI credit transactions, and AI suggestions.
12. Verify connected account metadata and sync states are readable.
13. Do not run live Google sync against restored production tokens unless the environment is intentionally isolated and approved.
14. Confirm no email is sent and no Gmail draft is created automatically.
15. Record drill date, backup source, restore duration, smoke result, data checks, issues, and follow-up owners.

## Migration Safety Checklist

Before production migration:

- Run `corepack pnpm smoke:static`.
- Run `corepack pnpm check:generated`.
- Run `corepack pnpm db:validate`.
- Run `corepack pnpm --filter @sales-ai/api build`.
- Run `corepack pnpm --filter @sales-ai/web exec tsc --noEmit`.
- Run `corepack pnpm build`.
- Confirm migration files are the intended release set.
- Take or verify a fresh backup/snapshot.
- Confirm backup artifact or provider restore point is visible.
- Confirm encryption key and version are available in the secret manager.

Production migration rules:

- Use `corepack pnpm db:deploy`.
- Never use `prisma migrate dev` in production.
- Do not run manual destructive SQL without an approved incident plan.
- Run `corepack pnpm smoke:runtime` after migration/deploy.
- Keep the previous app build available while verifying compatibility.

Rollback limitations:

- Prisma migrations are not automatically reversible.
- If a migration partially applies or corrupts data, choose between point-in-time restore and a forward corrective migration.
- Restore from backup when data loss/corruption is broad or the correct state is known from a restore point.
- Write a forward migration when the issue is narrow, schema-compatible, and can be repaired safely without losing recent data.

## Data Retention and Privacy Notes

Current retention env placeholders exist, but cleanup jobs are not implemented in this phase.

Recommendations before broader production:

- Define retention for external email metadata, including subject, snippet, participants, labels, and dates.
- Define retention for external calendar metadata, including descriptions, attendees, locations, and links.
- Define retention for AI suggestions, AI input text, AI output text, and rejected/expired suggestions.
- Preserve activity/audit data long enough for support, security, and compliance needs.
- Decide how soft-deleted and archived CRM data should age out.
- Define organization cancellation/deletion process.
- Define user data export and deletion process.
- Ensure backup retention follows the same privacy commitments where technically possible.

## Incident Response Checklists

### Accidental data deletion

- Immediate action: pause destructive workflows and identify affected organization/entity/time range.
- Investigation: use activity events, audit logs, request IDs, and DB timestamps.
- Recovery: restore to isolated DB, compare affected records, then choose targeted repair or full restore.
- Communication: notify affected internal owner and impacted customer contact if beta policy requires.
- Postmortem: add guardrails, tests, permissions review, or UI confirmation as needed.

### Bad migration

- Immediate action: stop further deploys and capture migration logs.
- Investigation: determine whether schema, data, or app compatibility failed.
- Recovery: restore from pre-migration backup for broad corruption; write forward migration for narrow safe fixes.
- Communication: share status, impact, and expected recovery time.
- Postmortem: improve migration review, staging restore drill, and release gating.

### Leaked backup

- Immediate action: revoke access to exposed location and preserve evidence.
- Investigation: determine backup contents, exposure window, access logs, and whether encryption was intact.
- Recovery: rotate affected secrets where needed, including DB credentials and app secrets if exposed.
- Communication: follow legal/privacy notification requirements.
- Postmortem: tighten backup storage, retention, encryption, and access policies.

### Lost encryption key

- Immediate action: stop key rotation or restore attempts that depend on the missing key.
- Investigation: verify secret manager history, backups, operator access, and key version.
- Recovery: if unrecoverable, connected account encrypted tokens cannot be decrypted. Require users to reconnect Google accounts.
- Communication: explain that reconnect is required; do not expose token details.
- Postmortem: improve secret backup, dual-control access, and key rotation documentation.

### Corrupted OAuth token data

- Immediate action: pause Google sync/draft actions if failures spike.
- Investigation: check connected account status, token encryption version, `google.token_refresh.failed`, and sync errors.
- Recovery: restore connected account records if corruption is recent; otherwise ask users to reconnect.
- Communication: notify affected users about reconnect requirements.
- Postmortem: add validation, alerting, or safer rotation procedure.

### Production database unavailable

- Immediate action: confirm provider status, API health, DB connectivity, and recent changes.
- Investigation: inspect provider metrics, logs, network rules, and connection limits.
- Recovery: fail over or restore using provider tooling. Bring API back against the recovered DB.
- Communication: provide outage status and ETA.
- Postmortem: review provider SLA, connection pooling, backup/PITR settings, and alert thresholds.

### AI usage or credits inconsistent

- Immediate action: pause manual credit adjustments if ledger correctness is uncertain.
- Investigation: compare `AiUsageRecord`, `AiCreditTransaction`, and `Organization.aiCreditsBalance`.
- Recovery: prefer corrective credit transaction over direct balance edits. Restore only if broad ledger corruption occurred.
- Communication: notify affected organization owner if credits or billing trust is impacted.
- Postmortem: add reconciliation report, alerts, or transaction tests.

## Responsibilities

| Role | Responsibility |
| --- | --- |
| Product/operator owner | Approves restore, customer communication, and beta go/no-go. |
| Backend/API owner | Verifies Prisma migration state, API boot, and smoke results. |
| Database/platform owner | Manages provider backups, PITR, restore execution, and backup storage access. |
| Security owner | Controls secret manager access, encryption key backup, and leaked backup response. |
| Support/customer owner | Coordinates user/customer communication during restore or reconnect events. |

For a small team, one person may hold multiple roles, but each responsibility should have an explicit owner before beta.

## Validation Checklist

Before private beta:

- Managed Postgres automated backups are enabled.
- PITR is enabled or a documented limitation is accepted.
- Backup retention duration is documented.
- Manual pre-migration backup process is documented.
- Backup artifacts are encrypted at rest and access-restricted.
- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` and version are stored in a secret manager.
- At least one restore drill has passed in staging or isolated DB.
- Restored API can boot.
- `corepack pnpm smoke:runtime` passes against restored environment.
- Login, CRM reads, AI usage records, and connected account metadata have been checked.
- Google sync is not run against restored production tokens unless intentionally isolated.
- Rollback/restore decision owner is named.
- This runbook is linked from deployment, observability, and production readiness docs.

## Remaining Follow-Up

- Automate managed backup verification in deployment provider.
- Automate restore drill evidence capture.
- Add tenant/RBAC test coverage for restored data.
- Add AI credit ledger reconciliation report.
- Design retention cleanup jobs before public production.
- Design encrypted OAuth token key rotation procedure.
