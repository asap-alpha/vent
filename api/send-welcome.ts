import { createHandler } from './_lib/handler'
import { sendEmail } from './_lib/mailer'
import { welcomeEmail } from './_lib/templates'
import { getDb } from './_lib/firebase'

export default createHandler(async (req, res) => {
  // eslint-disable-next-line no-console
  console.log('🎯 [send-welcome] Called', { uid: req.uid })

  const db = getDb()
  const userSnap = await db.doc(`users/${req.uid}`).get()
  if (!userSnap.exists) {
    res.status(404).json({ error: 'User profile not found' })
    return
  }
  const user = userSnap.data()!

  const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}`

  const email = welcomeEmail({
    displayName: user.displayName || 'there',
    email: user.email,
    appUrl,
  })

  await sendEmail({
    to: user.email,
    subject: email.subject,
    html: email.html,
  })

  res.status(200).json({ success: true, sentTo: user.email })
})
