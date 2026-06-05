import { createHandler } from '../_lib/handler'
import { getDb } from '../_lib/firebase'
import { cheqamValidateDiscount } from '../_lib/cheqam'

// Previews a discount code for the subscribe modal. Authenticated by Firebase
// (createHandler → req.uid); confirms the caller belongs to the org before
// proxying to Cheqam, so codes can't be probed across organizations. The actual
// discounted price is recomputed authoritatively at checkout — this is display-only.
interface Body {
  orgId: string
  code: string
}

export default createHandler<Body>(async (req, res) => {
  const { orgId, code } = req.body
  if (!orgId || !code) {
    res.status(400).json({ error: 'orgId and code are required' })
    return
  }

  const db = getDb()
  const memberSnap = await db.doc(`organizations/${orgId}/members/${req.uid}`).get()
  if (!memberSnap.exists) {
    res.status(403).json({ error: 'Not a member of this org' })
    return
  }

  const result = await cheqamValidateDiscount(orgId, code)
  res.status(200).json({
    ok: true,
    valid: result.valid,
    discountPercent: result.discountPercent,
    reason: result.reason ?? null,
  })
})
