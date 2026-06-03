import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SubscriptionStatus, PlanTier, Prisma } from '@prisma/client';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { DowngradeSubscriptionDto } from './dto/downgrade-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      features: plan.features as Record<string, unknown>,
      quotaLimits: plan.quotaLimits as Record<string, number>,
    }));
  }

  async findCurrentSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return null;
    }

    return this.mapSubscription(subscription);
  }

  async createSubscription(userId: string, dto: CreateSubscriptionDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (dto.period === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const quotaLimits = (plan.quotaLimits as Record<string, number>) ?? {};
    const usageQuota =
      Object.values(quotaLimits).find((v) => typeof v === 'number' && v > 0) ??
      0;

    // Upsert: if user has an active subscription, update it; otherwise create
    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    let subscription;
    if (existing) {
      subscription = await this.prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          usageQuota,
          usageConsumed: 0,
          cancelAtPeriodEnd: false,
          status: SubscriptionStatus.ACTIVE,
        },
        include: { plan: true },
      });
    } else {
      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          planId: plan.id,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          usageQuota,
          usageConsumed: 0,
          status: SubscriptionStatus.ACTIVE,
        },
        include: { plan: true },
      });
    }

    // Create a bill record for this transaction
    await this.prisma.bill.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        amount: dto.period === 'yearly' ? plan.priceYearly : plan.priceMonthly,
        currency: 'CNY',
        status: 'PENDING',
        periodStart: now,
        periodEnd: periodEnd,
      },
    });

    return {
      subscription: this.mapSubscription(subscription),
      payment: {
        gatewayUrl: 'https://mock-payment-gateway.example.com/pay',
        params: {
          orderId: subscription.id,
          amount: dto.period === 'yearly' ? plan.priceYearly : plan.priceMonthly,
          currency: 'CNY',
        },
      },
    };
  }

  async downgradeSubscription(userId: string, dto: DowngradeSubscriptionDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const currentTierRank = this.tierRank(subscription.plan.tier);
    const targetTierRank = this.tierRank(plan.tier);

    if (targetTierRank >= currentTierRank) {
      throw new BadRequestException('Target plan is not a downgrade');
    }

    const quotaLimits = (plan.quotaLimits as Record<string, number>) ?? {};
    const usageQuota =
      Object.values(quotaLimits).find((v) => typeof v === 'number' && v > 0) ??
      0;

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: plan.id,
        usageQuota,
        cancelAtPeriodEnd: false,
      },
      include: { plan: true },
    });

    return this.mapSubscription(updated);
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
      },
      include: { plan: true },
    });

    return this.mapSubscription(updated);
  }

  async findBills(
    userId: string,
    page: number,
    limit: number,
  ) {
    const where: Prisma.BillWhereInput = { userId };

    const [data, total] = await Promise.all([
      this.prisma.bill.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bill.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getQuota(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const defaultQuota = { text_chats: -1, image_gens: 0, video_gens: 0 };
    const defaultUsage = { text_chats: 0, image_gens: 0, video_gens: 0 };

    if (!subscription) {
      // Return FREE plan limits as default quota
      const freePlan = await this.prisma.subscriptionPlan.findFirst({
        where: { tier: PlanTier.FREE },
      });

      const quota = freePlan
        ? ((freePlan.quotaLimits as Record<string, number>) ?? defaultQuota)
        : defaultQuota;

      return {
        quota,
        usage: defaultUsage,
        resetAt: this.getMonthEnd(),
      };
    }

    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;

    const quotaLimits =
      (subscription.plan.quotaLimits as Record<string, number>) ?? defaultQuota;

    const [textChats, imageGens, videoGens] = await Promise.all([
      this.prisma.message.count({
        where: {
          session: { userId },
          type: 'TEXT',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      this.prisma.generationTask.count({
        where: {
          userId,
          type: 'IMAGE',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      this.prisma.generationTask.count({
        where: {
          userId,
          type: 'VIDEO',
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
    ]);

    return {
      quota: {
        text_chats: quotaLimits.text_chats ?? -1,
        image_gens: quotaLimits.image_gens ?? 0,
        video_gens: quotaLimits.video_gens ?? 0,
      },
      usage: {
        text_chats: textChats,
        image_gens: imageGens,
        video_gens: videoGens,
      },
      resetAt: periodEnd.toISOString(),
    };
  }

  private mapSubscription(
    subscription: Prisma.SubscriptionGetPayload<{
      include: { plan: true };
    }>,
  ) {
    return {
      id: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      usageQuota: subscription.usageQuota,
      usageConsumed: subscription.usageConsumed,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        tier: subscription.plan.tier,
        priceMonthly: subscription.plan.priceMonthly,
        priceYearly: subscription.plan.priceYearly,
        features: subscription.plan.features as Record<string, unknown>,
        quotaLimits: subscription.plan.quotaLimits as Record<string, number>,
      },
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  private tierRank(tier: PlanTier): number {
    const ranks: Record<PlanTier, number> = {
      FREE: 0,
      BASIC: 1,
      PRO: 2,
    };
    return ranks[tier] ?? 0;
  }

  private getMonthEnd(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  }
}
