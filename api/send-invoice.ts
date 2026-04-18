import { createHandler } from './_lib/handler'
import { sendEmail } from './_lib/mailer'
import { invoiceEmail } from './_lib/templates'
import { getDb } from './_lib/firebase'
import admin from 'firebase-admin'

interface Body {
  orgId: string
  invoiceId: string
}

function formatDate(ts: any): string {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default createHandler<Body>(async (req, res) => {
  const { orgId, invoiceId } = req.body
  if (!orgId || !invoiceId) {
    res.status(400).json({ error: 'orgId and invoiceId required' })
    return
  }

  // eslint-disable-next-line no-console
  console.log('🎯 [send-invoice] Called', { uid: req.uid, orgId, invoiceId })

  const db = getDb()

  // Verify caller is a member
  const memberSnap = await db.doc(`organizations/${orgId}/members/${req.uid}`).get()
  if (!memberSnap.exists) {
    res.status(403).json({ error: 'Not a member of this org' })
    return
  }

  const invSnap = await db.doc(`organizations/${orgId}/salesInvoices/${invoiceId}`).get()
  if (!invSnap.exists) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }
  const inv = invSnap.data()!

  const custSnap = await db.doc(`organizations/${orgId}/customers/${inv.customerId}`).get()
  const customer = custSnap.data()
  if (!customer?.email) {
    res.status(400).json({ error: 'Customer has no email address' })
    return
  }

  const orgSnap = await db.doc(`organizations/${orgId}`).get()
  const org = orgSnap.data()!

  const email = invoiceEmail({
    customerName: customer.name || 'Customer',
    customerEmail: customer.email,
    orgName: org.name,
    invoiceNumber: inv.number,
    invoiceDate: formatDate(inv.date),
    dueDate: formatDate(inv.dueDate),
    currency: org.currency || 'GHS',
    lines: inv.lines || [],
    subtotal: inv.subtotal || 0,
    taxTotal: inv.taxTotal || 0,
    total: inv.total || 0,
    amountDue: inv.amountDue || 0,
    notes: inv.notes,
  })

  await sendEmail({
    to: customer.email,
    subject: email.subject,
    html: email.html,
  })

  if (inv.status === 'draft') {
    await invSnap.ref.update({
      status: 'sent',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  }

  res.status(200).json({ success: true, sentTo: customer.email })
})
