# Google OAuth Production Checklist

Date: 2026-05-31

This checklist prepares Google OAuth for production connected Gmail and Calendar accounts. It does not deploy the app, add real secrets, change routes, change Prisma schema, send email, create Gmail drafts automatically, create CRM records automatically, or add background jobs.

## Current Implementation Audit

| Area | Current behavior |
| --- | --- |
| OAuth start endpoint | `GET /api/connected-accounts/oauth/google/start` |
| OAuth callback endpoint | `GET /api/connected-accounts/oauth/google/callback` |
| Frontend entry point | Connected Accounts settings page calls the start endpoint, then redirects the browser to Google's authorization URL. |
| Backend redirect URI | `GOOGLE_OAUTH_REDIRECT_URI`, with fallback alias `GOOGLE_REDIRECT_URI`; local default is `http://localhost:4000/api/connected-accounts/oauth/google/callback`. |
| Frontend success redirect | `FRONTEND_URL` if set, otherwise first value from `CORS_ORIGIN`, ending at `/dashboard/settings/connected-accounts?connected=google` for first connect or `?reconnected=google` for reconnect. |
| State handling | 32-byte random state is generated, SHA-256 hashed, stored with user, organization, provider, capabilities, scopes, redirect URI, expiration, and status. Raw state is only sent to Google. |
| State expiration | 10 minutes. Expired states are marked `EXPIRED`. |
| One-time use | Callback rejects non-`PENDING` states and states with `usedAt`; successful callback marks the state `USED`. Starting a new OAuth flow cancels prior pending states for the same user/provider/org. |
| PKCE | Schema has PKCE fields, but the current flow does not use PKCE. The flow relies on confidential web-server OAuth with client secret. |
| Token exchange | Backend exchanges authorization code at `https://oauth2.googleapis.com/token`. |
| User info | Backend reads Google OpenID user info from `https://openidconnect.googleapis.com/v1/userinfo`. |
| Token storage | Access and refresh tokens are encrypted before storage. |
| Token encryption | AES-256-GCM with 12-byte IV, 16-byte auth tag, and a base64 key that must decode to exactly 32 bytes. Payload format includes key version. |
| Token refresh | Manual sync decrypts refresh token, requests a new access token when the current token expires within 60 seconds, encrypts the new access token, and updates expiry. |
| Disconnect request | User/admin/sales can request disconnect; status becomes `DISCONNECT_REQUESTED`. |
| Admin disconnect | SUPER_ADMIN, OWNER, or ADMIN can disconnect; sync states pause and encrypted tokens are cleared. |
| Reconnect | A disconnected Google connected account can be reauthorized from the Connected Accounts page. The callback reuses the existing connected account row, refreshes encrypted tokens/account metadata, clears disconnect timestamps, returns status to `CONNECTED`, and does not create a duplicate account. |
| Gmail capability | Manual metadata sync fetches recent Gmail message metadata only; manual Gmail search/import previews and imports selected message metadata only; body is not stored; email is not sent. Gmail draft creation remains a separate explicit accepted-suggestion action. |
| Calendar capability | Manual calendar sync fetches primary-calendar event metadata for the next 30 days; no CRM record is created automatically. |

## Google Cloud Setup

1. Create or select the production Google Cloud project.
2. Configure the OAuth consent screen.
3. Set app name, user support email, developer contact email, logo, and production branding.
4. Add authorized domains:
   - `salesflowsai.com`
5. Add app domain URLs in the Google consent screen:
   - Home page URL: `https://www.salesflowsai.com`
   - Privacy policy URL: `https://www.salesflowsai.com/privacy`
   - Terms of service URL: `https://www.salesflowsai.com/terms`
6. Create an OAuth 2.0 Web application client.
7. Authorized redirect URI:

   ```text
   https://api.salesflowsai.com/api/connected-accounts/oauth/google/callback
   ```

8. Authorized JavaScript origins are usually not required for this server-side OAuth code exchange, but if Google Cloud requires them for the web client, use exact frontend origins only:

   ```text
   https://www.salesflowsai.com
   ```

## Required Runtime Env

Use the existing canonical repo names:

```text
GOOGLE_OAUTH_CLIENT_ID=<from Google Cloud>
GOOGLE_OAUTH_CLIENT_SECRET=<from Google Cloud secret manager>
GOOGLE_OAUTH_REDIRECT_URI=https://api.salesflowsai.com/api/connected-accounts/oauth/google/callback
FRONTEND_URL=https://www.salesflowsai.com
CORS_ORIGIN=https://www.salesflowsai.com
CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY=<32-byte base64 key>
CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION=v1
```

The API also supports fallback aliases:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

Prefer the canonical `GOOGLE_OAUTH_*` names for new environments.

## Scope Justification

| Scope | Purpose | Capability | Sensitivity | Required now? | Deferral note |
| --- | --- | --- | --- | --- | --- |
| `openid` | Identify the Google account subject. | Base OAuth identity | Standard OpenID | Yes | Required for account identity. |
| `email` | Read Google account email. | Base OAuth identity | Standard OpenID | Yes | Required to display/account-match connected account. |
| `profile` | Read display name/profile basics. | Base OAuth identity | Standard OpenID | Yes | Could be deferred if only email display is acceptable. |
| `https://www.googleapis.com/auth/gmail.readonly` | Read Gmail metadata for manual sync. | Email sync | Sensitive/restricted depending on Google classification | Yes for Gmail sync | Could be omitted for calendar-only connections. |
| `https://www.googleapis.com/auth/gmail.compose` | Create Gmail drafts after explicit human action. | Gmail draft creation | Sensitive/restricted depending on Google classification | Yes for current explicit draft action | Defer if Gmail draft creation is disabled. Do not request if not offering drafts. |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Read calendar event metadata for manual sync. | Calendar sync | Sensitive | Yes for Calendar sync | Could be omitted for email-only connections. |

Google may require app verification, and Gmail restricted scopes can require a security assessment before broad external production use. For private beta, use Google test users until verification status is clear.

## Consent Screen and Publishing

- Start in testing mode with explicit test users for staging/private beta.
- Verify consent screen copy explains Gmail metadata, calendar metadata, and Gmail draft capability.
- Verify consent screen copy covers manual Gmail search/import as metadata-only review inbox functionality, not automatic historical import.
- Verify the app domain URLs are publicly reachable without authentication:
  - Home: `https://www.salesflowsai.com`
  - Privacy: `https://www.salesflowsai.com/privacy`
  - Terms: `https://www.salesflowsai.com/terms`
- Verify the privacy policy describes Google user data usage, encrypted OAuth tokens, human-reviewed AI suggestions, and no automatic email, Gmail draft, or CRM record creation.
- Do not imply emails are sent automatically. The product does not send email automatically.
- Do not imply CRM records are created automatically. The product requires explicit human actions.
- Move to production publishing only after verification requirements are satisfied.

## Redirect URI QA

- `GOOGLE_OAUTH_REDIRECT_URI` exactly matches the Google Cloud authorized redirect URI.
- `FRONTEND_URL` points to the deployed frontend origin.
- `CORS_ORIGIN` contains exact frontend origins, no wildcard.
- Local dev callback remains:

  ```text
  http://localhost:4000/api/connected-accounts/oauth/google/callback
  ```

- Production callback pattern remains:

  ```text
  https://api.salesflowsai.com/api/connected-accounts/oauth/google/callback
  ```

- Production frontend success redirect remains:

  ```text
  https://www.salesflowsai.com/dashboard/settings/connected-accounts?connected=google
  https://www.salesflowsai.com/dashboard/settings/connected-accounts?reconnected=google
  ```

## Token Encryption QA

- `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY` decodes to exactly 32 bytes.
- The same key and version are stable across API restarts and deployments.
- Losing/changing the key makes stored Google tokens undecryptable.
- Rotating the key requires a planned re-encryption process or user reconnect flow.
- Keep old key material available until all tokens using the old version are migrated or reconnected.

## OAuth State QA

- Starting OAuth creates a pending state tied to organization/user/provider.
- Starting a second flow cancels prior pending states for the same organization/user/provider.
- Callback rejects missing state, invalid state, expired state, reused state, inactive user, deleted org, suspended org, and cancelled org.
- Successful callback marks state as used and creates one connected account for the user, or reuses the user's existing disconnected Google connected account record during reconnect.
- The raw state value is never stored; only the hash is stored.

## Reconnect and Disconnect QA

Run in staging with test users:

1. Connect Google from Settings > Connected Accounts.
2. Confirm connected account status is `CONNECTED`.
3. Request disconnect as the connected user.
4. Confirm status becomes `DISCONNECT_REQUESTED`.
5. Disconnect as OWNER/ADMIN/SUPER_ADMIN.
6. Confirm tokens are cleared and sync states pause.
7. Reconnect after disconnect.
8. Confirm account connects again, sync states initialize, and no duplicate connected account row is created.

## Token Refresh QA

1. Connect a staging Google account.
2. Let or force the access token near expiry.
3. Run manual Gmail sync.
4. Run manual Calendar sync.
5. Confirm access token refresh succeeds.
6. Confirm encrypted access token and expiry update.
7. Confirm refresh failure surfaces a reconnect-needed error without printing token values.

## Staging Validation Checklist

- Open frontend.
- Login as a staging user.
- Start Google OAuth.
- Complete consent with a Google test account.
- Confirm callback redirects to connected accounts settings.
- Confirm connected status is visible.
- Run manual Gmail sync.
- Run manual Calendar sync.
- Generate AI suggestions only if explicitly testing AI.
- Confirm no email is sent automatically.
- Confirm no Gmail draft is created automatically.
- Confirm no CRM record is created automatically.
- Request disconnect/admin disconnect if safe.
- Reconnect account.

## Production Rollout Checklist

- Google OAuth consent screen configured and verified as required.
- Google OAuth app domain fields configured:
  - Home: `https://www.salesflowsai.com`
  - Privacy: `https://www.salesflowsai.com/privacy`
  - Terms: `https://www.salesflowsai.com/terms`
- Authorized redirect URI exactly matches `GOOGLE_OAUTH_REDIRECT_URI`.
- Secret manager stores client secret and token encryption key.
- Production API has stable `CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY`.
- Production frontend URL is set in `FRONTEND_URL`.
- `CORS_ORIGIN` uses exact origins only.
- Staging OAuth smoke test passed.
- Reconnect/disconnect QA passed.
- Token refresh QA passed.
- Support and privacy documentation are published.
- Monitoring watches OAuth callback failures, token refresh failures, sync failures, and 429 spikes.
