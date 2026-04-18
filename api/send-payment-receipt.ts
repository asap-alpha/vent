import { createHandler } from './_lib/handler'
import { sendEmail } from './_lib/mailer'
import { paymentReceiptEmail } from './_lib/templates'
import { getDb } from './_lib/firebase'

interface Body {
  orgId: string
  receiptId: string
}

function formatDate(ts: any): string {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default createHandler<Body>(async (req, res) => {
  const { orgId, receiptId } = req.body
  if (!orgId || !receiptId) {
    res.status(400).json({ error: 'orgId and receiptId required' })
    return
  }

  // eslint-disable-next-line no-console
  console.log('🎯 [send-payment-receipt] Called', { uid: req.uid, orgId, receiptId })

  const db = getDb()

  // Verify caller is a member
  const memberSnap = await db.doc(`organizations/${orgId}/members/${req.uid}`).get()
  if (!memberSnap.exists) {
    res.status(403).json({ error: 'Not a member of this org' })
    return
  }

  const receiptSnap = await db.doc(`organizations/${orgId}/receipts/${receiptId}`).get()
  if (!receiptSnap.exists) {
    res.status(404).json({ error: 'Receipt not found' })
    return
  }
  const receipt = receiptSnap.data()!

  const custSnap = await db.doc(`organizations/${orgId}/customers/${receipt.customerId}`).get()
  const customer = custSnap.data()
  if (!customer?.email) {
    res.status(400).json({ error: 'Customer has no email address' })
    return
  }

  const invSnap = await db.doc(`organizations/${orgId}/salesInvoices/${receipt.invoiceId}`).get()
  const inv = invSnap.data()
  if (!inv) {
    res.status(404).json({ error: 'Invoice not found' })
    return
  }

  const orgSnap = await db.doc(`organizations/${orgId}`).get()
  const org = orgSnap.data()!

  const email = paymentReceiptEmail({
    customerName: customer.name || 'Customer',
    orgName: org.name,
    invoiceNumber: inv.number,
    paymentDate: formatDate(receipt.date),
    amount: receipt.amount,
    method: receipt.method || '',
    reference: receipt.reference || '',
    currency: org.currency || 'GHS',
    remainingBalance: inv.amountDue || 0,
  })

  await sendEmail({
    to: customer.email,
    subject: email.subject,
    html: email.html,
  })

  res.status(200).json({ success: true, sentTo: customer.email })
})
