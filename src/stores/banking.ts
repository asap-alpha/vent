import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, query, orderBy, Timestamp, writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import { useAuthStore } from './auth'
import type {
  BankAccount, BankAccountType, BankTransaction, BankTransactionType,
  Reconciliation, ReconciliationStatus,
} from '@/types/banking'

export const useBankingStore = defineStore('banking', () => {
  const accounts = ref<BankAccount[]>([])
  const transactions = ref<BankTransaction[]>([])
  const reconciliations = ref<Reconciliation[]>([])
  const loading = ref(false)
  const subs: Unsubscribe[] = []

  const activeAccounts = computed(() => accounts.value.filter((a) => a.isActive))

  function getAccount(id: string): BankAccount | undefined {
    return accounts.value.find((a) => a.id === id)
  }

  function transactionsFor(bankAccountId: string): BankTransaction[] {
    return transactions.value
      .filter((t) => t.bankAccountId === bankAccountId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }

  function currentBalance(bankAccountId: string): number {
    const account = getAccount(bankAccountId)
    if (!account) return 0
    let balance = account.openingBalance
    for (const txn of transactions.value) {
      if (txn.bankAccountId !== bankAccountId) continue
      if (txn.type === 'deposit') balance += txn.amount
      else balance -= txn.amount // withdrawal & transfer outflow
    }
    return balance
  }

  function mapDoc(d: any) {
    const data = d.data()
    const out: any = { id: d.id, ...data }
    for (const key of ['date', 'createdAt', 'updatedAt', 'completedAt']) {
      if (data[key]?.toDate) out[key] = data[key].toDate()
    }
    return out
  }

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) return
    unsubscribe()
    loading.value = true
    const orgPath = ['organizations', orgStore.orgId] as const

    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'bankAccounts'), orderBy('name')),
        (snap) => {
          accounts.value = snap.docs.map((d) => mapDoc(d) as BankAccount)
          loading.value = false
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'bankTransactions'), orderBy('date', 'desc')),
        (snap) => {
          transactions.value = snap.docs.map((d) => mapDoc(d) as BankTransaction)
        }
      )
    )
    subs.push(
      onSnapshot(
        query(collection(db, ...orgPath, 'reconciliations'), orderBy('date', 'desc')),
        (snap) => {
          reconciliations.value = snap.docs.map((d) => mapDoc(d) as Reconciliation)
        }
      )
    )
  }

  function unsubscribe() {
    while (subs.length) subs.pop()?.()
  }

  // ---- Accounts ----

  async function createAccount(data: {
    name: string
    accountNumber: string
    bankName: string
    currency: string
    type: BankAccountType
    openingBalance: number
    isActive: boolean
  }) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await addDoc(collection(db, 'organizations', orgStore.orgId, 'bankAccounts'), {
      ...data,
      currentBalance: data.openingBalance,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updateAccount(id: string, data: Partial<BankAccount>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const { id: _id, createdAt, ...updateData } = data as any
    void _id; void createdAt
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'bankAccounts', id), {
      ...updateData,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteAccount(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'bankAccounts', id))
  }

  // ---- Transactions ----

  async function recordTransaction(data: {
    bankAccountId: string
    date: Date
    type: 'deposit' | 'withdrawal'
    amount: number
    payee: string
    reference: string
    description: string
    category: string
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')
    if (data.amount <= 0) throw new Error('Amount must be positive')

    await addDoc(collection(db, 'organizations', orgStore.orgId, 'bankTransactions'), {
      bankAccountId: data.bankAccountId,
      date: Timestamp.fromDate(data.date),
      type: data.type,
      amount: data.amount,
      payee: data.payee,
      reference: data.reference,
      description: data.description,
      category: data.category,
      reconciled: false,
      journalEntryId: null,
      transferAccountId: null,
      createdBy: authStore.user.uid,
      createdAt: serverTimestamp(),
    })
  }

  async function recordTransfer(data: {
    fromAccountId: string
    toAccountId: string
    date: Date
    amount: number
    reference: string
    description: string
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')
    if (data.amount <= 0) throw new Error('Amount must be positive')
    if (data.fromAccountId === data.toAccountId) throw new Error('From and To must differ')

    const fromAccount = getAccount(data.fromAccountId)
    const toAccount = getAccount(data.toAccountId)
    if (!fromAccount || !toAccount) throw new Error('Account not found')

    const batch = writeBatch(db)
    const txnsRef = collection(db, 'organizations', orgStore.orgId, 'bankTransactions')

    const outRef = doc(txnsRef)
    batch.set(outRef, {
      bankAccountId: data.fromAccountId,
      date: Timestamp.fromDate(data.date),
      type: 'transfer',
      amount: data.amount,
      payee: `Transfer to ${toAccount.name}`,
      reference: data.reference,
      description: data.description,
      category: 'Transfer',
      reconciled: false,
      journalEntryId: null,
      transferAccountId: data.toAccountId,
      createdBy: authStore.user.uid,
      createdAt: serverTimestamp(),
    })

    const inRef = doc(txnsRef)
    batch.set(inRef, {
      bankAccountId: data.toAccountId,
      date: Timestamp.fromDate(data.date),
      type: 'deposit',
      amount: data.amount,
      payee: `Transfer from ${fromAccount.name}`,
      reference: data.reference,
      description: data.description,
      category: 'Transfer',
      reconciled: false,
      journalEntryId: null,
      transferAccountId: data.fromAccountId,
      createdBy: authStore.user.uid,
      createdAt: serverTimestamp(),
    })

    await batch.commit()
  }

  async function deleteTransaction(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'bankTransactions', id))
  }

  async function importTransactions(
    bankAccountId: string,
    rows: Array<{
      date: Date
      type: BankTransactionType
      amount: number
      payee: string
      reference: string
      description: string
    }>
  ) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')
    if (rows.length === 0) return

    const batch = writeBatch(db)
    const txnsRef = collection(db, 'organizations', orgStore.orgId, 'bankTransactions')
    for (const row of rows) {
      const ref = doc(txnsRef)
      batch.set(ref, {
        bankAccountId,
        date: Timestamp.fromDate(row.date),
        type: row.type,
        amount: row.amount,
        payee: row.payee,
        reference: row.reference,
        description: row.description,
        category: '',
        reconciled: false,
        journalEntryId: null,
        transferAccountId: null,
        createdBy: authStore.user.uid,
        createdAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }

  // ---- Reconciliation ----

  async function startReconciliation(data: {
    bankAccountId: string
    date: Date
    statementBalance: number
  }) {
    const orgStore = useOrganizationStore()
    const authStore = useAuthStore()
    if (!orgStore.orgId || !authStore.user) throw new Error('Not authenticated')

    const ref = await addDoc(
      collection(db, 'organizations', orgStore.orgId, 'reconciliations'),
      {
        bankAccountId: data.bankAccountId,
        date: Timestamp.fromDate(data.date),
        statementBalance: data.statementBalance,
        reconciledBalance: 0,
        difference: data.statementBalance,
        reconciledTransactionIds: [],
        status: 'in_progress' as ReconciliationStatus,
        completedAt: null,
        createdBy: authStore.user.uid,
        createdAt: serverTimestamp(),
      }
    )
    return ref.id
  }

  async function toggleTransactionReconciled(transactionId: string, reconciled: boolean) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await updateDoc(
      doc(db, 'organizations', orgStore.orgId, 'bankTransactions', transactionId),
      { reconciled }
    )
  }

  async function completeReconciliation(reconciliationId: string, reconciledBalance: number, txnIds: string[]) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const rec = reconciliations.value.find((r) => r.id === reconciliationId)
    if (!rec) throw new Error('Reconciliation not found')
    await updateDoc(
      doc(db, 'organizations', orgStore.orgId, 'reconciliations', reconciliationId),
      {
        status: 'completed',
        reconciledBalance,
        difference: rec.statementBalance - reconciledBalance,
        reconciledTransactionIds: txnIds,
        completedAt: serverTimestamp(),
      }
    )
  }

  function $reset() {
    unsubscribe()
    accounts.value = []
    transactions.value = []
    reconciliations.value = []
    loading.value = false
  }

  return {
    accounts, transactions, reconciliations, loading,
    activeAccounts, getAccount, transactionsFor, currentBalance,
    subscribe, unsubscribe,
    createAccount, updateAccount, deleteAccount,
    recordTransaction, recordTransfer, deleteTransaction, importTransactions,
    startReconciliation, toggleTransactionReconciled, completeReconciliation,
    $reset,
  }
})
