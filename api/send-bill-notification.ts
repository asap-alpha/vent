import { createHandler } from './_lib/handler'
import { sendEmail } from './_lib/mailer'
import { invoiceEmail } from './_lib/templates'
import { getDb } from './_lib/firebase'

interface Body {
  orgId: string
  billId: string
  recipientEmail: string
}

function formatDate(ts: any): string {
  if (!ts) return '—'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default createHandler<Body>(async (req, res) => {
  const { orgId, billId, recipientEmail } = req.body
  if (!orgId || !billId || !recipientEmail) {
    res.status(400).json({ error: 'orgId, billId, and recipientEmail required' })
    return
  }

  // eslint-disable-next-line no-console
  console.log('🎯 [send-bill-notification] Called', { uid: req.uid, orgId, billId })

  const db = getDb()

  const memberSnap = await db.doc(`organizations/${orgId}/members/${req.uid}`).get()
  if (!memberSnap.exists) {
    res.status(403).json({ error: 'Not a member of this org' })
    return
  }

  const billSnap = await db.doc(`organizations/${orgId}/purchaseInvoices/${billId}`).get()
  if (!billSnap.exists) {
    res.status(404).json({ error: 'Bill not found' })
    return
  }
  const bill = billSnap.data()!

  const orgSnap = await db.doc(`organizations/${orgId}`).get()
  const org = orgSnap.data()!

  const supplierSnap = await db.doc(`organizations/${orgId}/suppliers/${bill.supplierId}`).get()
  const supplier = supplierSnap.data()

  const email = invoiceEmail({
    customerName: supplier?.name || 'Supplier',
    customerEmail: recipientEmail,
    orgName: org.name,
    invoiceNumber: `Bill ${bill.number}`,
    invoiceDate: formatDate(bill.date),
    dueDate: formatDate(bill.dueDate),
    currency: org.currency || 'GHS',
    lines: bill.lines || [],
    subtotal: bill.subtotal || 0,
    taxTotal: bill.taxTotal || 0,
    total: bill.total || 0,
    amountDue: bill.amountDue || 0,
    notes: bill.notes,
  })

  await sendEmail({
    to: recipientEmail,
    subject: `Bill ${bill.number} from ${supplier?.name || 'Supplier'} — ${org.name}`,
    html: email.html,
  })

  res.status(200).json({ success: true, sentTo: recipientEmail })
})
