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
  "start:api",
  "start:web",
  "start:worker",
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
  "packages/database/prisma/schema.prisma",
  "apps/api/src/main.ts",
  "apps/api/src/app.module.ts",
  "apps/web/src/app/layout.tsx",
  "apps/web/src/app/(auth)/login/page.tsx",
  "apps/web/src/components/LoginForm.tsx",
  "apps/web/src/app/accept-invitation/[token]/page.tsx",
  "apps/web/src/app/dashboard/page.tsx",
  "apps/web/src/app/dashboard/ai-suggestions/[id]/page.tsx",
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
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY",
  "CONNECTED_ACCOUNT_TOKEN_ENCRYPTION_KEY_VERSION",
  "AI_PROVIDER",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
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
]) {
  if (!deploymentChecklist.includes(expectedText)) {
    fail(`Deployment checklist missing command: ${expectedText}`);
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
