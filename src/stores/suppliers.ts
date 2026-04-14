import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, query, orderBy, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import type { Supplier } from '@/types/purchases'

export const useSuppliersStore = defineStore('suppliers', () => {
  const suppliers = ref<Supplier[]>([])
  const loading = ref(false)
  let unsub: Unsubscribe | null = null

  const activeSuppliers = computed(() => suppliers.value.filter((s) => s.isActive))

  function getSupplier(id: string): Supplier | undefined {
    return suppliers.value.find((s) => s.id === id)
  }

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) return
    unsubscribe()
    loading.value = true
    const q = query(
      collection(db, 'organizations', orgStore.orgId, 'suppliers'),
      orderBy('name')
    )
    unsub = onSnapshot(q, (snap) => {
      suppliers.value = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Supplier
      })
      loading.value = false
    })
  }

  function unsubscribe() {
    if (unsub) { unsub(); unsub = null }
  }

  async function createSupplier(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'balance'>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await addDoc(collection(db, 'organizations', orgStore.orgId, 'suppliers'), {
      ...data,
      balance: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updateSupplier(id: string, data: Partial<Supplier>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const { id: _id, createdAt, ...updateData } = data as any
    void _id; void createdAt
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'suppliers', id), {
      ...updateData,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteSupplier(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'suppliers', id))
  }

  function $reset() {
    unsubscribe()
    suppliers.value = []
    loading.value = false
  }

  return {
    suppliers, loading, activeSuppliers,
    getSupplier, subscribe, unsubscribe,
    createSupplier, updateSupplier, deleteSupplier, $reset,
  }
})
