export type BankAccountType = 'bank' | 'cash' | 'credit_card'

export interface BankAccount {
  id: string
  name: string
  accountNumber: string
  bankName: string
  currency: string
  type: BankAccountType
  openingBalance: number
  currentBalance: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type BankTransactionType = 'deposit' | 'withdrawal' | 'transfer'

export interface BankTransaction {
  id: string
  bankAccountId: string
  date: Date
  type: BankTransactionType
  amount: number
  payee: string
  reference: string
  description: string
  category: string
  reconciled: boolean
  journalEntryId: string | null
  transferAccountId: string | null
  createdBy: string
  createdAt: Date
}

export type ReconciliationStatus = 'in_progress' | 'completed'

export interface Reconciliation {
  id: string
  bankAccountId: string
  date: Date
  statementBalance: number
  reconciledBalance: number
  difference: number
  reconciledTransactionIds: string[]
  status: ReconciliationStatus
  completedAt: Date | null
  createdBy: string
  createdAt: Date
}
