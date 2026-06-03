import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      id: 'plan_free',
      name: '免费试用',
      tier: 'FREE' as const,
      priceMonthly: 0,
      priceYearly: 0,
      features: {
        text_chats: -1,
        image_gens: 10,
        video_gens: 3,
        support: false,
      },
      quotaLimits: {
        text_chats: -1,
        image_gens: 10,
        video_gens: 3,
      },
    },
    {
      id: 'plan_basic',
      name: '基础版',
      tier: 'BASIC' as const,
      priceMonthly: 2900,
      priceYearly: 29000,
      features: {
        text_chats: -1,
        image_gens: 100,
        video_gens: 20,
        support: true,
      },
      quotaLimits: {
        text_chats: -1,
        image_gens: 100,
        video_gens: 20,
      },
    },
    {
      id: 'plan_pro',
      name: '专业版',
      tier: 'PRO' as const,
      priceMonthly: 9900,
      priceYearly: 99000,
      features: {
        text_chats: -1,
        image_gens: 500,
        video_gens: 100,
        support: true,
        priority: true,
      },
      quotaLimits: {
        text_chats: -1,
        image_gens: 500,
        video_gens: 100,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {},
      create: plan,
    });
  }

  console.log('Seeded subscription plans:', plans.map((p) => p.name).join(', '));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
