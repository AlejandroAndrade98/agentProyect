import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const devPasswordHash =
  '$2b$10$obBeNp05FSzijxOIYQzyz.uZTpvnQ9pgCtdpfCuZVa1pCHHmNncGu';

async function main() {
  console.log('🌱 Starting seed process...');

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {
      name: 'Demo Organization',
      industry: 'Advertising / Media',
      plan: 'FREE',
      accountType: 'INDIVIDUAL',
      status: 'TRIAL',
      statusReason: 'Demo workspace for local development',
      billingEmail: 'billing@example.com',
      supportEmail: 'support@example.com',
      timezone: 'America/Bogota',
      locale: 'en',
      maxUsers: 5,
      maxActiveLeads: 100,
      aiEnabled: true,
      aiMonthlyCreditsLimit: 5000000,
      aiDefaultUserMonthlyCreditsLimit: 1000000,
      aiCreditsBalance: 5000000,
      aiCreditsUpdatedAt: new Date(),
      deletedAt: null,
    },
    create: {
      name: 'Demo Organization',
      slug: 'demo',
      industry: 'Advertising / Media',
      plan: 'FREE',
      accountType: 'INDIVIDUAL',
      status: 'TRIAL',
      statusReason: 'Demo workspace for local development',
      billingEmail: 'billing@example.com',
      supportEmail: 'support@example.com',
      timezone: 'America/Bogota',
      locale: 'en',
      maxUsers: 5,
      maxActiveLeads: 100,
      aiEnabled: true,
      aiMonthlyCreditsLimit: 5000000,
      aiDefaultUserMonthlyCreditsLimit: 1000000,
      aiCreditsBalance: 5000000,
      aiCreditsUpdatedAt: new Date(),
    },
  });

  console.log('✅ Demo organization seeded: %s', organization.name);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {
      name: 'Demo Owner',
      passwordHash: devPasswordHash,
      role: 'OWNER',
      isActive: true,
      organizationId: organization.id,
    },
    create: {
      email: 'owner@example.com',
      name: 'Demo Owner',
      passwordHash: devPasswordHash,
      role: 'OWNER',
      isActive: true,
      organizationId: organization.id,
    },
  });

  console.log('✅ Demo owner seeded: %s', owner.email);

  const platformOrganization = await prisma.organization.upsert({
    where: {
      slug: 'sales-ai-platform-admin',
    },
    update: {
      name: 'Sales AI Platform Admin',
      industry: 'Software / SaaS',
      plan: 'INTERNAL',
      accountType: 'COMPANY',
      status: 'ACTIVE',
      statusReason: 'Internal platform administration workspace',
      billingEmail: 'alejandro21112@hotmail.com',
      supportEmail: 'alejandro21112@hotmail.com',
      timezone: 'America/Bogota',
      locale: 'en',
      maxUsers: 5,
      maxActiveLeads: 100,
      aiEnabled: true,
      aiMonthlyCreditsLimit: 5000000,
      aiDefaultUserMonthlyCreditsLimit: 1000000,
      aiCreditsBalance: 5000000,
      aiCreditsUpdatedAt: new Date(),
      activatedAt: new Date(),
      suspendedAt: null,
      cancelledAt: null,
      deletedAt: null,
    },
    create: {
      name: 'Sales AI Platform Admin',
      slug: 'sales-ai-platform-admin',
      industry: 'Software / SaaS',
      plan: 'INTERNAL',
      accountType: 'COMPANY',
      status: 'ACTIVE',
      statusReason: 'Internal platform administration workspace',
      billingEmail: 'alejandro21112@hotmail.com',
      supportEmail: 'alejandro21112@hotmail.com',
      timezone: 'America/Bogota',
      locale: 'en',
      maxUsers: 5,
      maxActiveLeads: 100,
      aiEnabled: true,
      aiMonthlyCreditsLimit: 5000000,
      aiDefaultUserMonthlyCreditsLimit: 1000000,
      aiCreditsBalance: 5000000,
      aiCreditsUpdatedAt: new Date(),
      activatedAt: new Date(),
    },
  });

  console.log(
    '✅ Platform organization seeded: %s',
    platformOrganization.name,
  );

  const superAdmin = await prisma.user.upsert({
    where: {
      email: 'alejandro21112@hotmail.com',
    },
    update: {
      name: 'Alejandro Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      organizationId: platformOrganization.id,
      passwordHash: devPasswordHash,
    },
    create: {
      email: 'alejandro21112@hotmail.com',
      name: 'Alejandro Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      organizationId: platformOrganization.id,
      passwordHash: devPasswordHash,
    },
  });

  console.log('✅ Super admin seeded: %s', superAdmin.email);

  const products = [
    {
      name: 'Cabify Ads',
      description: 'Ride-hailing targeted advertising',
      category: 'Mobile',
    },
    {
      name: 'Programmatic Ads',
      description: 'Automated ad buying across multiple channels',
      category: 'Digital',
    },
    {
      name: 'DOOH',
      description: 'Digital Out-Of-Home signage',
      category: 'Physical',
    },
    {
      name: 'Connected TV',
      description: 'Targeted streaming TV advertisements',
      category: 'Digital',
    },
  ];

  for (const product of products) {
    const existing = await prisma.product.findFirst({
      where: {
        name: product.name,
        organizationId: organization.id,
      },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description: product.description,
          category: product.category,
          isActive: true,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          category: product.category,
          isActive: true,
          organizationId: organization.id,
        },
      });
    }
  }

  console.log('✅ Products seeded');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('🌱 Seed process completed successfully');
  })
  .catch(async (error) => {
    console.error('❌ Seed process failed:');
    console.error(error);
    await prisma.$disconnect();
    throw error;
  });