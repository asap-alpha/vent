import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, query, orderBy, Timestamp, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import { useAuthStore } from './auth'
import type {
  PurchaseInvoice, BillLine, BillStatus,
  PurchaseOrder, DebitNote, Payment,
} from '@/types/purchases'

export const useBillsStore = defineStore('bills', () => {
  const bills = ref<PurchaseInvoice[]>([])
  const purchaseOrders = ref<PurchaseOrder[]>([])
  const debitNotes = ref<DebitNote[]>([])
  const payments = ref<Payment[]>([])
  const loading = ref(false)
  const subs: Unsubscribe[] = []

  const openBills = computed(() =>
    bills.value.filter((b) => b.status !== 'paid' && b.status !== 'void' && b.status !== 'draft')
  )

  function calcTotals(lines: BillLine[]) {
    let subtotal = 0, taxTotal = 0
    for (const l of lines) {
      const sub = (l.quantity || 0) * (l.unitPrice || 0)
      const tax = sub * ((l.taxRate || 0) / 100)
      subtotal += sub; taxTotal += tax
    }
    return { subtotal, taxTotal, total: subtotal + taxTotal }
  }

  function recomputeLines(lines: BillLine[]): BillLine[] {
    return lines.map((l) => {
      const sub = (l.quantity || 0) * (l.unitPrice || 0)
      const tax = sub * ((l.taxRate || 0) / 100)
      return { ...l, amount: sub + tax }
    })
  }

  function mapDoc(d: any) {
    const data = d.data()
    const out: any = { id: d.id, ...data }
    for (const key of ['date', 'dueDate', 'createdAt', 'updatedAt']) {
      if (data[key]?.toDate) out[key] = data[key].toDate()
    }
    return out
  }

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) return
    unsubscribe()
    loading.value = true
    const orgPath = ['organizations', orgStore.orgId] as const

    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'purchaseInvoices'), orderBy('date', 'desc')),
        (snap) => {
          bills.value = snap.docs.map((d) => mapDoc(d) as PurchaseInvoice)
          loading.value = false
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'purchaseOrders'), orderBy('date', 'desc')),
        (snap) => {
          purchaseOrders.value = snap.docs.map((d) => mapDoc(d) as PurchaseOrder)
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'debitNotes'), orderBy('date', 'desc')),
        (snap) => {
          debitNotes.value = snap.docs.map((d) => mapDoc(d) as DebitNote)
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'payments'), orderBy('date', 'desc')),
        (snap) => {
          payments.value = snap.docs.map((d) => mapDoc(d) as Payment)
        }
      )
    )
  }

  function unsubscribe() {
    while (subs.length) subs.pop()?.()
  }

  // ---- Bills ----

  async function createBill(data: {
    supplierId: string
    supplierName?: string
    number: string
    date: Date
    dueDate: Date
    lines: BillLine[]
    notes: string
    status?: BillStatus
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const lines = recomputeLines(data.lines)
    const { subtotal, taxTotal, total } = calcTotals(lines)

    await addDoc(collection(db, 'organizations', orgStore.orgId, 'purchaseInvoices'), {
      supplierId: data.supplierId,
      supplierName: data.supplierName || '',
      number: data.number,
      date: Timestamp.fromDate(data.date),
      dueDate: Timestamp.fromDate(data.dueDate),
      status: data.status || 'draft',
      lines, subtotal, taxTotal, total,
      amountPaid: 0,
      amountDue: total,
      notes: data.notes,
      createdBy: authStore.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updateBill(id: string, data: Partial<PurchaseInvoice>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const updateData: any = { ...data, updatedAt: serverTimestamp() }
    delete updateData.id
    delete updateData.createdAt
    if (updateData.lines) {
      updateData.lines = recomputeLines(updateData.lines)
      const { subtotal, taxTotal, total } = calcTotals(updateData.lines)
      updateData.subtotal = subtotal
      updateData.taxTotal = taxTotal
      updateData.total = total
      const bill = bills.value.find((b) => b.id === id)
      const paid = bill?.amountPaid || 0
      updateData.amountDue = total - paid
    }
    if (updateData.date instanceof Date) updateData.date = Timestamp.fromDate(updateData.date)
    if (updateData.dueDate instanceof Date) updateData.dueDate = Timestamp.fromDate(updateData.dueDate)
    await updateDoc(
      doc(db, 'organizations', orgStore.orgId, 'purchaseInvoices', id),
      updateData
    )
  }

  async function deleteBill(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'purchaseInvoices', id))
  }

  async function recordPayment(data: {
    supplierId: string
    billId: string
    date: Date
    amount: number
    method: string
    reference: string
    notes: string
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const bill = bills.value.find((b) => b.id === data.billId)
    if (!bill) throw new Error('Bill not found')
    if (data.amount <= 0) throw new Error('Amount must be positive')
    if (data.amount > bill.amountDue + 0.005) {
      throw new Error(`Amount exceeds amount due (${bill.amountDue})`)
    }

    await addDoc(collection(db, 'organizations', orgStore.orgId, 'payments'), {
      supplierId: data.supplierId,
      billId: data.billId,
      date: Timestamp.fromDate(data.date),
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      notes: data.notes,
      createdBy: authStore.user.uid,
      createdAt: serverTimestamp(),
    })

    const newPaid = bill.amountPaid + data.amount
    const newDue = bill.total - newPaid
    let newStatus: BillStatus = bill.status
    if (newDue < 0.005) newStatus = 'paid'
    else if (newPaid > 0) newStatus = 'partially_paid'

    await updateDoc(
      doc(db, 'organizations', orgStore.orgId, 'purchaseInvoices', data.billId),
      {
        amountPaid: newPaid,
        amountDue: Math.max(newDue, 0),
        status: newStatus,
        updatedAt: serverTimestamp(),
      }
    )
  }

  // ---- Purchase Orders ----

  async function createPO(data: {
    supplierId: string
    supplierName?: string
    number: string
    date: Date
    lines: BillLine[]
    notes: string
    status?: 'draft' | 'sent'
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const lines = recomputeLines(data.lines)
    const { subtotal, taxTotal, total } = calcTotals(lines)

    await addDoc(collection(db, 'organizations', orgStore.orgId, 'purchaseOrders'), {
      supplierId: data.supplierId,
      supplierName: data.supplierName || '',
      number: data.number,
      date: Timestamp.fromDate(data.date),
      status: data.status || 'draft',
      lines, subtotal, taxTotal, total,
      notes: data.notes,
      convertedBillId: null,
      createdBy: authStore.user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updatePO(id: string, data: Partial<PurchaseOrder>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const updateData: any = { ...data, updatedAt: serverTimestamp() }
    delete updateData.id
    delete updateData.createdAt
    if (updateData.lines) {
      updateData.lines = recomputeLines(updateData.lines)
      const { subtotal, taxTotal, total } = calcTotals(updateData.lines)
      updateData.subtotal = subtotal
      updateData.taxTotal = taxTotal
      updateData.total = total
    }
    if (updateData.date instanceof Date) updateData.date = Timestamp.fromDate(updateData.date)
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'purchaseOrders', id), updateData)
  }

  async function deletePO(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'purchaseOrders', id))
  }

  async function convertPOToBill(poId: string, dueDate: Date, billNumber: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const po = purchaseOrders.value.find((p) => p.id === poId)
    if (!po) throw new Error('Purchase Order not found')

    await createBill({
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      number: billNumber,
      date: new Date(),
      dueDate,
      lines: po.lines,
      notes: po.notes,
      status: 'received',
    })

    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'purchaseOrders', poId), {
      status: 'converted',
      updatedAt: serverTimestamp(),
    })
  }

  // ---- Debit Notes ----

  async function createDebitNote(data: {
    supplierId: string
    supplierName?: string
    billId: string
    number: string
    date: Date
    lines: BillLine[]
    notes: string
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const lines = recomputeLines(data.lines)
    const { subtotal, taxTotal, total } = calcTotals(lines)

    await addDoc(collection(db, 'organizations', orgStore.orgId, 'debitNotes'), {
      supplierId: data.supplierId,
      supplierName: data.supplierName || '',
      billId: data.billId,
      number: data.number,
      date: Timestamp.fromDate(data.date),
      lines, subtotal, taxTotal, total,
      notes: data.notes,
      createdBy: authStore.user.uid,
      createdAt: serverTimestamp(),
    })
  }

  async function deleteDebitNote(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'debitNotes', id))
  }

  // ---- Helpers ----

  function getBill(id: string): PurchaseInvoice | undefined {
    return bills.value.find((b) => b.id === id)
  }

  function nextBillNumber(): string {
    const numbers = bills.value
      .map((b) => parseInt(b.number.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n))
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    return `BILL-${String(max + 1).padStart(4, '0')}`
  }

  function nextPONumber(): string {
    const numbers = purchaseOrders.value
      .map((p) => parseInt(p.number.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n))
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    return `PO-${String(max + 1).padStart(4, '0')}`
  }

  function nextDebitNoteNumber(): string {
    const numbers = debitNotes.value
      .map((d) => parseInt(d.number.replace(/[^0-9]/g, ''), 10))
      .filter((n) => !isNaN(n))
    const max = numbers.length > 0 ? Math.max(...numbers) : 0
    return `DN-${String(max + 1).padStart(4, '0')}`
  }

  function supplierBalance(supplierId: string): number {
    let owed = 0
    for (const bill of bills.value) {
      if (bill.supplierId === supplierId && bill.status !== 'void' && bill.status !== 'draft') {
        owed += bill.amountDue
      }
    }
    for (const dn of debitNotes.value) {
      if (dn.supplierId === supplierId) owed -= dn.total
    }
    return owed
  }

  function $reset() {
    unsubscribe()
    bills.value = []
    purchaseOrders.value = []
    debitNotes.value = []
    payments.value = []
    loading.value = false
  }

  return {
    bills, purchaseOrders, debitNotes, payments,
    loading, openBills, calcTotals,
    subscribe, unsubscribe,
    createBill, updateBill, deleteBill, recordPayment,
    createPO, updatePO, deletePO, convertPOToBill,
    createDebitNote, deleteDebitNote,
    getBill, nextBillNumber, nextPONumber, nextDebitNoteNumber,
    supplierBalance, $reset,
  }
})
