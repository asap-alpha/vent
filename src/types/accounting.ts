export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  parentId: string | null
  currency: string
  isActive: boolean
  balance: number
  description: string
  createdAt: Date
  updatedAt: Date
}

export interface JournalLine {
  accountId: string
  accountName?: string
  debit: number
  credit: number
  description: string
}

export type JournalStatus = 'draft' | 'posted' | 'reversed'

export interface JournalEntry {
  id: string
  date: Date
  reference: string
  memo: string
  lines: JournalLine[]
  status: JournalStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface LedgerEntry {
  date: Date
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
  journalEntryId: string
}

export interface TrialBalanceRow {
  accountId: string
  accountCode: string
  accountName: string
  accountType: AccountType
  debit: number
  credit: number
}
