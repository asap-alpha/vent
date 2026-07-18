import type { TaxLine } from './tax'

export interface Customer {
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

export interface InvoiceLine {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  amount: number
  /**
   * Income account this line posts to (a `revenue` account). Optional for backward
   * compatibility with old data; the posting engine falls back to the `sales`
   * system account when absent.
   */
  accountId?: string
  /** Tax code applied to this line; `taxRate` holds its derived effective rate. */
  taxCodeId?: string
  /** Catalog item this line was created from (set when an item is picked). */
  itemId?: string
  /**
   * Total cost of goods sold for this line — server-stamped by the inventory
   * recompute engine for inventory-item sales, at weighted-average cost. Absent/0
   * means no COGS leg is posted. Clients never set this.
   */
  cost?: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'void'

export interface SalesInvoice {
  id: string
  customerId: string
  customerName?: string
  number: string
  date: Date
  dueDate: Date
  status: InvoiceStatus
  lines: InvoiceLine[]
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

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted'

export interface Quote {
  id: string
  customerId: string
  customerName?: string
  number: string
  date: Date
  expiryDate: Date
  status: QuoteStatus
  lines: InvoiceLine[]
  subtotal: number
  taxTotal: number
  total: number
  notes: string
  convertedInvoiceId: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface CreditNote {
  id: string
  customerId: string
  customerName?: string
  invoiceId: string
  number: string
  date: Date
  lines: InvoiceLine[]
  subtotal: number
  taxTotal: number
  total: number
  notes: string
  createdBy: string
  createdAt: Date
}

export interface Receipt {
  id: string
  customerId: string
  invoiceId: string
  date: Date
  amount: number
  method: string
  reference: string
  notes: string
  /** 'void' when reversed (e.g. its invoice was voided); absent/'active' otherwise. A voided receipt keeps its record but posts no GL entry. */
  status?: 'active' | 'void'
  createdBy: string
  createdAt: Date
}
