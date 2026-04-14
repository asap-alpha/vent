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
  createdBy: string
  createdAt: Date
}
