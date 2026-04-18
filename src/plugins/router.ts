import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { initApp, resetInit } from '@/composables/useAppInit'
import { logger } from '@/utils/logger'

const log = logger('router')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Landing page (public)
    {
      path: '/',
      name: 'landing',
      component: () => import('@/modules/landing/LandingPage.vue'),
      meta: { layout: 'none' },
    },

    // Auth routes
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/settings/LoginPage.vue'),
      meta: { requiresGuest: true, layout: 'auth' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/modules/settings/RegisterPage.vue'),
      meta: { requiresGuest: true, layout: 'auth' },
    },

    // Dashboard
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/modules/settings/DashboardPage.vue'),
      meta: { requiresAuth: true },
    },

    // Accounting
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('@/modules/accounting/AccountsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/journal-entries',
      name: 'journal-entries',
      component: () => import('@/modules/accounting/JournalEntriesPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/journal-entries/new',
      name: 'journal-entry-new',
      component: () => import('@/modules/accounting/JournalEntryForm.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/journal-entries/:id/edit',
      name: 'journal-entry-edit',
      component: () => import('@/modules/accounting/JournalEntryForm.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/general-ledger',
      name: 'general-ledger',
      component: () => import('@/modules/accounting/GeneralLedgerPage.vue'),
      meta: { requiresAuth: true },
    },

    // Sales
    {
      path: '/customers',
      name: 'customers',
      component: () => import('@/modules/sales/CustomersPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/invoices',
      name: 'invoices',
      component: () => import('@/modules/sales/InvoicesPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/invoices/new',
      name: 'invoice-new',
      component: () => import('@/modules/sales/InvoiceForm.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/invoices/:id/edit',
      name: 'invoice-edit',
      component: () => import('@/modules/sales/InvoiceForm.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/quotes',
      name: 'quotes',
      component: () => import('@/modules/sales/QuotesPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/credit-notes',
      name: 'credit-notes',
      component: () => import('@/modules/sales/CreditNotesPage.vue'),
      meta: { requiresAuth: true },
    },

    // Purchases
    {
      path: '/suppliers',
      name: 'suppliers',
      component: () => import('@/modules/purchases/SuppliersPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/bills',
      name: 'bills',
      component: () => import('@/modules/purchases/BillsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/bills/new',
      name: 'bill-new',
      component: () => import('@/modules/purchases/BillForm.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/bills/:id/edit',
      name: 'bill-edit',
      component: () => import('@/modules/purchases/BillForm.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/purchase-orders',
      name: 'purchase-orders',
      component: () => import('@/modules/purchases/PurchaseOrdersPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/debit-notes',
      name: 'debit-notes',
      component: () => import('@/modules/purchases/DebitNotesPage.vue'),
      meta: { requiresAuth: true },
    },

    // Banking
    {
      path: '/bank-accounts',
      name: 'bank-accounts',
      component: () => import('@/modules/banking/BankAccountsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/reconciliation',
      name: 'reconciliation',
      component: () => import('@/modules/banking/ReconciliationPage.vue'),
      meta: { requiresAuth: true },
    },

    // Reports
    {
      path: '/reports/profit-loss',
      name: 'profit-loss',
      component: () => import('@/modules/reports/ProfitLossPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/reports/balance-sheet',
      name: 'balance-sheet',
      component: () => import('@/modules/reports/BalanceSheetPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/reports/trial-balance',
      name: 'trial-balance',
      component: () => import('@/modules/reports/TrialBalancePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/reports/aging',
      name: 'aging',
      component: () => import('@/modules/reports/AgingReportPage.vue'),
      meta: { requiresAuth: true },
    },

    // Settings
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/modules/settings/SettingsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/users',
      name: 'users',
      component: () => import('@/modules/settings/UsersPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings/diagnostics',
      name: 'diagnostics',
      component: () => import('@/modules/settings/DiagnosticsPage.vue'),
      meta: { requiresAuth: true },
    },

    // Super Admin
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/modules/admin/AdminDashboard.vue'),
      meta: { requiresAuth: true, requiresSuperAdmin: true },
    },
  ],
})

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()
  log.debug('Navigate', { from: from.fullPath, to: to.fullPath })

  // 1. Wait for Firebase Auth to resolve
  if (!authStore.initialized) {
    log.debug('Waiting for auth init')
    await authStore.init()
  }

  // 2. Gate check
  if (to.meta.requiresAuth && !authStore.user) {
    log.info('Redirect to login (no auth)', { to: to.fullPath })
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresGuest && authStore.user) {
    log.info('Redirect to dashboard (already authed)')
    return { name: 'dashboard' }
  }

  // Landing page: redirect to dashboard if already signed in
  if (to.name === 'landing' && authStore.initialized && authStore.user) {
    return { name: 'dashboard' }
  }

  // 3. Super admin guard
  if (to.meta.requiresSuperAdmin) {
    if (authStore.profile?.platformRole !== 'super_admin') {
      log.warn('Super admin access denied', { to: to.fullPath })
      return { name: 'dashboard' }
    }
  }

  // 4. Initialize app (org + all stores) — runs once per session
  if (authStore.user && to.meta.requiresAuth) {
    await initApp()
  }

  // 5. Reset init state on logout
  if (!authStore.user) {
    resetInit()
  }
})

export default router
