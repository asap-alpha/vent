import { auth } from '@/plugins/firebase'
import { logger } from '@/utils/logger'
import type { BillingCycle, PlanId } from '@/types/subscription'

const log = logger('payment')

export interface CheckoutRequest {
  orgId: string
  plan: PlanId
  cycle: BillingCycle
  // Mobile-money details the customer approves on their phone.
  customerMsisdn: string
  channel: string // mtn-gh | vodafone-gh | tigo-gh
  customerName?: string
  customerEmail?: string
  // Optional single-use discount code; validated + applied server-side.
  discountCode?: string
}

export interface DiscountInfo {
  ok: boolean
  valid: boolean
  discountPercent: number
  reason?: string | null
}

export interface CheckoutResponse {
  ok: boolean
  clientReference?: string
  status?: string
  message?: string
  error?: string
}

export interface StatusResponse {
  ok: boolean
  status?: string
  clientReference?: string
  paidAt?: string | null
  error?: string
}

// Cheqam's terminal transaction statuses — stop polling once we hit one.
const TERMINAL = new Set(['Paid', 'Failed', 'AmountMismatch', 'Refunded', 'InitiationFailed', 'Rejected'])

async function authedPost<T>(endpoint: string, body: Record<string, any>): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({} as any))
  if (!res.ok && data?.ok === undefined) {
    throw new Error(data?.error || data?.message || `Request failed: ${res.status}`)
  }
  return data as T
}

export function usePayment() {
  /**
   * Kick off a subscription charge. Returns once Hubtel has accepted the request
   * and prompted the customer's phone (status "Pending"); the final result is
   * resolved by waitForPayment / the org-doc snapshot.
   */
  async function initiateCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
    log.info('Initiating checkout', { orgId: req.orgId, plan: req.plan, cycle: req.cycle })
    const user = auth.currentUser
    return await authedPost<CheckoutResponse>('/api/billing/checkout', {
      orgId: req.orgId,
      planId: req.plan,
      billingCycle: req.cycle,
      customerMsisdn: req.customerMsisdn,
      channel: req.channel,
      customerName: req.customerName ?? user?.displayName ?? '',
      customerEmail: req.customerEmail ?? user?.email ?? '',
      discountCode: req.discountCode || undefined,
    })
  }

  /** Preview a discount code for an org before charging. Display-only — the
   * discounted price is recomputed authoritatively at checkout. */
  async function validateDiscount(orgId: string, code: string): Promise<DiscountInfo> {
    return await authedPost<DiscountInfo>('/api/billing/validate-discount', { orgId, code })
  }

  async function checkStatus(clientReference: string): Promise<StatusResponse> {
    return await authedPost<StatusResponse>('/api/billing/status', { clientReference })
  }

  /**
   * Poll the payment status until it reaches a terminal state or times out.
   * onTick receives each interim status so the UI can reflect progress.
   */
  async function waitForPayment(
    clientReference: string,
    opts?: { intervalMs?: number; timeoutMs?: number; onTick?: (status: string) => void }
  ): Promise<StatusResponse> {
    const interval = opts?.intervalMs ?? 5000
    const timeout = opts?.timeoutMs ?? 180000
    const start = Date.now()
    let last: StatusResponse = { ok: false, status: 'Pending' }

    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, interval))
      try {
        last = await checkStatus(clientReference)
        if (last.status) {
          opts?.onTick?.(last.status)
          if (TERMINAL.has(last.status)) return last
        }
      } catch (e: any) {
        log.warn('Status poll error', { message: e.message })
      }
    }

    log.warn('Payment polling timed out', { clientReference, lastStatus: last.status })
    return { ok: false, status: last.status || 'Pending', error: 'timeout' }
  }

  return { initiateCheckout, validateDiscount, checkStatus, waitForPayment }
}
