import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SubscriptionStatus, GenerationType } from '@prisma/client';

export interface QuotaCheckResult {
  subscription: {
    id: string;
    usageQuota: number;
    usageConsumed: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  };
  plan: {
    id: string;
    name: string;
    quotaLimits: Record<string, number>;
  };
}

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async checkUserQuota(userId: string): Promise<QuotaCheckResult> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gte: new Date() },
      },
      include: { plan: true },
    });

    if (!subscription) {
      throw new HttpException(
        'No active subscription found',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (subscription.usageConsumed >= subscription.usageQuota) {
      throw new HttpException(
        'Usage quota exceeded',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const quotaLimits =
      (subscription.plan.quotaLimits as Record<string, number>) ?? {};

    return {
      subscription: {
        id: subscription.id,
        usageQuota: subscription.usageQuota,
        usageConsumed: subscription.usageConsumed,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        quotaLimits,
      },
    };
  }

  async checkGenerationQuota(
    userId: string,
    type: GenerationType,
  ): Promise<QuotaCheckResult> {
    const result = await this.checkUserQuota(userId);

    // Check type-specific quota from plan limits
    const quotaKey =
      type === GenerationType.IMAGE ? 'image_gens' : 'video_gens';
    const typeLimit = result.plan.quotaLimits[quotaKey];

    if (typeLimit !== undefined && typeLimit >= 0) {
      const typeUsage = await this.prisma.generationTask.count({
        where: {
          userId,
          type,
          createdAt: {
            gte: result.subscription.currentPeriodStart,
            lte: result.subscription.currentPeriodEnd,
          },
        },
      });

      if (typeUsage >= typeLimit) {
        throw new HttpException(
          `Your ${type.toLowerCase()} generation quota for this period has been exceeded`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    return result;
  }

  async incrementUsage(subscriptionId: string, amount = 1): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        usageConsumed: { increment: amount },
      },
    });
  }
}
