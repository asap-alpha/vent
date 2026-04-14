import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useAuthStore } from './auth'
import type { Organization, OrgMember, Invitation, UserRole } from '@/types/auth'
import { hasPermission, type Permission } from '@/utils/permissions'

export const useOrganizationStore = defineStore('organization', () => {
  const currentOrg = ref<Organization | null>(null)
  const organizations = ref<Organization[]>([])
  const members = ref<OrgMember[]>([])
  const invitations = ref<Invitation[]>([])
  const myInvitations = ref<Invitation[]>([])
  const loading = ref(false)
  let membersUnsub: Unsubscribe | null = null
  let invitationsUnsub: Unsubscribe | null = null
  let myInvitationsUnsub: Unsubscribe | null = null

  const orgId = computed(() => currentOrg.value?.id || '')
  const orgName = computed(() => currentOrg.value?.name || '')

  const myRole = computed<UserRole | null>(() => {
    const authStore = useAuthStore()
    if (!authStore.user) return null
    const me = members.value.find((m) => m.userId === authStore.user!.uid)
    return me?.role || null
  })

  function can(permission: Permission): boolean {
    return hasPermission(myRole.value, permission)
  }

  async function fetchOrganizations() {
    const authStore = useAuthStore()
    if (!authStore.profile) return

    const orgIds = authStore.profile.organizations
    if (orgIds.length === 0) {
      organizations.value = []
      return
    }

    const orgs: Organization[] = []
    for (const id of orgIds) {
      const snap = await getDoc(doc(db, 'organizations', id))
      if (snap.exists()) {
        const data = snap.data()
        orgs.push({
          id: snap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as Organization)
      }
    }
    organizations.value = orgs

    const defaultId = authStore.profile.defaultOrgId
    if (defaultId && orgs.find((o) => o.id === defaultId)) {
      await setCurrentOrg(defaultId)
    } else if (orgs.length > 0) {
      await setCurrentOrg(orgs[0].id)
    }
  }

  async function setCurrentOrg(id: string) {
    const org = organizations.value.find((o) => o.id === id)
    if (org) {
      currentOrg.value = org
      subscribeMembers()
      subscribeInvitations()
    }
  }

  async function createOrganization(name: string, currency: string, fiscalYearStart: number) {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    loading.value = true
    try {
      const orgRef = await addDoc(collection(db, 'organizations'), {
        name,
        currency,
        fiscalYearStart,
        createdBy: authStore.user.uid,
        createdAt: serverTimestamp(),
      })

      // Add creator as owner member (doc id = userId)
      await setDoc(doc(db, 'organizations', orgRef.id, 'members', authStore.user.uid), {
        userId: authStore.user.uid,
        role: 'owner',
        email: authStore.user.email,
        displayName: authStore.profile?.displayName || '',
        invitedBy: authStore.user.uid,
        joinedAt: serverTimestamp(),
      })

      // Org settings doc
      await setDoc(doc(db, 'organizations', orgRef.id, 'settings', 'general'), {
        fiscalYearStart,
        currency,
        taxRates: [],
        invoicePrefix: 'INV-',
        nextInvoiceNum: 1,
      })

      // Update user profile
      await updateDoc(doc(db, 'users', authStore.user.uid), {
        organizations: arrayUnion(orgRef.id),
        defaultOrgId: orgRef.id,
      })

      await authStore.fetchProfile(authStore.user.uid)
      await fetchOrganizations()

      return orgRef.id
    } finally {
      loading.value = false
    }
  }

  function subscribeMembers() {
    if (!currentOrg.value) return
    if (membersUnsub) membersUnsub()
    membersUnsub = onSnapshot(
      collection(db, 'organizations', currentOrg.value.id, 'members'),
      (snap) => {
        members.value = snap.docs.map((d) => {
          const data = d.data()
          return {
            userId: d.id,
            ...data,
            joinedAt: data.joinedAt?.toDate?.() || new Date(),
          } as OrgMember
        })
      }
    )
  }

  function subscribeInvitations() {
    if (!currentOrg.value) return
    if (invitationsUnsub) invitationsUnsub()
    invitationsUnsub = onSnapshot(
      query(
        collection(db, 'invitations'),
        where('orgId', '==', currentOrg.value.id),
        where('status', '==', 'pending')
      ),
      (snap) => {
        invitations.value = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Invitation
        })
      }
    )
  }

  function subscribeMyInvitations() {
    const authStore = useAuthStore()
    if (!authStore.user?.email) return
    if (myInvitationsUnsub) myInvitationsUnsub()
    myInvitationsUnsub = onSnapshot(
      query(
        collection(db, 'invitations'),
        where('email', '==', authStore.user.email),
        where('status', '==', 'pending')
      ),
      (snap) => {
        myInvitations.value = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as Invitation
        })
      }
    )
  }

  async function inviteMember(email: string, role: UserRole) {
    const authStore = useAuthStore()
    if (!currentOrg.value || !authStore.user) throw new Error('Not authenticated')
    if (!can('users:manage')) throw new Error('Permission denied')

    // Check if already a member
    if (members.value.find((m) => m.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('User is already a member of this organization')
    }
    // Check existing pending invite
    if (invitations.value.find((i) => i.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An invitation is already pending for this email')
    }

    await addDoc(collection(db, 'invitations'), {
      orgId: currentOrg.value.id,
      orgName: currentOrg.value.name,
      email: email.toLowerCase().trim(),
      role,
      invitedBy: authStore.user.uid,
      status: 'pending',
      createdAt: serverTimestamp(),
    })
  }

  async function cancelInvitation(invitationId: string) {
    if (!can('users:manage')) throw new Error('Permission denied')
    await deleteDoc(doc(db, 'invitations', invitationId))
  }

  async function acceptInvitation(invitationId: string) {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const invSnap = await getDoc(doc(db, 'invitations', invitationId))
    if (!invSnap.exists()) throw new Error('Invitation not found')
    const inv = invSnap.data() as Omit<Invitation, 'id'>

    if (inv.email.toLowerCase() !== authStore.user.email?.toLowerCase()) {
      throw new Error('This invitation is for a different email address')
    }

    // Add as member
    await setDoc(doc(db, 'organizations', inv.orgId, 'members', authStore.user.uid), {
      userId: authStore.user.uid,
      role: inv.role,
      email: authStore.user.email,
      displayName: authStore.profile?.displayName || '',
      invitedBy: inv.invitedBy,
      joinedAt: serverTimestamp(),
    })

    // Update user profile
    await updateDoc(doc(db, 'users', authStore.user.uid), {
      organizations: arrayUnion(inv.orgId),
    })

    // Mark invitation accepted
    await updateDoc(doc(db, 'invitations', invitationId), { status: 'accepted' })

    // Refresh
    await authStore.fetchProfile(authStore.user.uid)
    await fetchOrganizations()
  }

  async function declineInvitation(invitationId: string) {
    await updateDoc(doc(db, 'invitations', invitationId), { status: 'declined' })
  }

  async function updateMemberRole(userId: string, role: UserRole) {
    if (!currentOrg.value) throw new Error('No organization')
    if (!can('users:manage')) throw new Error('Permission denied')
    if (role === 'owner') {
      throw new Error('Use Transfer Ownership to assign Owner role')
    }
    await updateDoc(
      doc(db, 'organizations', currentOrg.value.id, 'members', userId),
      { role }
    )
  }

  async function removeMember(userId: string) {
    if (!currentOrg.value) throw new Error('No organization')
    if (!can('users:manage')) throw new Error('Permission denied')
    const member = members.value.find((m) => m.userId === userId)
    if (member?.role === 'owner') throw new Error('Cannot remove the owner')

    await deleteDoc(doc(db, 'organizations', currentOrg.value.id, 'members', userId))

    // Best-effort: remove org from user's profile
    const userSnap = await getDoc(doc(db, 'users', userId))
    if (userSnap.exists()) {
      const profile = userSnap.data()
      const orgs = (profile.organizations || []).filter((o: string) => o !== currentOrg.value!.id)
      await updateDoc(doc(db, 'users', userId), { organizations: orgs })
    }
  }

  function $reset() {
    if (membersUnsub) { membersUnsub(); membersUnsub = null }
    if (invitationsUnsub) { invitationsUnsub(); invitationsUnsub = null }
    if (myInvitationsUnsub) { myInvitationsUnsub(); myInvitationsUnsub = null }
    currentOrg.value = null
    organizations.value = []
    members.value = []
    invitations.value = []
    myInvitations.value = []
    loading.value = false
  }

  // ---- Pending invitations for current user ----
  async function fetchPendingInvitations() {
    const authStore = useAuthStore()
    if (!authStore.user?.email) return
    const snap = await getDocs(
      query(
        collection(db, 'invitations'),
        where('email', '==', authStore.user.email),
        where('status', '==', 'pending')
      )
    )
    myInvitations.value = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as Invitation
    })
  }

  return {
    currentOrg, organizations, members, invitations, myInvitations,
    loading, orgId, orgName, myRole, can,
    fetchOrganizations, setCurrentOrg, createOrganization,
    subscribeMembers, subscribeInvitations, subscribeMyInvitations,
    inviteMember, cancelInvitation,
    acceptInvitation, declineInvitation,
    updateMemberRole, removeMember,
    fetchPendingInvitations,
    $reset,
  }
})
