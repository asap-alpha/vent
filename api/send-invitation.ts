import { createHandler } from './_lib/handler'
import { sendEmail } from './_lib/mailer'
import { invitationEmail } from './_lib/templates'
import { getDb } from './_lib/firebase'

interface Body {
  invitationId: string
}

export default createHandler<Body>(async (req, res) => {
  const { invitationId } = req.body
  if (!invitationId) {
    res.status(400).json({ error: 'invitationId required' })
    return
  }

  // eslint-disable-next-line no-console
  console.log('🎯 [send-invitation] Called', { uid: req.uid, invitationId })

  const db = getDb()
  const invSnap = await db.doc(`invitations/${invitationId}`).get()
  if (!invSnap.exists) {
    res.status(404).json({ error: 'Invitation not found' })
    return
  }
  const inv = invSnap.data()!

  // Only the inviter or an admin of the org can trigger this
  if (inv.invitedBy !== req.uid) {
    // Check if caller is admin of the org
    const memberSnap = await db.doc(`organizations/${inv.orgId}/members/${req.uid}`).get()
    const role = memberSnap.data()?.role
    if (!['owner', 'admin'].includes(role)) {
      res.status(403).json({ error: 'Not authorized to send this invitation' })
      return
    }
  }

  const inviterSnap = await db.doc(`users/${inv.invitedBy}`).get()
  const inviterName = inviterSnap.exists
    ? inviterSnap.data()?.displayName || 'A team member'
    : 'A team member'

  const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}`

  const email = invitationEmail({
    inviteeEmail: inv.email,
    orgName: inv.orgName,
    role: inv.role,
    inviterName,
    appUrl,
  })

  await sendEmail({
    to: inv.email,
    subject: email.subject,
    html: email.html,
  })

  res.status(200).json({ success: true, sentTo: inv.email })
})
