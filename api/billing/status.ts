import { createHandler } from '../_lib/handler'
import { getDb } from '../_lib/firebase'
import { cheqamStatus } from '../_lib/cheqam'

// Polls Cheqam for the outcome of a Vent subscription payment. The org id is
// embedded in the client reference ({raw}:{orgId}:vent), so we recover it to
// verify the caller is a member before proxying to Cheqam. On a Paid result the
// org doc is already updated by Cheqam's callback, so the subscription store's
// onSnapshot flips the UI independently of this poll.
interface Body {
  clientReference: string
}

export default createHandler<Body>(async (req, res) => {
  const { clientReference } = req.body
  if (!clientReference) {
    res.status(400).json({ error: 'clientReference is required' })
    return
  }

  const parts = clientReference.split(':')
  if (parts.length !== 3 || parts[2] !== 'vent' || !parts[1]) {
    res.status(400).json({ error: 'Malformed clientReference' })
    return
  }
  const orgId = parts[1]

  const db = getDb()
  const memberSnap = await db.doc(`organizations/${orgId}/members/${req.uid}`).get()
  if (!memberSnap.exists) {
    res.status(403).json({ error: 'Not a member of this org' })
    return
  }

  const result = await cheqamStatus(clientReference)
  if (!result.httpOk) {
    const code = result.httpStatus === 404 ? 404 : 502
    res.status(code).json({ ok: false, error: result.data?.error || 'Status check failed' })
    return
  }

  res.status(200).json({
    ok: true,
    status: result.data.Status ?? null,
    clientReference: result.data.ClientReference ?? clientReference,
    paidAt: result.data.PaidAt ?? null,
    source: result.data.Source ?? null,
  })
})
