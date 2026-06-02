import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const rootDir = process.cwd();
const envPath = resolve(rootDir, '.env');
const apiRequire = createRequire(resolve(rootDir, 'apps/api/package.json'));
const databaseRequire = createRequire(
  resolve(rootDir, 'packages/database/package.json'),
);
const bcrypt = apiRequire('bcrypt');
const {
  PrismaClient,
  OrganizationAccountType,
  OrganizationStatus,
  Role,
} = databaseRequire('@prisma/client');
let prisma;

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

function loadLocalEnvFile() {
  if (!existsSync(envPath)) {
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

function isEnabled(value) {
  return value?.toLowerCase() === 'true';
}

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password.length >= 8;
}

function normalizeRole(value) {
  const role = (value || Role.OWNER).trim().toUpperCase();
  const allowedRoles = new Set([Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN]);

  if (!allowedRoles.has(role)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_ROLE must be OWNER, ADMIN, or SUPER_ADMIN.',
    );
  }

  return role;
}

function slugify(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'staging-organization';
}

async function buildUniqueOrganizationSlug(baseName) {
  const baseSlug = slugify(baseName);
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await prisma.organization.findUnique({
      where: {
        slug: candidate,
      },
      select: {
        id: true,
      },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function main() {
  loadLocalEnvFile();

  if (!isEnabled(process.env.BOOTSTRAP_ADMIN_ENABLED)) {
    throw new Error('Refusing to run: BOOTSTRAP_ADMIN_ENABLED must be true.');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  if (process.env.DATABASE_URL_HOST) {
    console.warn(
      'DATABASE_URL_HOST is set. This bootstrap script uses DATABASE_URL and ignores DATABASE_URL_HOST.',
    );
  }

  prisma = new PrismaClient();

  const email = normalizeEmail(requireEnv('BOOTSTRAP_ADMIN_EMAIL'));
  const password = requireEnv('BOOTSTRAP_ADMIN_PASSWORD');
  const name = requireEnv('BOOTSTRAP_ADMIN_NAME');
  const organizationName = requireEnv('BOOTSTRAP_ORGANIZATION_NAME');
  const role = normalizeRole(process.env.BOOTSTRAP_ADMIN_ROLE);
  const allowExistingUsers = isEnabled(process.env.BOOTSTRAP_ALLOW_EXISTING_USERS);
  const updateExistingPassword = isEnabled(
    process.env.BOOTSTRAP_UPDATE_EXISTING_PASSWORD,
  );

  if (!validateEmail(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
  }

  if (!validatePassword(password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters long.',
    );
  }

  const [existingUser, userCount] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.user.count(),
  ]);

  if (existingUser) {
    if (!updateExistingPassword) {
      console.log('Bootstrap admin already exists. No changes made.');
      console.log(`Email: ${existingUser.email}`);
      console.log(`Role: ${existingUser.role}`);
      console.log(
        `Organization: ${existingUser.organization.name} (${existingUser.organization.id})`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: {
        id: existingUser.id,
      },
      data: {
        passwordHash,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log('Bootstrap admin password updated.');
    console.log(`Email: ${updatedUser.email}`);
    console.log(`Role: ${updatedUser.role}`);
    console.log(
      `Organization: ${updatedUser.organization.name} (${updatedUser.organization.id})`,
    );
    return;
  }

  if (userCount > 0 && !allowExistingUsers) {
    throw new Error(
      'Refusing to create a bootstrap admin because users already exist. Set BOOTSTRAP_ALLOW_EXISTING_USERS=true only if this is intentional.',
    );
  }

  const organizationSlug = await buildUniqueOrganizationSlug(organizationName);
  const passwordHash = await bcrypt.hash(password, 10);

  const createdUser = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug: organizationSlug,
        accountType: OrganizationAccountType.COMPANY,
        status: OrganizationStatus.TRIAL,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        organizationId: organization.id,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  console.log('Bootstrap admin created.');
  console.log(`Email: ${createdUser.email}`);
  console.log(`Role: ${createdUser.role}`);
  console.log(
    `Organization: ${createdUser.organization.name} (${createdUser.organization.id})`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
}
