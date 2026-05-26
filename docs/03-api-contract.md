# API Contract

## General

- **Base URL:** `/api`
- **Format:** JSON
- **Authentication:** Bearer Token, JWT access token.
- **Refresh Tokens:** Stored hashed in database and rotated through refresh flow.
- **Tenant Isolation:** All tenant-aware business resources must be scoped by `organizationId` derived from the authenticated user context.
- **Soft Delete:** Commercial entities use `deletedAt` for soft delete when applicable.
- **Human-in-the-loop AI:** AI can suggest, but it cannot create official CRM records, apply CRM changes, or send emails without explicit human approval.

---

## Auth

### `POST /auth/login`

Authenticates a user and returns access and refresh tokens.

### `POST /auth/refresh`

Rotates refresh token and returns a new token pair.

### `POST /auth/logout`

Invalidates the current refresh token/session.

### Current user endpoints

### `GET /users/me`

Returns the authenticated user profile.

### `GET /organizations/current`

Returns the authenticated user's current organization.

---

## Platform Admin

Platform Admin endpoints are restricted to `SUPER_ADMIN`.

### Organizations

### `GET /platform/organizations`

Lists organizations globally.

Supports pagination, search, filters and sorting.

Common query params:

- `page`
- `pageSize`
- `search`
- `accountType`
- `status`
- `plan`
- `aiEnabled`
- `sortBy`
- `sortOrder`

### `GET /platform/organizations/:id`

Returns organization detail, including users and invitations.

### `PATCH /platform/organizations/:id`

Updates platform-level organization settings.

Can update fields such as:

- `name`
- `industry`
- `plan`
- `accountType`
- `status`
- `billingEmail`
- `supportEmail`
- `timezone`
- `locale`
- `statusReason`
- `maxUsers`
- `maxActiveLeads`
- `aiMonthlyCreditsLimit`
- `aiDefaultUserMonthlyCreditsLimit`
- `aiCreditsBalance`

### `PATCH /platform/organizations/:id/status`

Updates organization status.

Allowed organization statuses:

- `TRIAL`
- `ACTIVE`
- `SUSPENDED`
- `CANCELLED`

`SUSPENDED` and `CANCELLED` organizations are blocked from login, refresh and protected API access.

---

## Platform Owner Onboarding

Platform owner onboarding is restricted to `SUPER_ADMIN`.

### `POST /platform/organizations/onboard`

Creates a new customer organization and generates the initial `OWNER` invitation.

Main behavior:

- Creates organization.
- Creates pending `OWNER` invitation.
- Blocks duplicate slugs.
- Blocks owner email if already used by an existing user.
- Blocks owner email if it already has a pending invitation.
- Returns organization detail and a temporary development invitation token.

Example body:

```json
{
  "organizationName": "Acme Sales",
  "slug": "acme-sales",
  "ownerEmail": "owner@acme.com",
  "billingEmail": "billing@acme.com",
  "supportEmail": "support@acme.com",
  "timezone": "America/Bogota",
  "locale": "es-CO",
  "accountType": "COMPANY",
  "status": "TRIAL",
  "maxUsers": 10,
  "maxActiveLeads": 100,
  "aiMonthlyCreditsLimit": 5000000,
  "aiDefaultUserMonthlyCreditsLimit": 1000000,
  "aiCreditsBalance": 5000000
}