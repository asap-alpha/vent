import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import { logger } from '@/utils/logger'
import type { Account, AccountType, SystemAccountType } from '@/types/accounting'

const log = logger('accounts')

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsub: Unsubscribe | null = null

  const activeAccounts = computed(() => accounts.value.filter((a) => a.isActive))

  const accountsByType = computed(() => {
    const groups: Record<AccountType, Account[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    }
    for (const acc of accounts.value) groups[acc.type].push(acc)
    return groups
  })

  function getAccount(id: string): Account | undefined {
    return accounts.value.find((a) => a.id === id)
  }

  /** Resolve a tagged control/system account (AR, AP, tax, default sales/purchases…). */
  function getSystemAccount(systemType: SystemAccountType): Account | undefined {
    return accounts.value.find((a) => a.systemType === systemType)
  }

  /** Whether the org's chart of accounts has been seeded yet. */
  const hasChartOfAccounts = computed(() => accounts.value.length > 0)

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) {
      log.warn('subscribe() skipped — no org')
      return
    }
    unsubscribe()
    log.info('Subscribing to accounts', { orgId: orgStore.orgId })
    loading.value = true

    const q = query(
      collection(db, 'organizations', orgStore.orgId, 'accounts'),
      orderBy('code')
    )
    unsub = onSnapshot(
      q,
      (snap) => {
        accounts.value = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Account
        })
        log.debug('Accounts snapshot', { count: accounts.value.length })
        loading.value = false
      },
      (err) => {
        log.error('Accounts subscription error', { code: err.code, message: err.message })
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

  async function createAccount(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'balance'>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')

    log.info('Creating account', { code: data.code, name: data.name, type: data.type })
    try {
      const ref = await addDoc(collection(db, 'organizations', orgStore.orgId, 'accounts'), {
        ...data,
        balance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      log.info('Account created', { id: ref.id })
    } catch (e: any) {
      log.error('createAccount failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function updateAccount(id: string, data: Partial<Account>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')

    const { id: _id, createdAt, ...updateData } = data as any
    void _id
    void createdAt
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'accounts', id), {
      ...updateData,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteAccount(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')

    // Never hard-delete an account that has journal activity. Its posted lines would
    // be orphaned — still counted on their counter-account side but dropped from this
    // account — silently unbalancing the Trial Balance, Balance Sheet and Cash Flow.
    // A one-shot read (not the live store) so the guard holds even if the transactions
    // store isn't subscribed on the caller's page. Deactivate the account instead.
    const snap = await getDocs(collection(db, 'organizations', orgStore.orgId, 'journalEntries'))
    const inUse = snap.docs.some((d) =>
      ((d.data().lines as Array<{ accountId?: string }>) || []).some((l) => l.accountId === id)
    )
    if (inUse) {
      throw new Error('This account has journal entries and cannot be deleted. Deactivate it instead.')
    }

    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'accounts', id))
  }

  // Kept for the "seed default accounts" action on an empty org. Mirrors the
  // server-side DEFAULT_CHART (functions/src/chartOfAccounts.ts) INCLUDING the
  // systemType control-account tags the posting engine relies on. New orgs are
  // auto-seeded by the onOrganizationCreated Cloud Function, so this is mainly a
  // manual fallback — guarded so it can't duplicate an existing chart.
  async function seedDefaultAccounts() {
    if (accounts.value.length > 0) {
      log.warn('seedDefaultAccounts skipped — chart already exists')
      return
    }
    const cur = useOrganizationStore().currentOrg?.currency || 'GHS'
    const base = { parentId: null, currency: cur, isActive: true, description: '' } as const
    const defaults: Array<Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'balance'>> = [
      { ...base, code: '1000', name: 'Cash on Hand', type: 'asset' },
      { ...base, code: '1010', name: 'Bank Account', type: 'asset', systemType: 'bank' },
      { ...base, code: '1100', name: 'Accounts Receivable', type: 'asset', systemType: 'accounts_receivable' },
      { ...base, code: '1200', name: 'Inventory', type: 'asset' },
      { ...base, code: '1400', name: 'Fixed Assets', type: 'asset' },
      { ...base, code: '1450', name: 'Accumulated Depreciation', type: 'asset' },
      { ...base, code: '2000', name: 'Accounts Payable', type: 'liability', systemType: 'accounts_payable' },
      { ...base, code: '2100', name: 'VAT Payable', type: 'liability', systemType: 'tax_payable' },
      { ...base, code: '2110', name: 'NHIL Payable', type: 'liability' },
      { ...base, code: '2120', name: 'GETFund Levy Payable', type: 'liability' },
      { ...base, code: '2130', name: 'COVID-19 Levy Payable', type: 'liability' },
      { ...base, code: '2200', name: 'Accrued Liabilities', type: 'liability' },
      { ...base, code: '3000', name: "Owner's Equity", type: 'equity' },
      { ...base, code: '3100', name: 'Retained Earnings', type: 'equity', systemType: 'retained_earnings' },
      { ...base, code: '3200', name: 'Opening Balance Equity', type: 'equity', systemType: 'opening_balance_equity' },
      { ...base, code: '4000', name: 'Sales Revenue', type: 'revenue', systemType: 'sales' },
      { ...base, code: '4100', name: 'Other Income', type: 'revenue' },
      { ...base, code: '4900', name: 'Exchange Gain/Loss', type: 'revenue', systemType: 'exchange_gain_loss' },
      { ...base, code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
      { ...base, code: '6000', name: 'General Expenses', type: 'expense', systemType: 'purchases' },
      { ...base, code: '6100', name: 'Rent', type: 'expense' },
      { ...base, code: '6200', name: 'Utilities', type: 'expense' },
      { ...base, code: '6300', name: 'Salaries & Wages', type: 'expense' },
      { ...base, code: '6400', name: 'Bank Charges', type: 'expense' },
      { ...base, code: '6500', name: 'Office Supplies', type: 'expense' },
    ]

    for (const acc of defaults) {
      await createAccount(acc)
    }
  }

  function $reset() {
    unsubscribe()
    accounts.value = []
    loading.value = false
    error.value = null
  }

  return {
    accounts,
    loading,
    error,
    activeAccounts,
    accountsByType,
    hasChartOfAccounts,
    getAccount,
    getSystemAccount,
    subscribe,
    unsubscribe,
    createAccount,
    updateAccount,
    deleteAccount,
    seedDefaultAccounts,
    $reset,
  }
})
