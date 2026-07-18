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
import type { Item } from '@/types/inventory'

const log = logger('items')

// Fields the inventory recompute engine owns — clients must never write them.
const MAINTAINED_FIELDS = ['qtyOnHand', 'avgCost', 'stockValue'] as const

export const useItemsStore = defineStore('items', () => {
  const items = ref<Item[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsub: Unsubscribe | null = null

  const activeItems = computed(() => items.value.filter((i) => i.isActive))
  const inventoryItems = computed(() => items.value.filter((i) => i.kind === 'inventory'))

  function getItem(id: string): Item | undefined {
    return items.value.find((i) => i.id === id)
  }

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) { log.warn('subscribe() skipped — no org'); return }
    unsubscribe()
    log.info('Subscribing to items')
    loading.value = true
    const q = query(
      collection(db, 'organizations', orgStore.orgId, 'items'),
      orderBy('name')
    )
    unsub = onSnapshot(
      q,
      (snap) => {
        items.value = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Item
        })
        log.debug('Items snapshot', { count: items.value.length })
        loading.value = false
      },
      (err) => log.error('Items subscription error', { code: err.code, message: err.message })
    )
  }

  function unsubscribe() {
    if (unsub) {
      unsub()
      unsub = null
    }
  }

  // Clean a client payload before writing: drop the engine-owned stock fields (the
  // recompute engine is the sole writer of qtyOnHand/avgCost/stockValue) and any
  // `undefined` values (e.g. inventory-only account fields on a service item) —
  // Firestore rejects undefined, so they must be omitted rather than sent.
  function cleanPayload(data: any): any {
    const out: any = {}
    for (const [k, v] of Object.entries(data)) {
      if ((MAINTAINED_FIELDS as readonly string[]).includes(k)) continue
      if (v === undefined) continue
      out[k] = v
    }
    return out
  }

  async function createItem(
    data: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'qtyOnHand' | 'avgCost' | 'stockValue'>
  ) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    log.info('Creating item', { name: data.name, kind: data.kind })
    try {
      const ref = await addDoc(collection(db, 'organizations', orgStore.orgId, 'items'), {
        ...cleanPayload(data),
        qtyOnHand: 0,
        avgCost: 0,
        stockValue: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      log.info('Item created', { id: ref.id })
    } catch (e: any) {
      log.error('createItem failed', { code: e.code, message: e.message })
      throw e
    }
  }

  async function updateItem(id: string, data: Partial<Item>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const { id: _id, createdAt, ...rest } = data as any
    void _id; void createdAt
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'items', id), {
      ...cleanPayload(rest),
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteItem(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')

    // Refuse to delete an item that has stock movements — deleting it would orphan
    // the itemId on posted invoice/bill lines and break inventory recompute. A
    // one-shot read across the subledger, robust regardless of subscription state.
    const orgPath = ['organizations', orgStore.orgId] as const
    for (const col of ['salesInvoices', 'purchaseInvoices', 'creditNotes', 'debitNotes']) {
      const snap = await getDocs(collection(db, ...orgPath, col))
      const used = snap.docs.some((d) =>
        ((d.data().lines as Array<{ itemId?: string }>) || []).some((l) => l.itemId === id)
      )
      if (used) {
        throw new Error('This item is used on invoices or bills and cannot be deleted. Deactivate it instead.')
      }
    }

    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'items', id))
  }

  function $reset() {
    unsubscribe()
    items.value = []
    loading.value = false
    error.value = null
  }

  return {
    items,
    loading,
    error,
    activeItems,
    inventoryItems,
    getItem,
    subscribe,
    unsubscribe,
    createItem,
    updateItem,
    deleteItem,
    $reset,
  }
})
