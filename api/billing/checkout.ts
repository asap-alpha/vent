import { createHandler } from '../_lib/handler'
import { getDb } from '../_lib/firebase'
import { cheqamInitiate } from '../_lib/cheqam'




// Initiates a Vent subscription payment. The browser is authenticated by Firebase
// (createHandler → req.uid); this route confirms the caller can manage the org's
// billing, then calls Cheqam server-to-server with the shared API key. The actual
// charge is mobile-money: Cheqam prompts the customer's phone and the result
// arrives later via Cheqam's callback (which writes Vent's org doc). The client
// then polls /api/billing/status.
interface Body {
  orgId: string
  planId: 'starter' | 'standard' | 'pro'
  billingCycle: 'monthly' | 'annual'
  customerMsisdn: string
  channel: string
  customerName?: string
  customerEmail?: string
  clientReference?: string
}

const VALID_PLANS = ['starter', 'standard', 'pro']
const VALID_CYCLES = ['monthly', 'annual']
const BILLING_ROLES = ['owner', 'admin']

export default createHandler<Body>(async (req, res) => {
  const { orgId, planId, billingCycle, customerMsisdn, channel, customerName, customerEmail, clientReference } = req.body

  if (!orgId || !planId || !billingCycle || !customerMsisdn || !channel) {
    res.status(400).json({ error: 'orgId, planId, billingCycle, customerMsisdn and channel are required' })
    return
  }
  if (!VALID_PLANS.includes(planId)) {
    res.status(400).json({ error: `Invalid planId '${planId}'. Allowed: ${VALID_PLANS.join(', ')}` })
    return
  }
  if (!VALID_CYCLES.includes(billingCycle)) {
    res.status(400).json({ error: `Invalid billingCycle '${billingCycle}'. Allowed: ${VALID_CYCLES.join(', ')}` })
    return
  }

  const db = getDb()
  const memberSnap = await db.doc(`organizations/${orgId}/members/${req.uid}`).get()
  if (!memberSnap.exists) {
    res.status(403).json({ error: 'Not a member of this org' })
    return
  }
  const role = memberSnap.data()?.role
  if (!BILLING_ROLES.includes(role)) {
    res.status(403).json({ error: 'Only an owner or admin can manage billing' })
    return
  }

  // eslint-disable-next-line no-console
  console.log('💳 [billing/checkout] Initiating', { uid: req.uid, orgId, planId, billingCycle, channel })

  const result = await cheqamInitiate({
    orgId,
    planId,
    billingCycle,
    customerMsisdn,
    channel,
    customerName,
    customerEmail,
    clientReference,
  })

  if (!result.Success) {
    res.status(502).json({
      ok: false,
      error: result.ErrorMessage || result.Message || 'Payment initiation failed',
      clientReference: result.ClientReference || null,
      status: result.Status || null,
    })
    return
  }

  res.status(200).json({
    ok: true,
    clientReference: result.ClientReference,
    status: result.Status,
    message: result.Message,
  })
})
