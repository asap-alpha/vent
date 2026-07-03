import type { TaxLine } from './tax'

export interface Supplier {
  id: string
  name: string
  email: string
  phone: string
  address: string
  taxId: string
  balance: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BillLine {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  amount: number
  /**
   * Expense (or asset) account this line posts to. Optional for backward
   * compatibility; the posting engine falls back to the `purchases` system
   * account when absent.
   */
  accountId?: string
  /** Tax code applied to this line; `taxRate` holds its derived effective rate. */
  taxCodeId?: string
}

export type BillStatus = 'draft' | 'received' | 'paid' | 'partially_paid' | 'overdue' | 'void'

export interface PurchaseInvoice {
  id: string
  supplierId: string
  supplierName?: string
  number: string
  date: Date
  dueDate: Date
  status: BillStatus
  lines: BillLine[]
  subtotal: number
  taxTotal: number
  total: number
  /** Tax grouped by liability account (from tax codes); drives GL tax posting. */
  taxLines?: TaxLine[]
  amountPaid: number
  amountDue: number
  notes: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'closed' | 'cancelled' | 'converted'

export interface PurchaseOrder {
  id: string
  supplierId: string
  supplierName?: string
  number: string
  date: Date
  status: PurchaseOrderStatus
  lines: BillLine[]
  subtotal: number
  taxTotal: number
  total: number
  notes: string
  convertedBillId: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface DebitNote {
  id: string
  supplierId: string
  supplierName?: string
  billId: string
  number: string
  date: Date
  lines: BillLine[]
  subtotal: number
  taxTotal: number
  total: number
  notes: string
  createdBy: string
  createdAt: Date
}

export interface Payment {
  id: string
  supplierId: string
  billId: string
  date: Date
  amount: number
  method: string
  reference: string
  notes: string
  /** 'void' when reversed (e.g. its bill was voided); absent/'active' otherwise. A voided payment keeps its record but posts no GL entry. */
  status?: 'active' | 'void'
  createdBy: string
  createdAt: Date
}
