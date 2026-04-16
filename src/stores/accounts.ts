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
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import { logger } from '@/utils/logger'
import type { Account, AccountType } from '@/types/accounting'

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
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'accounts', id))
  }

  async function seedDefaultAccounts() {
    const defaults: Array<Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'balance'>> = [
      // Assets
      { code: '1000', name: 'Cash on Hand', type: 'asset', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '1010', name: 'Bank Account', type: 'asset', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '1100', name: 'Accounts Receivable', type: 'asset', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '1200', name: 'Inventory', type: 'asset', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '1500', name: 'Equipment', type: 'asset', parentId: null, currency: 'GHS', isActive: true, description: '' },
      // Liabilities
      { code: '2000', name: 'Accounts Payable', type: 'liability', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '2100', name: 'Tax Payable', type: 'liability', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '2200', name: 'Loans Payable', type: 'liability', parentId: null, currency: 'GHS', isActive: true, description: '' },
      // Equity
      { code: '3000', name: 'Owner Equity', type: 'equity', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '3100', name: 'Retained Earnings', type: 'equity', parentId: null, currency: 'GHS', isActive: true, description: '' },
      // Revenue
      { code: '4000', name: 'Sales Revenue', type: 'revenue', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '4100', name: 'Service Revenue', type: 'revenue', parentId: null, currency: 'GHS', isActive: true, description: '' },
      // Expenses
      { code: '5000', name: 'Cost of Goods Sold', type: 'expense', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '6000', name: 'Salaries Expense', type: 'expense', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '6100', name: 'Rent Expense', type: 'expense', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '6200', name: 'Utilities Expense', type: 'expense', parentId: null, currency: 'GHS', isActive: true, description: '' },
      { code: '6300', name: 'Office Supplies', type: 'expense', parentId: null, currency: 'GHS', isActive: true, description: '' },
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
    getAccount,
    subscribe,
    unsubscribe,
    createAccount,
    updateAccount,
    deleteAccount,
    seedDefaultAccounts,
    $reset,
  }
})
