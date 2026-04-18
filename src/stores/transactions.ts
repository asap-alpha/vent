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
import { useAccountsStore } from './accounts'
import { isBalanced, totalDebits, totalCredits } from '@/utils/accounting'
import type { JournalEntry, JournalLine, LedgerEntry, TrialBalanceRow, AccountType } from '@/types/accounting'
import { logger } from '@/utils/logger'

const log = logger('transactions')

export const useTransactionsStore = defineStore('transactions', () => {
  const entries = ref<JournalEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsub: Unsubscribe | null = null

  const postedEntries = computed(() =>
    entries.value.filter((e) => e.status === 'posted')
  )

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) {
      log.warn('subscribe() skipped — no org')
      return
    }
    log.info('Subscribing to journalEntries')
    unsubscribe()
    loading.value = true

    const q = query(
      collection(db, 'organizations', orgStore.orgId, 'journalEntries'),
      orderBy('date', 'desc')
    )
    unsub = onSnapshot(
      q,
      (snap) => {
        entries.value = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            date: data.date?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as JournalEntry
        })
        log.debug('journalEntries snapshot', { count: entries.value.length })
        loading.value = false
      },
      (err) => {
        log.error('journalEntries subscription error', { code: err.code, message: err.message })
        error.value = err.message
        loading.value = false
      }
    )
  }

  function unsubscribe() {
    if (unsub) {
      unsub()
      unsub = null
    }
  }

  async function createEntry(data: {
    date: Date
    reference: string
    memo: string
    lines: JournalLine[]
    status?: 'draft' | 'posted'
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    if (data.status === 'posted' && !isBalanced(data.lines)) {
      throw new Error(
        `Entry is not balanced. Debits: ${totalDebits(data.lines)}, Credits: ${totalCredits(data.lines)}`
      )
    }
    if (data.lines.length < 2) {
      throw new Error('At least 2 lines required for a journal entry')
    }

    log.info('createEntry', { reference: data.reference, status: data.status || 'draft', lineCount: data.lines.length })
    try {
      await addDoc(
        collection(db, 'organizations', orgStore.orgId, 'journalEntries'),
        {
          date: Timestamp.fromDate(data.date),
          reference: data.reference,
          memo: data.memo,
          lines: data.lines,
          status: data.status || 'draft',
          createdBy: authStore.user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      )
    } catch (e: any) {
      log.error('createEntry failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function updateEntry(id: string, data: Partial<JournalEntry>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')

    if (data.status === 'posted' && data.lines && !isBalanced(data.lines)) {
      throw new Error('Entry is not balanced')
    }

    const updateData: any = { ...data, updatedAt: serverTimestamp() }
    delete updateData.id
    delete updateData.createdAt
    if (updateData.date instanceof Date) {
      updateData.date = Timestamp.fromDate(updateData.date)
    }

    log.info('updateEntry', { id, status: data.status })
    try {
      await updateDoc(
        doc(db, 'organizations', orgStore.orgId, 'journalEntries', id),
        updateData
      )
    } catch (e: any) {
      log.error('updateEntry failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function deleteEntry(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    log.info('deleteEntry', { id })
    try {
      await deleteDoc(
        doc(db, 'organizations', orgStore.orgId, 'journalEntries', id)
      )
    } catch (e: any) {
      log.error('deleteEntry failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function postEntry(id: string) {
    await updateEntry(id, { status: 'posted' })
  }

  async function reverseEntry(id: string) {
    await updateEntry(id, { status: 'reversed' })
  }

  // ---- Reporting derivations ----

  /**
   * Compute the balance of an account from all posted entries.
   * For asset/expense: balance = debits - credits
   * For liability/equity/revenue: balance = credits - debits
   */
  function getAccountBalance(accountId: string, asOf?: Date): number {
    const accountsStore = useAccountsStore()
    const account = accountsStore.getAccount(accountId)
    if (!account) return 0

    let debits = 0
    let credits = 0
    for (const entry of postedEntries.value) {
      if (asOf && entry.date > asOf) continue
      for (const line of entry.lines) {
        if (line.accountId === accountId) {
          debits += line.debit || 0
          credits += line.credit || 0
        }
      }
    }

    if (account.type === 'asset' || account.type === 'expense') {
      return debits - credits
    }
    return credits - debits
  }

  /**
   * Get ledger entries for a given account, optionally filtered by date.
   */
  function getLedger(accountId: string, from?: Date, to?: Date): LedgerEntry[] {
    const accountsStore = useAccountsStore()
    const account = accountsStore.getAccount(accountId)
    if (!account) return []

    const isDebitNormal = account.type === 'asset' || account.type === 'expense'
    const ledger: LedgerEntry[] = []
    let runningBalance = 0

    // Sort entries chronologically (oldest first) for running balance
    const chronological = [...postedEntries.value].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )

    for (const entry of chronological) {
      if (from && entry.date < from) {
        // include in opening balance
        for (const line of entry.lines) {
          if (line.accountId === accountId) {
            runningBalance += isDebitNormal
              ? (line.debit || 0) - (line.credit || 0)
              : (line.credit || 0) - (line.debit || 0)
          }
        }
        continue
      }
      if (to && entry.date > to) continue

      for (const line of entry.lines) {
        if (line.accountId === accountId) {
          runningBalance += isDebitNormal
            ? (line.debit || 0) - (line.credit || 0)
            : (line.credit || 0) - (line.debit || 0)
          ledger.push({
            date: entry.date,
            reference: entry.reference,
            description: line.description || entry.memo,
            debit: line.debit || 0,
            credit: line.credit || 0,
            balance: runningBalance,
            journalEntryId: entry.id,
          })
        }
      }
    }

    return ledger
  }

  /**
   * Get the trial balance — total debits and credits per account.
   */
  function getTrialBalance(asOf?: Date): TrialBalanceRow[] {
    const accountsStore = useAccountsStore()
    const rows: TrialBalanceRow[] = []

    for (const account of accountsStore.activeAccounts) {
      let debits = 0
      let credits = 0
      for (const entry of postedEntries.value) {
        if (asOf && entry.date > asOf) continue
        for (const line of entry.lines) {
          if (line.accountId === account.id) {
            debits += line.debit || 0
            credits += line.credit || 0
          }
        }
      }
      const isDebitNormal = account.type === 'asset' || account.type === 'expense'
      const balance = isDebitNormal ? debits - credits : credits - debits

      if (Math.abs(balance) < 0.005 && debits === 0 && credits === 0) continue

      rows.push({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit: isDebitNormal ? Math.max(balance, 0) : 0,
        credit: !isDebitNormal ? Math.max(balance, 0) : 0,
      })
    }

    return rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
  }

  /**
   * Sum balances of all accounts of a given type, within optional date range.
   * For revenue/expense, supports a `from` date for period reports (P&L).
   */
  function sumByType(type: AccountType, from?: Date, to?: Date): number {
    const accountsStore = useAccountsStore()
    let total = 0
    for (const account of accountsStore.accounts) {
      if (account.type !== type) continue
      const isDebitNormal = type === 'asset' || type === 'expense'
      let debits = 0
      let credits = 0
      for (const entry of postedEntries.value) {
        if (from && entry.date < from) continue
        if (to && entry.date > to) continue
        for (const line of entry.lines) {
          if (line.accountId === account.id) {
            debits += line.debit || 0
            credits += line.credit || 0
          }
        }
      }
      total += isDebitNormal ? debits - credits : credits - debits
    }
    return total
  }

  function $reset() {
    unsubscribe()
    entries.value = []
    loading.value = false
    error.value = null
  }

  return {
    entries,
    postedEntries,
    loading,
    error,
    subscribe,
    unsubscribe,
    createEntry,
    updateEntry,
    deleteEntry,
    postEntry,
    reverseEntry,
    getAccountBalance,
    getLedger,
    getTrialBalance,
    sumByType,
    $reset,
  }
})
