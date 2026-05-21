import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const envPath = resolve(rootDir, '.env');
const databaseDir = resolve(rootDir, 'packages/database');

function parseEnvValue(value) {
  let parsedValue = value.trim();

  if (
    (parsedValue.startsWith('"') && parsedValue.endsWith('"')) ||
    (parsedValue.startsWith("'") && parsedValue.endsWith("'"))
  ) {
    parsedValue = parsedValue.slice(1, -1);
  }

  return parsedValue;
}

function loadEnvFile() {
  if (!existsSync(envPath)) {
    console.warn('Root .env file was not found. Using existing process.env only.');
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = parseEnvValue(trimmedLine.slice(separatorIndex + 1));

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

if (process.env.DATABASE_URL_HOST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_HOST;
}

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is missing. Add DATABASE_URL_HOST or DATABASE_URL to the root .env file.',
  );
  process.exit(1);
}

if (!existsSync(databaseDir)) {
  console.error(`Database package directory not found: ${databaseDir}`);
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);

if (prismaArgs.length === 0) {
  console.error('Missing Prisma command.');
  console.error('Examples:');
  console.error('  pnpm db:generate');
  console.error('  pnpm db:migrate -- --name migration_name');
  console.error('  pnpm db:studio');
  process.exit(1);
}

console.log(`Running Prisma in: ${databaseDir}`);
console.log(
  `DATABASE_URL source: ${
    process.env.DATABASE_URL_HOST ? 'DATABASE_URL_HOST' : 'DATABASE_URL'
  }`,
);

const command = 'pnpm';

const result = spawnSync(command, ['exec', 'prisma', ...prismaArgs], {
  cwd: databaseDir,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('Failed to execute Prisma command.');
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);