import { useSubscriptionStore } from '@/stores/subscription'
import { useUpgradePromptStore } from '@/stores/upgradePrompt'
import { PLANS, PLAN_ORDER, getPlan } from '@/config/plans'
import type { PlanId, PlanLimits } from '@/types/subscription'

export class FeatureLockedError extends Error {
  constructor(message: string, public requiredPlan?: PlanId) {
    super(message)
    this.name = 'FeatureLockedError'
  }
}

export class PaymentRequiredError extends Error {
  constructor(message = 'Subscription required') {
    super(message)
    this.name = 'PaymentRequiredError'
  }
}

/**
 * Find the cheapest plan that satisfies a boolean feature.
 */
function minPlanForFeature(feature: keyof PlanLimits): PlanId | undefined {
  for (const id of PLAN_ORDER) {
    const v = PLANS[id].limits[feature]
    if (v === true || v === 'unlimited') return id
    if (typeof v === 'number' && v > 0) return id
  }
  return undefined
}

/**
 * Find the cheapest plan whose numeric limit is at or above `needed`.
 */
function minPlanForLimit(feature: keyof PlanLimits, needed: number): PlanId | undefined {
  for (const id of PLAN_ORDER) {
    const v = PLANS[id].limits[feature]
    if (v === 'unlimited') return id
    if (typeof v === 'number' && v >= needed) return id
  }
  return undefined
}

export function useFeatureGate() {
  const subStore = useSubscriptionStore()
  const promptStore = useUpgradePromptStore()

  /** Throws + opens upgrade prompt if subscription isn't active/trialing. */
  function requireActive(action = 'perform this action'): void {
    if (subStore.isActive && !subStore.trialExpired) return
    promptStore.open({
      title: subStore.trialExpired ? 'Trial expired' : 'Subscription required',
      message: `Your subscription is ${subStore.status}. Subscribe to a plan to ${action}.`,
      ctaLabel: 'View plans',
    })
    throw new PaymentRequiredError(`Subscription ${subStore.status}`)
  }

  /** Throws if current plan lacks a boolean feature; opens upgrade prompt. */
  function requireFeature(
    feature: keyof PlanLimits,
    featureLabel: string
  ): void {
    requireActive(`use ${featureLabel}`)
    const plan = subStore.plan
    if (!plan) return
    const v = plan.limits[feature]
    if (v === true || v === 'unlimited' || (typeof v === 'number' && v > 0)) return

    const required = minPlanForFeature(feature)
    promptStore.open({
      title: `${featureLabel} is not on your plan`,
      message: required
        ? `${featureLabel} is available on the ${PLANS[required].name} plan and above.`
        : `${featureLabel} is not available on your plan.`,
      requiredPlan: required,
      ctaLabel: required ? `Upgrade to ${PLANS[required].name}` : 'View plans',
    })
    throw new FeatureLockedError(`${featureLabel} requires a higher plan`, required)
  }

  /**
   * Throws if `current + 1 > limit`. Pass current count, limit key, and a label.
   */
  function requireUnderLimit(
    feature: keyof PlanLimits,
    current: number,
    label: string
  ): void {
    requireActive(`add another ${label}`)
    const plan = subStore.plan
    if (!plan) return
    const v = plan.limits[feature]
    if (v === 'unlimited') return
    if (typeof v !== 'number') return
    if (current < v) return

    const required = minPlanForLimit(feature, current + 1)
    promptStore.open({
      title: `${label} limit reached`,
      message: `Your ${plan.name} plan allows ${v} ${label}${v === 1 ? '' : 's'}. ${
        required
          ? `Upgrade to ${PLANS[required].name} for more.`
          : 'Upgrade your plan for more.'
      }`,
      requiredPlan: required,
      ctaLabel: required ? `Upgrade to ${PLANS[required].name}` : 'View plans',
    })
    throw new FeatureLockedError(`${label} limit (${v}) reached`, required)
  }

  function hasFeature(feature: keyof PlanLimits): boolean {
    if (!subStore.isActive || subStore.trialExpired) return false
    const plan = subStore.plan
    if (!plan) return false
    const v = plan.limits[feature]
    return v === true || v === 'unlimited' || (typeof v === 'number' && v > 0)
  }

  function underLimit(feature: keyof PlanLimits, current: number): boolean {
    const plan = subStore.plan
    if (!plan) return false
    const v = plan.limits[feature]
    if (v === 'unlimited') return true
    if (typeof v !== 'number') return false
    return current < v
  }

  return {
    requireActive,
    requireFeature,
    requireUnderLimit,
    hasFeature,
    underLimit,
    minPlanForFeature,
    minPlanForLimit,
    getPlan,
  }
}
