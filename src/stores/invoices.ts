import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  where,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import { useAuthStore } from './auth'
import { useTaxStore } from './tax'
import { useAccountsStore } from './accounts'
import { computeTaxBreakdown } from '@/utils/tax'
import { round2 } from '@/utils/accounting'
import type { SalesInvoice, InvoiceLine, InvoiceStatus, Quote, CreditNote, Receipt } from '@/types/sales'
import type { TaxLine } from '@/types/tax'
import { logger } from '@/utils/logger'

const log = logger('invoices')

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<SalesInvoice[]>([])
  const quotes = ref<Quote[]>([])
  const creditNotes = ref<CreditNote[]>([])
  const receipts = ref<Receipt[]>([])
  const loading = ref(false)
  const subs: Unsubscribe[] = []

  // Computed
  const openInvoices = computed(() =>
    invoices.value.filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft')
  )

  function calcTotals(lines: InvoiceLine[]): { subtotal: number; taxTotal: number; total: number } {
    let subtotal = 0
    let taxTotal = 0
    for (const line of lines) {
      const lineSub = (line.quantity || 0) * (line.unitPrice || 0)
      const lineTax = lineSub * ((line.taxRate || 0) / 100)
      subtotal += lineSub
      taxTotal += lineTax
    }
    return { subtotal, taxTotal, total: subtotal + taxTotal }
  }

  function recomputeLineAmounts(lines: InvoiceLine[]): InvoiceLine[] {
    return lines.map((l) => {
      const sub = (l.quantity || 0) * (l.unitPrice || 0)
      const tax = sub * ((l.taxRate || 0) / 100)
      return { ...l, amount: sub + tax }
    })
  }

  // Split each line's tax across its tax code's component accounts, aggregated by
  // account. Lines with a raw taxRate but no code post to the Tax Payable control
  // account. Returns the authoritative taxTotal (sum of rounded components) too.
  function computeTaxLines(lines: InvoiceLine[]): { taxLines: TaxLine[]; taxTotal: number } {
    const taxStore = useTaxStore()
    const accountsStore = useAccountsStore()
    const byAccount = new Map<string, { name: string; amount: number }>()
    let taxTotal = 0
    const add = (accountId: string, name: string, amount: number) => {
      if (!accountId || amount === 0) return
      const cur = byAccount.get(accountId) || { name, amount: 0 }
      cur.amount = round2(cur.amount + amount)
      byAccount.set(accountId, cur)
      taxTotal = round2(taxTotal + amount)
    }
    for (const l of lines) {
      const base = round2((l.quantity || 0) * (l.unitPrice || 0))
      if (base === 0) continue
      const code = l.taxCodeId ? taxStore.getTaxCode(l.taxCodeId) : undefined
      if (code && code.components.length) {
        for (const c of computeTaxBreakdown(base, code.components).components) {
          add(c.accountId, c.name, c.amount)
        }
      } else if ((l.taxRate || 0) > 0) {
        const acctId = accountsStore.getSystemAccount('tax_payable')?.id || ''
        add(acctId, 'Tax', round2(base * ((l.taxRate || 0) / 100)))
      }
    }
    const taxLines: TaxLine[] = Array.from(byAccount.entries()).map(([accountId, v]) => ({
      accountId,
      name: v.name,
      amount: v.amount,
    }))
    return { taxLines, taxTotal }
  }

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) {
      log.warn('subscribe() skipped — no org')
      return
    }
    log.info('Subscribing to sales collections')
    unsubscribe()
    loading.value = true

    const orgPath = ['organizations', orgStore.orgId] as const

    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'salesInvoices'), orderBy('date', 'desc')),
        (snap) => {
          invoices.value = snap.docs.map((d) => mapDoc(d) as SalesInvoice)
          log.debug('salesInvoices snapshot', { count: invoices.value.length })
          loading.value = false
        },
        (err) => log.error('salesInvoices subscription error', { code: err.code, message: err.message })
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'quotes'), orderBy('date', 'desc')),
        (snap) => {
          quotes.value = snap.docs.map((d) => mapDoc(d) as Quote)
          log.debug('quotes snapshot', { count: quotes.value.length })
        },
        (err) => log.error('quotes subscription error', { code: err.code, message: err.message })
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'creditNotes'), orderBy('date', 'desc')),
        (snap) => {
          creditNotes.value = snap.docs.map((d) => mapDoc(d) as CreditNote)
          log.debug('creditNotes snapshot', { count: creditNotes.value.length })
        },
        (err) => log.error('creditNotes subscription error', { code: err.code, message: err.message })
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'receipts'), orderBy('date', 'desc')),
        (snap) => {
          receipts.value = snap.docs.map((d) => mapDoc(d) as Receipt)
          log.debug('receipts snapshot', { count: receipts.value.length })
        },
        (err) => log.error('receipts subscription error', { code: err.code, message: err.message })
      )
    )
  }

  function mapDoc(d: any) {
    const data = d.data()
    const out: any = { id: d.id, ...data }
    for (const key of ['date', 'dueDate', 'expiryDate', 'createdAt', 'updatedAt']) {
      if (data[key]?.toDate) out[key] = data[key].toDate()
    }
    return out
  }

  function unsubscribe() {
    while (subs.length) subs.pop()?.()
  }

  // ---- Invoices ----

  async function createInvoice(data: {
    customerId: string
    customerName?: string
    number: string
    date: Date
    dueDate: Date
    lines: InvoiceLine[]
    notes: string
    status?: InvoiceStatus
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    // Plan enforcement: cap invoices per calendar month
    const { useFeatureGate } = await import('@/composables/useFeatureGate')
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const invoicesThisMonth = invoices.value.filter(
      (i) => i.date && new Date(i.date).getTime() >= monthStart.getTime()
    ).length
    useFeatureGate().requireUnderLimit('invoicesPerMonth', invoicesThisMonth, 'invoice this month')

    const lines = recomputeLineAmounts(data.lines)
    const { subtotal } = calcTotals(lines)
    const { taxLines, taxTotal } = computeTaxLines(lines)
    const total = round2(subtotal + taxTotal)

    log.info('createInvoice', { number: data.number, customerId: data.customerId, total })
    try {
      await addDoc(
        collection(db, 'organizations', orgStore.orgId, 'salesInvoices'),
        {
          customerId: data.customerId,
          customerName: data.customerName || '',
          number: data.number,
          date: Timestamp.fromDate(data.date),
          dueDate: Timestamp.fromDate(data.dueDate),
          status: data.status || 'draft',
          lines,
          subtotal,
          taxTotal,
          total,
          taxLines,
          amountPaid: 0,
          amountDue: total,
          notes: data.notes,
          createdBy: authStore.user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    } catch (e: any) {
      log.error('createInvoice failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function updateInvoice(id: string, data: Partial<SalesInvoice>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')

    const updateData: any = { ...data, updatedAt: serverTimestamp() }
    delete updateData.id
    delete updateData.createdAt

    if (updateData.lines) {
      const inv = invoices.value.find((i) => i.id === id)
      // Don't let a paid/part-paid invoice's amounts be edited — it would orphan the
      // receipts and desync the balance. Void + reissue instead.
      if ((inv?.amountPaid || 0) > 0) {
        throw new Error('This invoice has payments and cannot be edited. Void it and issue a new one.')
      }
      updateData.lines = recomputeLineAmounts(updateData.lines)
      const { subtotal } = calcTotals(updateData.lines)
      const { taxLines, taxTotal } = computeTaxLines(updateData.lines)
      const total = round2(subtotal + taxTotal)
      updateData.subtotal = subtotal
      updateData.taxTotal = taxTotal
      updateData.total = total
      updateData.taxLines = taxLines
      updateData.amountDue = round2(total - (inv?.amountPaid || 0))
    }
    if (updateData.date instanceof Date) updateData.date = Timestamp.fromDate(updateData.date)
    if (updateData.dueDate instanceof Date) updateData.dueDate = Timestamp.fromDate(updateData.dueDate)

    // Voiding an invoice that has payments: the posting engine drops THIS invoice's
    // GL entry, but each receipt is a separate document whose GL entry (DR Bank /
    // CR AR) would survive and orphan — pushing AR negative and overstating cash.
    // Mark the receipts void (keeping them as an audit record) in the same batch; the
    // posting engine then drops their GL entries too, keeping the ledger consistent.
    if (data.status === 'void') {
      const inv = invoices.value.find((i) => i.id === id)
      if (inv && (inv.amountPaid || 0) > 0) {
        const receiptsSnap = await getDocs(
          query(collection(db, 'organizations', orgStore.orgId, 'receipts'), where('invoiceId', '==', id))
        )
        const batch = writeBatch(db)
        for (const r of receiptsSnap.docs) {
          batch.update(r.ref, { status: 'void', updatedAt: serverTimestamp() })
        }
        batch.update(doc(db, 'organizations', orgStore.orgId, 'salesInvoices', id), {
          ...updateData,
          amountPaid: 0,
          amountDue: 0,
        })
        log.info('updateInvoice void with payments — voiding receipts', { id, receipts: receiptsSnap.size })
        await batch.commit()
        return
      }
    }

    log.info('updateInvoice', { id })
    try {
      await updateDoc(
        doc(db, 'organizations', orgStore.orgId, 'salesInvoices', id),
        updateData
      )
    } catch (e: any) {
      log.error('updateInvoice failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function deleteInvoice(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const inv = invoices.value.find((i) => i.id === id)
    if ((inv?.amountPaid || 0) > 0) {
      throw new Error('This invoice has payments and cannot be deleted. Void it instead.')
    }
    log.info('deleteInvoice', { id })
    try {
      await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'salesInvoices', id))
    } catch (e: any) {
      log.error('deleteInvoice failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function recordReceipt(data: {
    customerId: string
    invoiceId: string
    date: Date
    amount: number
    method: string
    reference: string
    notes: string
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const invoice = invoices.value.find((i) => i.id === data.invoiceId)
    if (!invoice) throw new Error('Invoice not found')
    if (data.amount <= 0) throw new Error('Amount must be positive')
    if (data.amount > invoice.amountDue + 0.005) {
      throw new Error(`Amount exceeds amount due (${invoice.amountDue})`)
    }

    log.info('recordReceipt', { invoiceId: data.invoiceId, amount: data.amount, method: data.method })
    try {
      // Create receipt
      const receiptRef = await addDoc(collection(db, 'organizations', orgStore.orgId, 'receipts'), {
        customerId: data.customerId,
        invoiceId: data.invoiceId,
        date: Timestamp.fromDate(data.date),
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        status: 'active',
        createdBy: authStore.user.uid,
        createdAt: serverTimestamp(),
      })

      // Update invoice
      const newPaid = invoice.amountPaid + data.amount
      const newDue = invoice.total - newPaid
      let newStatus: InvoiceStatus = invoice.status
      if (newDue < 0.005) newStatus = 'paid'
      else if (newPaid > 0) newStatus = 'partially_paid'

      await updateDoc(
        doc(db, 'organizations', orgStore.orgId, 'salesInvoices', data.invoiceId),
        {
          amountPaid: newPaid,
          amountDue: Math.max(newDue, 0),
          status: newStatus,
          updatedAt: serverTimestamp(),
        }
      )

      // Auto-send payment receipt email (fire-and-forget)
      const orgIdForEmail = orgStore.orgId
      import('@/composables/useEmail').then(({ sendPaymentReceiptByEmail }) => {
        sendPaymentReceiptByEmail(orgIdForEmail, receiptRef.id).catch((err) => {
          log.error('Failed to send payment receipt email', { receiptId: receiptRef.id, message: err.message })
        })
      })
    } catch (e: any) {
      log.error('recordReceipt failed', { code: e.code, message: e.message })
      throw e
    }
  }

  // ---- Quotes ----

  async function createQuote(data: {
    customerId: string
    customerName?: string
    number: string
    date: Date
    expiryDate: Date
    lines: InvoiceLine[]
    notes: string
    status?: 'draft' | 'sent'
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const lines = recomputeLineAmounts(data.lines)
    const { subtotal, taxTotal, total } = calcTotals(lines)

    log.info('createQuote', { number: data.number, customerId: data.customerId, total })
    try {
      await addDoc(collection(db, 'organizations', orgStore.orgId, 'quotes'), {
        customerId: data.customerId,
        customerName: data.customerName || '',
        number: data.number,
        date: Timestamp.fromDate(data.date),
        expiryDate: Timestamp.fromDate(data.expiryDate),
        status: data.status || 'draft',
        lines,
        subtotal,
        taxTotal,
        total,
        notes: data.notes,
        convertedInvoiceId: null,
        createdBy: authStore.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (e: any) {
      log.error('createQuote failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function updateQuote(id: string, data: Partial<Quote>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const updateData: any = { ...data, updatedAt: serverTimestamp() }
    delete updateData.id
    delete updateData.createdAt
    if (updateData.lines) {
      updateData.lines = recomputeLineAmounts(updateData.lines)
      const { subtotal, taxTotal, total } = calcTotals(updateData.lines)
      updateData.subtotal = subtotal
      updateData.taxTotal = taxTotal
      updateData.total = total
    }
    if (updateData.date instanceof Date) updateData.date = Timestamp.fromDate(updateData.date)
    if (updateData.expiryDate instanceof Date) updateData.expiryDate = Timestamp.fromDate(updateData.expiryDate)
    log.info('updateQuote', { id })
    try {
      await updateDoc(doc(db, 'organizations', orgStore.orgId, 'quotes', id), updateData)
    } catch (e: any) {
      log.error('updateQuote failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function deleteQuote(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    log.info('deleteQuote', { id })
    try {
      await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'quotes', id))
    } catch (e: any) {
      log.error('deleteQuote failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function convertQuoteToInvoice(quoteId: string, dueDate: Date, invoiceNumber: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const quote = quotes.value.find((q) => q.id === quoteId)
    if (!quote) throw new Error('Quote not found')

    log.info('convertQuoteToInvoice', { quoteId, invoiceNumber })
    try {
      await createInvoice({
        customerId: quote.customerId,
        customerName: quote.customerName,
        number: invoiceNumber,
        date: new Date(),
        dueDate,
        lines: quote.lines,
        notes: quote.notes,
        status: 'sent',
      })

      await updateDoc(doc(db, 'organizations', orgStore.orgId, 'quotes', quoteId), {
        status: 'converted',
        updatedAt: serverTimestamp(),
      })
    } catch (e: any) {
      log.error('convertQuoteToInvoice failed', { code: e.code, message: e.message })
      throw e
    }
  }

  // ---- Credit Notes ----

  async function createCreditNote(data: {
    customerId: string
    customerName?: string
    invoiceId: string
    number: string
    date: Date
    lines: InvoiceLine[]
    notes: string
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const lines = recomputeLineAmounts(data.lines)
    const { subtotal, taxTotal, total } = calcTotals(lines)

    log.info('createCreditNote', { number: data.number, invoiceId: data.invoiceId, total })
    try {
      await addDoc(collection(db, 'organizations', orgStore.orgId, 'creditNotes'), {
        customerId: data.customerId,
        customerName: data.customerName || '',
        invoiceId: data.invoiceId,
        number: data.number,
        date: Timestamp.fromDate(data.date),
        lines,
        subtotal,
        taxTotal,
        total,
        notes: data.notes,
        createdBy: authStore.user.uid,
        createdAt: serverTimestamp(),
      })
    } catch (e: any) {
      log.error('createCreditNote failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function deleteCreditNote(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    log.info('deleteCreditNote', { id })
    try {
      await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'creditNotes', id))
    } catch (e: any) {
      log.error('deleteCreditNote failed', { code: e.code, message: e.message })
      throw e
    }
  }

  // ---- Helpers ----

  function getInvoice(id: string): SalesInvoice | undefined {
    return invoices.value.find((i) => i.id === id)
  }

  function nextInvoiceNumber(): string {
    const numbers = invoices.value
      .map((i) => parseInt(i.number.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n))
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    return `INV-${String(max + 1).padStart(4, '0')}`
  }

  function nextQuoteNumber(): string {
    const numbers = quotes.value
      .map((q) => parseInt(q.number.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n))
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    return `QUO-${String(max + 1).padStart(4, '0')}`
  }

  function nextCreditNoteNumber(): string {
    const numbers = creditNotes.value
      .map((c) => parseInt(c.number.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n))
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    return `CN-${String(max + 1).padStart(4, '0')}`
  }

  function customerBalance(customerId: string): number {
    let owed = 0
    for (const inv of invoices.value) {
      if (inv.customerId === customerId && inv.status !== 'void' && inv.status !== 'draft') {
        owed += inv.amountDue
      }
    }
    for (const cn of creditNotes.value) {
      if (cn.customerId === customerId) owed -= cn.total
    }
    return owed
  }

  function $reset() {
    unsubscribe()
    invoices.value = []
    quotes.value = []
    creditNotes.value = []
    receipts.value = []
    loading.value = false
  }

  return {
    invoices,
    quotes,
    creditNotes,
    receipts,
    loading,
    openInvoices,
    calcTotals,
    subscribe,
    unsubscribe,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    recordReceipt,
    createQuote,
    updateQuote,
    deleteQuote,
    convertQuoteToInvoice,
    createCreditNote,
    deleteCreditNote,
    getInvoice,
    nextInvoiceNumber,
    nextQuoteNumber,
    nextCreditNoteNumber,
    customerBalance,
    $reset,
  }
})
