import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, onSnapshot, updateDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import { logger } from '@/utils/logger'
import { PLANS, planRank, DEFAULT_TRIAL_PLAN } from '@/config/plans'
import type { BillingCycle, OrgSubscription, PlanId, SubscriptionStatus } from '@/types/subscription'

const log = logger('subscription')

function toDate(v: any): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v.toDate === 'function') return v.toDate()
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscription = ref<OrgSubscription | null>(null)
  const loading = ref(false)
  // `loaded` flips true once the first org snapshot arrives (exists or not). Until
  // then we must NOT assume 'expired' — that would bounce a perfectly valid user to
  // billing during the initial load race. Gates wait on whenLoaded() before deciding.
  const loaded = ref(false)
  let resolveLoaded: () => void = () => {}
  let loadedPromise: Promise<void> = Promise.resolve()
  let unsub: Unsubscribe | null = null

  const plan = computed(() => (subscription.value ? PLANS[subscription.value.plan] : null))
  const status = computed<SubscriptionStatus>(() => subscription.value?.status || 'expired')

  const isTrialing = computed(() => status.value === 'trialing')
  const isActive = computed(() => status.value === 'active' || status.value === 'trialing')

  const daysLeftInTrial = computed(() => {
    if (!isTrialing.value || !subscription.value?.trialEndsAt) return 0
    const ms = subscription.value.trialEndsAt.getTime() - Date.now()
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  })

  const trialExpired = computed(
    () => isTrialing.value && subscription.value?.trialEndsAt
      ? subscription.value.trialEndsAt.getTime() < Date.now()
      : false
  )

  const requiresPayment = computed(() => {
    // Don't block before the subscription has loaded — `status` defaults to
    // 'expired' when null, which would be a false positive during the load race.
    if (!loaded.value) return false
    if (status.value === 'past_due' || status.value === 'canceled' || status.value === 'expired') return true
    if (trialExpired.value) return true
    return false
  })

  /** Resolves once the first org snapshot has been processed. */
  function whenLoaded(): Promise<void> {
    return loadedPromise
  }

  function canAccessFeature(feature: keyof typeof PLANS.starter.limits): boolean {
    if (!plan.value || !isActive.value) return false
    const v = plan.value.limits[feature]
    return v === true || v === 'unlimited' || (typeof v === 'number' && v > 0)
  }

  function canUpgradeTo(target: PlanId): boolean {
    if (!subscription.value) return true
    return planRank(target) > planRank(subscription.value.plan)
  }

  function unsubscribe() {
    if (unsub) {
      unsub()
      unsub = null
    }
  }

  function subscribe(orgId: string) {
    unsubscribe()
    log.info('Subscribing to org subscription', { orgId })
    // Fresh load: nothing known yet until the first snapshot resolves the promise.
    loaded.value = false
    loadedPromise = new Promise<void>((resolve) => { resolveLoaded = resolve })
    const markLoaded = () => {
      if (!loaded.value) {
        loaded.value = true
        resolveLoaded()
      }
    }
    unsub = onSnapshot(
      doc(db, 'organizations', orgId),
      (snap) => {
        if (!snap.exists()) {
          subscription.value = null
          markLoaded()
          return
        }
        const data = snap.data()
        subscription.value = {
          plan: (data.plan as PlanId) || DEFAULT_TRIAL_PLAN,
          status: (data.subscriptionStatus as SubscriptionStatus) || 'expired',
          billingCycle: (data.billingCycle as BillingCycle) || 'monthly',
          trialEndsAt: toDate(data.trialEndsAt),
          currentPeriodStart: toDate(data.currentPeriodStart),
          currentPeriodEnd: toDate(data.currentPeriodEnd),
          canceledAt: toDate(data.canceledAt),
        }
        markLoaded()
        log.debug('Subscription snapshot', {
          plan: subscription.value.plan,
          status: subscription.value.status,
          daysLeftInTrial: daysLeftInTrial.value,
        })
      },
      (err) => {
        log.error('Subscription snapshot error', { code: err.code, message: err.message })
        // Fail open on read error so a transient Firestore hiccup doesn't wall the
        // user behind a billing redirect.
        markLoaded()
      }
    )
  }

  /**
   * Change plan locally (without payment). Used by:
   * - org creation (trial start)
   * - admin override
   * - payment webhook (later, server-side)
   */
  async function setPlan(orgId: string, target: PlanId, cycle: BillingCycle = 'monthly') {
    log.info('Setting plan', { orgId, target, cycle })
    const now = new Date()
    const periodEnd = new Date(now)
    if (cycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    else periodEnd.setMonth(periodEnd.getMonth() + 1)

    await updateDoc(doc(db, 'organizations', orgId), {
      plan: target,
      subscriptionStatus: 'active',
      billingCycle: cycle,
      currentPeriodStart: serverTimestamp(),
      currentPeriodEnd: periodEnd,
      trialEndsAt: null,
    })
  }

  async function cancel(orgId: string) {
    log.info('Canceling subscription', { orgId })
    await updateDoc(doc(db, 'organizations', orgId), {
      subscriptionStatus: 'canceled',
      canceledAt: serverTimestamp(),
    })
  }

  function init() {
    const orgStore = useOrganizationStore()
    if (orgStore.orgId) subscribe(orgStore.orgId)
  }

  return {
    subscription,
    loading,
    loaded,
    whenLoaded,
    plan,
    status,
    isTrialing,
    isActive,
    daysLeftInTrial,
    trialExpired,
    requiresPayment,
    canAccessFeature,
    canUpgradeTo,
    subscribe,
    unsubscribe,
    setPlan,
    cancel,
    init,
  }
})
