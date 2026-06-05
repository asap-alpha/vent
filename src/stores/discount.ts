import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection, doc, setDoc, updateDoc, query, where, getDocs, getDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useAuthStore } from './auth'
import { logger } from '@/utils/logger'
import type { Discount } from '@/types/discount'

const log = logger('discount')

// Unambiguous alphabet — no I/O/0/1 so codes are easy to read out and type.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

function randomCode(): string {
  let out = ''
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return out
}

function toDate(v: any): Date | null {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()
  return v instanceof Date ? v : null
}

function fromDoc(id: string, d: any): Discount {
  return {
    id,
    code: d.code || '',
    orgId: d.orgId || '',
    discountPercent: d.discountPercent || 0,
    status: d.status || 'active',
    expiresAt: toDate(d.expiresAt),
    createdAt: toDate(d.createdAt),
    createdBy: d.createdBy || '',
    notes: d.notes || '',
    usedAt: toDate(d.usedAt),
    usedOnClientReference: d.usedOnClientReference || '',
    usedOnPlanId: d.usedOnPlanId || '',
  }
}

export const useDiscountStore = defineStore('discount', () => {
  const discounts = ref<Discount[]>([])
  const loading = ref(false)

  /** All discount codes issued to an org, newest first. Super admin only. */
  async function listForOrg(orgId: string): Promise<Discount[]> {
    log.info('Listing discounts', { orgId })
    loading.value = true
    try {
      // Single-field equality filter (no composite index needed); sort newest-first
      // in memory — the per-org code list is small.
      const snap = await getDocs(query(collection(db, 'discounts'), where('orgId', '==', orgId)))
      discounts.value = snap.docs
        .map((d) => fromDoc(d.id, d.data()))
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      return discounts.value
    } catch (e: any) {
      log.error('listForOrg failed', { code: e.code, message: e.message })
      throw e
    } finally {
      loading.value = false
    }
  }

  // Generate a code that isn't already taken. A collision on an 8-char code is
  // astronomically unlikely, but a cheap existence check keeps `code` truly unique.
  async function uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode()
      const existing = await getDocs(query(collection(db, 'discounts'), where('code', '==', code)))
      if (existing.empty) return code
    }
    throw new Error('Could not generate a unique code, please retry')
  }

  /**
   * Issue a single-use percentage discount to an org. Super admin only (enforced
   * by Firestore rules). Returns the created discount.
   */
  async function createDiscount(opts: {
    orgId: string
    discountPercent: number
    expiresInDays: number
    notes?: string
  }): Promise<Discount> {
    const auth = useAuthStore()
    const { orgId, discountPercent, expiresInDays, notes } = opts
    if (discountPercent <= 0 || discountPercent > 100) throw new Error('Discount must be between 1 and 100%')

    const code = await uniqueCode()
    const ref = doc(collection(db, 'discounts'))
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays > 0 ? expiresInDays : 30))

    log.info('Creating discount', { orgId, code, discountPercent, expiresInDays })
    await setDoc(ref, {
      id: ref.id,
      code,
      orgId,
      discountPercent,
      status: 'active',
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp(),
      createdBy: auth.user?.uid || '',
      notes: notes || '',
      usedAt: null,
      usedOnClientReference: '',
      usedOnPlanId: '',
    })

    // Read back so createdAt (server timestamp) is resolved for the UI.
    const snap = await getDoc(ref)
    const created = fromDoc(ref.id, snap.data())
    discounts.value = [created, ...discounts.value]
    return created
  }

  /** Revoke an unused code so it can no longer be redeemed. */
  async function revokeDiscount(id: string): Promise<void> {
    log.info('Revoking discount', { id })
    await updateDoc(doc(db, 'discounts', id), { status: 'revoked' })
    const d = discounts.value.find((x) => x.id === id)
    if (d) d.status = 'revoked'
  }

  return { discounts, loading, listForOrg, createDiscount, revokeDiscount }
})
