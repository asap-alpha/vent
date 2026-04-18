import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  collection, getDocs, doc, getDoc, query, orderBy, deleteDoc, updateDoc,
  getCountFromServer, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { logger } from '@/utils/logger'
import type { Organization, UserProfile, OrgMember } from '@/types/auth'

const log = logger('admin')

export interface AdminOrg extends Organization {
  memberCount: number
  collections: Record<string, number>
}

export interface AdminUser extends UserProfile {
  orgCount: number
}

export const useAdminStore = defineStore('admin', () => {
  const organizations = ref<AdminOrg[]>([])
  const users = ref<AdminUser[]>([])
  const loading = ref(false)
  const selectedOrg = ref<AdminOrg | null>(null)
  const selectedOrgMembers = ref<OrgMember[]>([])

  async function fetchAllOrganizations() {
    log.info('Fetching all organizations (super admin)')
    loading.value = true
    try {
      const snap = await getDocs(query(collection(db, 'organizations'), orderBy('name')))
      const orgs: AdminOrg[] = []
      for (const d of snap.docs) {
        const data = d.data()
        const memberSnap = await getCountFromServer(collection(db, 'organizations', d.id, 'members'))
        orgs.push({
          id: d.id,
          name: data.name,
          currency: data.currency || 'GHS',
          fiscalYearStart: data.fiscalYearStart || 1,
          status: data.status || 'approved',
          rejectionReason: data.rejectionReason,
          createdBy: data.createdBy || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          reviewedBy: data.reviewedBy,
          reviewedAt: data.reviewedAt?.toDate?.() || undefined,
          memberCount: memberSnap.data().count,
          collections: {},
        })
      }
      organizations.value = orgs
      log.info('Organizations loaded', { count: orgs.length })
    } catch (e: any) {
      log.error('fetchAllOrganizations failed', { code: e.code, message: e.message })
    } finally {
      loading.value = false
    }
  }

  async function fetchAllUsers() {
    log.info('Fetching all users (super admin)')
    loading.value = true
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('email')))
      users.value = snap.docs.map((d) => {
        const data = d.data()
        return {
          uid: d.id,
          email: data.email || '',
          displayName: data.displayName || '',
          photoURL: data.photoURL || null,
          organizations: data.organizations || [],
          defaultOrgId: data.defaultOrgId || null,
          platformRole: data.platformRole || 'user',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          orgCount: (data.organizations || []).length,
        } as AdminUser
      })
      log.info('Users loaded', { count: users.value.length })
    } catch (e: any) {
      log.error('fetchAllUsers failed', { code: e.code, message: e.message })
    } finally {
      loading.value = false
    }
  }

  async function fetchOrgDetails(orgId: string) {
    log.info('Fetching org details', { orgId })
    try {
      const orgSnap = await getDoc(doc(db, 'organizations', orgId))
      if (!orgSnap.exists()) return

      const data = orgSnap.data()
      const memberSnap = await getDocs(collection(db, 'organizations', orgId, 'members'))

      selectedOrgMembers.value = memberSnap.docs.map((d) => {
        const mData = d.data()
        return {
          userId: d.id,
          role: mData.role,
          email: mData.email || '',
          displayName: mData.displayName || '',
          invitedBy: mData.invitedBy || '',
          joinedAt: mData.joinedAt?.toDate?.() || new Date(),
        } as OrgMember
      })

      // Count docs in each subcollection
      const subcollections = [
        'accounts', 'journalEntries', 'customers', 'salesInvoices', 'quotes',
        'creditNotes', 'receipts', 'suppliers', 'purchaseInvoices', 'purchaseOrders',
        'debitNotes', 'payments', 'bankAccounts', 'bankTransactions', 'reconciliations',
      ]
      const counts: Record<string, number> = {}
      for (const coll of subcollections) {
        try {
          const snap = await getCountFromServer(collection(db, 'organizations', orgId, coll))
          counts[coll] = snap.data().count
        } catch {
          counts[coll] = -1
        }
      }

      selectedOrg.value = {
        id: orgSnap.id,
        name: data.name,
        currency: data.currency || 'GHS',
        fiscalYearStart: data.fiscalYearStart || 1,
        status: data.status || 'approved',
        rejectionReason: data.rejectionReason,
        createdBy: data.createdBy || '',
        createdAt: data.createdAt?.toDate?.() || new Date(),
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt?.toDate?.() || undefined,
        memberCount: memberSnap.docs.length,
        collections: counts,
      }
    } catch (e: any) {
      log.error('fetchOrgDetails failed', { code: e.code, message: e.message })
    }
  }

  async function updateOrgStatus(orgId: string, status: string, rejectionReason?: string) {
    log.info('Updating org status', { orgId, status })
    const update: any = { status, reviewedAt: serverTimestamp() }
    if (rejectionReason !== undefined) update.rejectionReason = rejectionReason
    await updateDoc(doc(db, 'organizations', orgId), update)
    // Update local state
    const org = organizations.value.find((o) => o.id === orgId)
    if (org) {
      (org as any).status = status
      if (rejectionReason !== undefined) (org as any).rejectionReason = rejectionReason
    }
  }

  async function deleteOrganization(orgId: string) {
    log.info('Deleting organization', { orgId })
    await deleteDoc(doc(db, 'organizations', orgId))
    organizations.value = organizations.value.filter((o) => o.id !== orgId)
  }

  async function updateUserPlatformRole(uid: string, platformRole: string) {
    log.info('Updating platform role', { uid, platformRole })
    await updateDoc(doc(db, 'users', uid), { platformRole })
    const user = users.value.find((u) => u.uid === uid)
    if (user) (user as any).platformRole = platformRole
  }

  return {
    organizations, users, loading, selectedOrg, selectedOrgMembers,
    fetchAllOrganizations, fetchAllUsers, fetchOrgDetails,
    updateOrgStatus, deleteOrganization, updateUserPlatformRole,
  }
})
