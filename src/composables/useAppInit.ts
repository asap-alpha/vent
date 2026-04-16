import { logger } from '@/utils/logger'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useCustomersStore } from '@/stores/customers'
import { useInvoicesStore } from '@/stores/invoices'
import { useSuppliersStore } from '@/stores/suppliers'
import { useBillsStore } from '@/stores/bills'
import { useBankingStore } from '@/stores/banking'

const log = logger('init')

let initialized = false
let initPromise: Promise<void> | null = null

/**
 * Single entry point for app initialization.
 * Loads orgs, sets current org, subscribes all stores.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initApp(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise

  initPromise = doInit()
  await initPromise
}

async function doInit() {
  const authStore = useAuthStore()
  const orgStore = useOrganizationStore()

  if (!authStore.user) {
    log.debug('initApp: no user, skipping')
    return
  }

  if (!authStore.profile) {
    log.debug('initApp: fetching profile')
    await authStore.fetchProfile(authStore.user.uid)
  }

  if (!authStore.profile) {
    log.warn('initApp: profile still missing after fetch')
    return
  }

  // Load orgs if not yet loaded
  if (orgStore.organizations.length === 0 && authStore.profile.organizations.length > 0) {
    log.info('initApp: loading organizations')
    await orgStore.fetchOrganizations()
  }

  // Subscribe all stores if org is set
  if (orgStore.orgId) {
    log.info('initApp: subscribing all stores', { orgId: orgStore.orgId })
    subscribeAll()
  }

  // Watch for user's incoming invitations
  orgStore.subscribeMyInvitations()

  initialized = true
  log.info('initApp: complete', {
    orgId: orgStore.orgId,
    orgName: orgStore.orgName,
    role: orgStore.myRole,
  })
}

export function subscribeAll() {
  const orgStore = useOrganizationStore()
  if (!orgStore.orgId) return

  useAccountsStore().subscribe()
  useTransactionsStore().subscribe()
  useCustomersStore().subscribe()
  useInvoicesStore().subscribe()
  useSuppliersStore().subscribe()
  useBillsStore().subscribe()
  useBankingStore().subscribe()
}

export function resetInit() {
  initialized = false
  initPromise = null
}
