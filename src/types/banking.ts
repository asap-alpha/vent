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
  /**
   * The general-ledger asset account this bank account posts to. Optional for
   * backward compatibility; the posting engine falls back to the `bank` system
   * account when absent.
   */
  glAccountId?: string
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
  /**
   * Contra GL account for this transaction (the account on the other side of the
   * cash movement — an income account for a deposit, an expense account for a
   * withdrawal). Without it the transaction can't be posted to the ledger.
   */
  categoryAccountId?: string
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
