import { logger } from '@/utils/logger'
import { getPlan } from '@/config/plans'
import type { BillingCycle, PlanId } from '@/types/subscription'
import { useSubscriptionStore } from '@/stores/subscription'
import { useOrganizationStore } from '@/stores/organization'

const log = logger('payment')

export interface CheckoutRequest {
  orgId: string
  plan: PlanId
  cycle: BillingCycle
}

export interface CheckoutResponse {
  ok: boolean
  paymentRef?: string
  message?: string
}

/**
 * Stub for the payment provider (Paystack / Hubtel) integration.
 * Wire the real endpoint here when ready — for now, immediately marks
 * the subscription active so the rest of the flow can be exercised.
 */
export function usePayment() {
  const subStore = useSubscriptionStore()
  const orgStore = useOrganizationStore()

  async function initiateCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    const plan = getPlan(req.plan)
    const amount = req.cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice
    log.info('Initiating checkout', { orgId: req.orgId, plan: req.plan, cycle: req.cycle, amount })

    // TODO: replace with real payment endpoint
    // const res = await fetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify(req) })
    // const data = await res.json()
    // window.location.href = data.authorizationUrl

    // Dev stub — activate immediately
    await subStore.setPlan(req.orgId, req.plan, req.cycle)
    await orgStore.fetchOrganizations()
    log.info('Checkout stub: subscription activated', { plan: req.plan })
    return { ok: true, paymentRef: `dev-${Date.now()}` }
  }

  return { initiateCheckout }
}
