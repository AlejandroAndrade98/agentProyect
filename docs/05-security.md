# Security Specification

## Authentication and Authorization

- The platform uses JWT access tokens and refresh tokens.
- Refresh tokens are stored hashed in the database.
- Passwords are hashed with bcrypt.
- The current RBAC roles are:
  - `SUPER_ADMIN`
  - `OWNER`
  - `ADMIN`
  - `SALES`
  - `VIEWER`

## Access Control

- `JwtAuthGuard` validates access tokens.
- `JwtAuthGuard` loads the current user and organization from the database.
- Inactive users are blocked.
- Organizations with status `SUSPENDED` or `CANCELLED` are blocked from login, refresh, and protected endpoints.
- `RolesGuard` enforces endpoint-level role permissions.
- `CurrentUser` exposes the authenticated user's `id`, `organizationId`, and `role`.

## Tenant Isolation

- All tenant-aware commercial entities must be scoped by `organizationId`.
- Client-provided `organizationId` is not accepted in tenant-aware DTOs.
- Services derive `organizationId` from the authenticated user context.
- Cross-tenant access must return controlled errors.
- Platform Admin endpoints are restricted to `SUPER_ADMIN`.

## Organization Access Management

- `User.isActive = false` disables a specific user.
- `Organization.status = SUSPENDED` blocks a full customer organization.
- `Organization.status = CANCELLED` blocks operational access while preserving data.
- Users are not hard-deleted from organization settings.
- Organization owner onboarding is invitation-based.

## Invitation Security

- Organization invitations use random tokens.
- Only the token hash is stored in the database.
- Development responses may temporarily return the raw acceptance token.
- In production, acceptance tokens should be delivered through email and not displayed permanently in the UI.
- Accepted, revoked, and expired invitations cannot be reused.

## AI Safety and Human Review

- AI suggestions are human-in-the-loop.
- Accepting an AI suggestion does not automatically change CRM records.
- Applying an AI suggestion requires an explicit user action.
- The platform must not send emails automatically without explicit user approval.
- AI-generated outputs must remain reviewable before becoming official CRM data.

## Secrets and Environment

- JWT secrets, database URLs, Redis URLs, and future AI/email provider secrets must be loaded from environment variables.
- Real `.env` files must not be committed.
- Only `.env.example` should be shared in documentation.

## Activity and Audit Trail

- The platform uses `ActivityEvent` as the current commercial activity timeline.
- Important CRM and AI workflow events are recorded as activity events.
- A dedicated immutable audit log may be added later for compliance-grade auditing.

## Rate Limiting and Usage Controls

- AI usage controls and monetization are planned for future phases.
- Future work should include limits by organization, user, and provider usage.
- Rate limiting by IP and organization is recommended before production exposure.