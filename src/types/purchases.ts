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
  createdBy: string
  createdAt: Date
}
