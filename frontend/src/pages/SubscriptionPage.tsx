import { useState, useEffect } from 'react'
import {
  getSubscriptionPlans,
  getCurrentSubscription,
  getQuota,
  getBills,
  createSubscription,
  cancelSubscription,
} from '@/services/subscriptions'
import type { SubscriptionPlan, Subscription, QuotaInfo, Bill } from '@/types'
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Image,
  Video,
  MessageSquare,
} from 'lucide-react'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function formatAmount(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

function QuotaBar({
  label,
  used,
  total,
  icon: Icon,
}: {
  label: string
  used: number
  total: number
  icon: React.ElementType
}) {
  const unlimited = total === -1
  const percent = unlimited ? 0 : total > 0 ? Math.min((used / total) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <span className="font-medium text-foreground">
          {unlimited ? '无限' : `${used} / ${total}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              percent >= 90 ? 'bg-destructive' : percent >= 70 ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'plans' | 'bills'>('plans')

  const loadData = async () => {
    setIsLoading(true)
    setError('')
    try {
      const [plansData, subData, quotaData, billsData] = await Promise.all([
        getSubscriptionPlans(),
        getCurrentSubscription().catch(() => null),
        getQuota().catch(() => null),
        getBills({ limit: 10 }).catch(() => ({ items: [], total: 0, page: 1, pageSize: 10 })),
      ])
      setPlans(plansData)
      setSubscription(subData)
      setQuota(quotaData)
      setBills(billsData.items)
    } catch {
      setError('加载数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadData())
  }, [])

  const handleSubscribe = async (planId: string, period: 'monthly' | 'yearly') => {
    setIsPaying(true)
    setError('')
    try {
      const result = await createSubscription(planId, period)
      if (result.payment.gateway_url) {
        const url = result.payment.gateway_url
        setTimeout(() => {
          window.location.assign(url)
        }, 0)
      } else {
        setSubscription(result.subscription)
        // reload quota
        const q = await getQuota().catch(() => null)
        if (q) setQuota(q)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || '订阅失败')
    } finally {
      setIsPaying(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('确定取消订阅吗？当前周期结束后将不再续费。')) return
    setError('')
    try {
      const updated = await cancelSubscription()
      setSubscription(updated)
    } catch {
      setError('取消订阅失败')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-foreground">订阅与额度</h1>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Current Subscription Card */}
      {subscription && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {subscription.plan?.name || '未知计划'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  有效期至 {formatDate(subscription.current_period_end)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {subscription.status === 'ACTIVE' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  生效中
                </span>
              ) : subscription.status === 'CANCELLED' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <XCircle className="h-3 w-3" />
                  已取消
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  已过期
                </span>
              )}
            </div>
          </div>

          {quota && (
            <div className="grid gap-4 sm:grid-cols-3">
              <QuotaBar
                label="文本对话"
                used={quota.usage.text_chats}
                total={quota.quota.text_chats}
                icon={MessageSquare}
              />
              <QuotaBar
                label="图片生成"
                used={quota.usage.image_gens}
                total={quota.quota.image_gens}
                icon={Image}
              />
              <QuotaBar
                label="视频生成"
                used={quota.usage.video_gens}
                total={quota.quota.video_gens}
                icon={Video}
              />
            </div>
          )}

          {subscription.status === 'ACTIVE' && !subscription.cancel_at_period_end && (
            <button
              onClick={handleCancel}
              className="text-sm text-destructive hover:underline"
            >
              取消订阅
            </button>
          )}
          {subscription.cancel_at_period_end && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              已设置取消，当前周期结束后失效
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'plans'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          订阅计划
        </button>
        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'bills'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          账单历史
        </button>
      </div>

      {activeTab === 'plans' && (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan_id === plan.id
            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 space-y-4 transition-all ${
                  isCurrent
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">
                      {formatAmount(plan.price_monthly)}
                    </span>
                    <span className="text-sm text-muted-foreground">/月</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    年付 {formatAmount(plan.price_yearly)}，省{' '}
                    {plan.price_monthly > 0
                      ? Math.round(
                          (1 - plan.price_yearly / (plan.price_monthly * 12)) * 100
                        )
                      : 0}
                    %
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    文本对话：{plan.quota_limits.text_chats === -1 ? '无限' : `${plan.quota_limits.text_chats} 次/月`}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Image className="h-3.5 w-3.5" />
                    图片生成：{plan.quota_limits.image_gens === -1 ? '无限' : `${plan.quota_limits.image_gens} 次/月`}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Video className="h-3.5 w-3.5" />
                    视频生成：{plan.quota_limits.video_gens === -1 ? '无限' : `${plan.quota_limits.video_gens} 次/月`}
                  </div>
                </div>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-md bg-primary/20 px-4 py-2 text-sm font-medium text-primary cursor-default"
                  >
                    当前计划
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.id, 'monthly')}
                    disabled={isPaying}
                    className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {isPaying && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Zap className="h-4 w-4" />
                    立即订阅
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'bills' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {bills.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              暂无账单记录
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">账单周期</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">金额</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">状态</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="px-4 py-3 text-foreground">
                      {formatDate(bill.period_start)} ~ {formatDate(bill.period_end)}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {formatAmount(bill.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {bill.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          已支付
                        </span>
                      ) : bill.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          待支付
                        </span>
                      ) : bill.status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                          <XCircle className="h-3 w-3" />
                          失败
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                          已退款
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(bill.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
