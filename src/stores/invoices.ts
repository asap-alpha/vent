import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
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
import type { SalesInvoice, InvoiceLine, InvoiceStatus, Quote, CreditNote, Receipt } from '@/types/sales'

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

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) return
    unsubscribe()
    loading.value = true

    const orgPath = ['organizations', orgStore.orgId] as const

    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'salesInvoices'), orderBy('date', 'desc')),
        (snap) => {
          invoices.value = snap.docs.map((d) => mapDoc(d) as SalesInvoice)
          loading.value = false
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'quotes'), orderBy('date', 'desc')),
        (snap) => {
          quotes.value = snap.docs.map((d) => mapDoc(d) as Quote)
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'creditNotes'), orderBy('date', 'desc')),
        (snap) => {
          creditNotes.value = snap.docs.map((d) => mapDoc(d) as CreditNote)
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'receipts'), orderBy('date', 'desc')),
        (snap) => {
          receipts.value = snap.docs.map((d) => mapDoc(d) as Receipt)
        }
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

    const lines = recomputeLineAmounts(data.lines)
    const { subtotal, taxTotal, total } = calcTotals(lines)

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
        amountPaid: 0,
        amountDue: total,
        notes: data.notes,
        createdBy: authStore.user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    )
  }

  async function updateInvoice(id: string, data: Partial<SalesInvoice>) {
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
      const inv = invoices.value.find((i) => i.id === id)
      const paid = inv?.amountPaid || 0
      updateData.amountDue = total - paid
    }
    if (updateData.date instanceof Date) updateData.date = Timestamp.fromDate(updateData.date)
    if (updateData.dueDate instanceof Date) updateData.dueDate = Timestamp.fromDate(updateData.dueDate)

    await updateDoc(
      doc(db, 'organizations', orgStore.orgId, 'salesInvoices', id),
      updateData
    )
  }

  async function deleteInvoice(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'salesInvoices', id))
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

    // Create receipt
    await addDoc(collection(db, 'organizations', orgStore.orgId, 'receipts'), {
      customerId: data.customerId,
      invoiceId: data.invoiceId,
      date: Timestamp.fromDate(data.date),
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      notes: data.notes,
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
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'quotes', id), updateData)
  }

  async function deleteQuote(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'quotes', id))
  }

  async function convertQuoteToInvoice(quoteId: string, dueDate: Date, invoiceNumber: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const quote = quotes.value.find((q) => q.id === quoteId)
    if (!quote) throw new Error('Quote not found')

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
  }

  async function deleteCreditNote(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'creditNotes', id))
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
