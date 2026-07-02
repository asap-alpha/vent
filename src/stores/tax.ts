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
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useOrganizationStore } from './organization'
import { useAccountsStore } from './accounts'
import { effectiveTaxRate } from '@/utils/tax'
import { logger } from '@/utils/logger'
import type { TaxCode, TaxComponent } from '@/types/tax'

const log = logger('tax')

export const useTaxStore = defineStore('tax', () => {
  const taxCodes = ref<TaxCode[]>([])
  const loading = ref(false)
  let unsub: Unsubscribe | null = null

  const activeTaxCodes = computed(() => taxCodes.value.filter((t) => t.isActive))
  const hasTaxCodes = computed(() => taxCodes.value.length > 0)

  function getTaxCode(id: string): TaxCode | undefined {
    return taxCodes.value.find((t) => t.id === id)
  }

  function subscribe() {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) {
      log.warn('subscribe() skipped — no org')
      return
    }
    unsubscribe()
    loading.value = true
    const q = query(collection(db, 'organizations', orgStore.orgId, 'taxCodes'), orderBy('rate'))
    unsub = onSnapshot(
      q,
      (snap) => {
        taxCodes.value = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as TaxCode
        })
        loading.value = false
      },
      (err) => {
        log.error('taxCodes subscription error', { code: err.code, message: err.message })
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

  async function createTaxCode(data: {
    name: string
    components: TaxComponent[]
    isActive: boolean
  }) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await addDoc(collection(db, 'organizations', orgStore.orgId, 'taxCodes'), {
      name: data.name,
      rate: effectiveTaxRate(data.components),
      components: data.components,
      isActive: data.isActive,
      isSystem: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function updateTaxCode(id: string, data: Partial<TaxCode>) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const { id: _id, createdAt, ...rest } = data as any
    void _id
    void createdAt
    if (rest.components) rest.rate = effectiveTaxRate(rest.components)
    await updateDoc(doc(db, 'organizations', orgStore.orgId, 'taxCodes', id), {
      ...rest,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteTaxCode(id: string) {
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'taxCodes', id))
  }

  /**
   * Seed the standard Ghana tax codes for an org that has none. Resolves the levy
   * liability accounts from the chart by code, so run it after the chart is seeded.
   * Guarded so it can't duplicate an existing set.
   */
  async function seedDefaultTaxCodes() {
    if (taxCodes.value.length > 0) {
      log.warn('seedDefaultTaxCodes skipped — codes already exist')
      return
    }
    const orgStore = useOrganizationStore()
    if (!orgStore.orgId) throw new Error('No organization')
    const accountsStore = useAccountsStore()

    const byCode = (code: string) => accountsStore.accounts.find((a) => a.code === code)?.id
    const vat = byCode('2100')
    const nhil = byCode('2110')
    const getfund = byCode('2120')
    const covid = byCode('2130')
    if (!vat) throw new Error('Seed the chart of accounts first (VAT Payable account missing).')

    const codes: Array<{ name: string; components: TaxComponent[] }> = [
      { name: 'No Tax', components: [] },
      {
        name: 'VAT 15%',
        components: [{ name: 'VAT', rate: 15, accountId: vat, compound: false }],
      },
      {
        name: 'Standard Rate (VAT + Levies)',
        components: [
          { name: 'NHIL', rate: 2.5, accountId: nhil || vat, compound: false },
          { name: 'GETFund', rate: 2.5, accountId: getfund || vat, compound: false },
          { name: 'COVID-19 Levy', rate: 1, accountId: covid || vat, compound: false },
          { name: 'VAT', rate: 15, accountId: vat, compound: true },
        ],
      },
    ]

    const batch = writeBatch(db)
    const col = collection(db, 'organizations', orgStore.orgId, 'taxCodes')
    for (const c of codes) {
      batch.set(doc(col), {
        name: c.name,
        rate: effectiveTaxRate(c.components),
        components: c.components,
        isActive: true,
        isSystem: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
    log.info('Seeded default tax codes', { count: codes.length })
  }

  function $reset() {
    unsubscribe()
    taxCodes.value = []
    loading.value = false
  }

  return {
    taxCodes,
    loading,
    activeTaxCodes,
    hasTaxCodes,
    getTaxCode,
    subscribe,
    unsubscribe,
    createTaxCode,
    updateTaxCode,
    deleteTaxCode,
    seedDefaultTaxCodes,
    $reset,
  }
})
