import { api } from './api'
import type {
  SubscriptionPlan,
  Subscription,
  Bill,
  QuotaInfo,
  ApiResponse,
  PageResult,
} from '@/types'

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const res = await api.get<ApiResponse<SubscriptionPlan[]>>('/subscription-plans')
  return res.data.data
}

export async function getCurrentSubscription(): Promise<Subscription> {
  const res = await api.get<ApiResponse<Subscription>>('/subscriptions/current')
  return res.data.data
}

export async function createSubscription(planId: string, period: 'monthly' | 'yearly'): Promise<{ subscription: Subscription; payment: { gateway_url?: string; params?: Record<string, unknown> } }> {
  const res = await api.post<ApiResponse<{ subscription: Subscription; payment: { gateway_url?: string; params?: Record<string, unknown> } }>>('/subscriptions', { plan_id: planId, period })
  return res.data.data
}

export async function downgradeSubscription(planId: string): Promise<Subscription> {
  const res = await api.post<ApiResponse<Subscription>>('/subscriptions/downgrade', { plan_id: planId })
  return res.data.data
}

export async function cancelSubscription(): Promise<Subscription> {
  const res = await api.post<ApiResponse<Subscription>>('/subscriptions/cancel')
  return res.data.data
}

export async function getBills(params?: { page?: number; limit?: number }): Promise<PageResult<Bill>> {
  const res = await api.get<ApiResponse<PageResult<Bill>>>('/subscriptions/bills', { params })
  return res.data.data
}

export async function getQuota(): Promise<QuotaInfo> {
  const res = await api.get<ApiResponse<QuotaInfo>>('/quota')
  return res.data.data
}
