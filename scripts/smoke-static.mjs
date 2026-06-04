import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function requireFile(relativePath) {
  if (!existsSync(join(root, relativePath))) {
    fail(`Missing required file: ${relativePath}`);
  }
}

function requireJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    fail(`Invalid JSON in ${relativePath}: ${error.message}`);
    return {};
  }
}

const packageJson = requireJson("package.json");
const requiredScripts = [
  "build",
  "db:validate",
  "check:generated",
  "smoke:static",
  "smoke:runtime",
  "start:api",
  "start:web",
  "start:worker",
  "bootstrap:staging-admin",
];

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    fail(`Missing package script: ${scriptName}`);
  }
}

const requiredFiles = [
  ".env.example",
  "docs/production-readiness-audit.md",
  "docs/deployment-checklist.md",
  "docs/env-production-checklist.md",
  "docs/security-hardening.md",
  "docs/google-oauth-production-checklist.md",
  "docs/observability-runbook.md",
  "docs/staging-runtime-smoke-tests.md",
  "docs/backup-restore-runbook.md",
  "docs/private-beta-deployment-plan.md",
  "docs/staging-provider-checklist.md",
  "docs/staging-env-template.md",
  "scripts/smoke-runtime.mjs",
  "scripts/bootstrap-staging-admin.mjs",
  "packages/database/prisma/schema.prisma",
  "packages/database/prisma/migrations/20260601000000_add_password_reset_tokens/migration.sql",
  "apps/api/src/main.ts",
  "apps/api/src/app.module.ts",
  "apps/api/src/email/email.module.ts",
  "apps/api/src/email/email.service.ts",
  "apps/api/src/email/email.types.ts",
  "apps/web/src/app/layout.tsx",
  "apps/web/src/app/privacy/page.tsx",
  "apps/web/src/app/terms/page.tsx",
  "apps/web/src/app/(auth)/login/page.tsx",
  "apps/web/src/app/(auth)/forgot-password/page.tsx",
  "apps/web/src/app/(auth)/reset-password/page.tsx",
  "apps/web/src/components/LoginForm.tsx",
  "apps/web/src/components/ForgotPasswordForm.tsx",
  "apps/web/src/components/ResetPasswordForm.tsx",
  "apps/web/src/components/PublicLegalLinks.tsx",
  "apps/web/src/app/accept-invitation/[token]/page.tsx",
  "apps/web/src/app/dashboard/page.tsx",
  "apps/web/src/app/dashboard/ai-suggestions/[id]/page.tsx",
  "apps/web/src/app/dashboard/settings/connected-accounts/page.tsx",
  "apps/web/src/components/AiGuardrailsNotice.tsx",
  "apps/web/src/i18n/locales/en.json",
  "apps/web/src/i18n/locales/es.json",
];

for (const relativePath of requiredFiles) {
  requireFile(relativePath);
}

const envExample = readText(".env.example");
const requiredEnvKeys = [
  "NODE_ENV",
  "API_PORT",
  "REQUEST_BODY_LIMIT",
  "NEXT_PUBLIC_API_URL",
  "DATABASE_URL",
  "DATABASE_URL_HOST",
  "REDIS_URL",
  "CORS_ORIGIN",
  "LOG_LEVEL",
  "REQUEST_LOGGING_ENABLED",
  "LOG_FORMAT",
  "LOG_REDACT_SENSITIVE",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "AUTH_RECOVERY_DEV_MODE",
  "AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES",
  "PASSWORD_RESET_PUBLIC_URL",
  "EMAIL_PROVIDER",
  "EMAIL_DELIVERY_ENABLED",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_APP_NAME",
  "EMAIL_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY",
  "CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION",
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "BOOTSTRAP_ADMIN_ENABLED",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ORGANIZATION_NAME",
  "BOOTSTRAP_ADMIN_ROLE",
  "BOOTSTRAP_ALLOW_EXISTING_USERS",
  "BOOTSTRAP_UPDATE_EXISTING_PASSWORD",
];

for (const envKey of requiredEnvKeys) {
  const pattern = new RegExp(`^${envKey}=`, "m");
  if (!pattern.test(envExample)) {
    fail(`Missing .env.example key: ${envKey}`);
  }
}

for (const documentedAlias of [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
]) {
  if (!envExample.includes(documentedAlias)) {
    fail(`Missing .env.example documented alias: ${documentedAlias}`);
  }
}

const en = requireJson("apps/web/src/i18n/locales/en.json");
const es = requireJson("apps/web/src/i18n/locales/es.json");
const loginForm = readText("apps/web/src/components/LoginForm.tsx");
const privacyPage = readText("apps/web/src/app/privacy/page.tsx");
const termsPage = readText("apps/web/src/app/terms/page.tsx");
const publicLegalLinks = readText("apps/web/src/components/PublicLegalLinks.tsx");

if (loginForm.includes("owner@example.com")) {
  fail("LoginForm must not contain demo owner credentials.");
}

for (const expectedText of [
  "Google API Services User Data Policy",
  "Limited Use requirements",
  "OAuth tokens are encrypted at rest",
  "does not send emails automatically",
]) {
  if (!privacyPage.includes(expectedText)) {
    fail(`Privacy page missing Google/OAuth privacy marker: ${expectedText}`);
  }
}

for (const expectedText of [
  "AI-Generated Suggestions",
  "Human Review Requirement",
  "does not send emails automatically",
  "Terms of Service",
]) {
  if (!termsPage.includes(expectedText)) {
    fail(`Terms page missing beta/AI terms marker: ${expectedText}`);
  }
}

for (const expectedText of ["/privacy", "/terms"]) {
  if (!publicLegalLinks.includes(expectedText)) {
    fail(`Public legal links missing route: ${expectedText}`);
  }
}

const importantI18nNamespaces = [
  "common",
  "navigation",
  "dashboard",
  "aiWorkspace",
  "aiSuggestions",
  "syncedEmails",
  "syncedCalendar",
  "settings",
  "auth",
  "platform",
];

for (const namespace of importantI18nNamespaces) {
  if (!en[namespace]) {
    fail(`Missing English i18n namespace: ${namespace}`);
  }
  if (!es[namespace]) {
    fail(`Missing Spanish i18n namespace: ${namespace}`);
  }
}

const deploymentChecklist = readText("docs/deployment-checklist.md");
for (const expectedText of [
  "corepack pnpm db:validate",
  "corepack pnpm --filter @sales-ai/web exec tsc --noEmit",
  "corepack pnpm --filter @sales-ai/api build",
  "corepack pnpm build",
  "google-oauth-production-checklist.md",
  "observability-runbook.md",
  "staging-runtime-smoke-tests.md",
  "backup-restore-runbook.md",
  "private-beta-deployment-plan.md",
  "staging-provider-checklist.md",
  "staging-env-template.md",
  "corepack pnpm smoke:runtime",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
]) {
  if (!deploymentChecklist.includes(expectedText)) {
    fail(`Deployment checklist missing command: ${expectedText}`);
  }
}

const securityHardening = readText("docs/security-hardening.md").toLowerCase();
for (const expectedText of [
  "transactional email delivery",
  "resend",
  "email.invitation.send.success",
  "email.password_reset.send.success",
  "technical metadata available but collapsed by default",
  "applying crm actions requires an explicit user click",
  "google connected account reconnect",
  "reuses the existing tenant-scoped connected account record",
]) {
  if (!securityHardening.includes(expectedText)) {
    fail(`Security hardening docs missing transactional email reference: ${expectedText}`);
  }
}

const aiSuggestionDetailPage = readText("apps/web/src/app/dashboard/ai-suggestions/[id]/page.tsx");
for (const expectedText of [
  "AiAdvancedMetadataSection",
  "recommendedActionLabel",
  "applyToCrm",
]) {
  if (!aiSuggestionDetailPage.includes(expectedText)) {
    fail(`AI suggestion detail page missing UX marker: ${expectedText}`);
  }
}

const connectedAccountsPage = readText("apps/web/src/app/dashboard/settings/connected-accounts/page.tsx");
for (const expectedText of [
  "canReconnectGoogle",
  "reconnected",
  "reconnectGoogle",
]) {
  if (!connectedAccountsPage.includes(expectedText)) {
    fail(`Connected accounts page missing reconnect marker: ${expectedText}`);
  }
}

for (const [localeName, locale] of [
  ["English", en],
  ["Spanish", es],
]) {
  const connectedAccounts = locale.settings?.connectedAccounts ?? {};
  for (const expectedKey of [
    "googleReconnected",
    "reconnectGoogle",
    "reconnectGoogleDescription",
  ]) {
    if (!connectedAccounts[expectedKey]) {
      fail(`${localeName} locale missing connected account reconnect key: ${expectedKey}`);
    }
  }

  const guardrails = locale.common?.guardrails ?? {};
  for (const expectedKey of [
    "title",
    "summary",
    "viewRules",
    "hideRules",
    "workspaceDescription",
    "aiSuggestionsDescription",
    "syncedEmailsDescription",
    "syncedCalendarDescription",
  ]) {
    if (!guardrails[expectedKey]) {
      fail(`${localeName} locale missing guardrails key: ${expectedKey}`);
    }
  }

  const safety = locale.common?.safety ?? {};
  for (const expectedKey of [
    "humanReviewRequired",
    "noAutomaticEmailSending",
    "noAutomaticCrmRecords",
    "explicitActionRequired",
  ]) {
    if (!safety[expectedKey]) {
      fail(`${localeName} locale missing safety key: ${expectedKey}`);
    }
  }

  const detail = locale.aiSuggestions?.detail ?? {};
  for (const expectedKey of [
    "technicalDetails",
    "emailContext",
    "viewSafetyDetails",
    "noAutomaticChangesApplied",
  ]) {
    if (!detail[expectedKey]) {
      fail(`${localeName} locale missing AI detail UX key: ${expectedKey}`);
    }
  }
}

const productionReadinessAudit = readText("docs/production-readiness-audit.md");
for (const expectedText of [
  "backup and restore runbook",
  "restore drill",
  "private beta deployment plan",
]) {
  if (!productionReadinessAudit.toLowerCase().includes(expectedText)) {
    fail(`Production readiness audit missing deployment readiness reference: ${expectedText}`);
  }
}

if (failures.length > 0) {
  console.error("Static smoke checks failed:");
  for (const message of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("Static smoke checks passed.");
