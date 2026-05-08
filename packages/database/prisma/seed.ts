import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed process...');

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {
      name: 'Demo Organization',
      industry: 'Advertising / Media',
      plan: 'FREE',
      maxUsers: 5,
      maxActiveLeads: 100,
      maxAiRequestsPerMonth: 50,
      maxStorageMb: 100,
    },
    create: {
      name: 'Demo Organization',
      slug: 'demo',
      industry: 'Advertising / Media',
      plan: 'FREE',
      maxUsers: 5,
      maxActiveLeads: 100,
      maxAiRequestsPerMonth: 50,
      maxStorageMb: 100,
    },
  });

  console.log('✅ Organization seeded: %s', organization.name);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {
      name: 'Demo Owner',
      passwordHash: '$2b$10$obBeNp05FSzijxOIYQzyz.uZTpvnQ9pgCtdpfCuZVa1pCHHmNncGu',
      role: 'OWNER',
      isActive: true,
      organizationId: organization.id,
    },
    create: {
      email: 'owner@example.com',
      name: 'Demo Owner',
      passwordHash: '$2b$10$obBeNp05FSzijxOIYQzyz.uZTpvnQ9pgCtdpfCuZVa1pCHHmNncGu',
      role: 'OWNER',
      isActive: true,
      organizationId: organization.id,
    },
  });

  console.log('✅ User Owner seeded: %s', owner.email);

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
    process.exit(1);
  });
