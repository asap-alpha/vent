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
import type { Customer } from '@/types/sales'

export const useCustomersStore = defineStore('customers', () => {
  const customers = ref<Customer[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsub: Unsubscribe | null = null

  const activeCustomers = computed(() => customers.value.filter((c) => c.isActive))

  function getCustomer(id: string): Customer | undefined {
    return customers.value.find((c) => c.id === id)
  }

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) return
    unsubscribe()
    loading.value = true
    const q = query(
      collection(db, 'organizations', orgStore.orgId, 'customers'),
      orderBy('name')
    )
    unsub = onSnapshot(q, (snap) => {
      customers.value = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Customer
      })
      loading.value = false
    })
  }

  function unsubscribe() {
    if (unsub) {
      unsub()
      unsub = null
    }
  }

  async function createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'balance'>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await addDoc(collection(db, 'organizations', orgStore.orgId, 'customers'), {
      ...data,
      balance: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updateCustomer(id: string, data: Partial<Customer>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const { id: _id, createdAt, ...updateData } = data as any
    void _id; void createdAt
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'customers', id), {
      ...updateData,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteCustomer(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'customers', id))
  }

  function $reset() {
    unsubscribe()
    customers.value = []
    loading.value = false
    error.value = null
  }

  return {
    customers,
    loading,
    error,
    activeCustomers,
    getCustomer,
    subscribe,
    unsubscribe,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    $reset,
  }
})
