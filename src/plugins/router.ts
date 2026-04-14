import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
      path: '/',
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
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Wait for auth to initialize
  if (!authStore.initialized) {
    await authStore.init()
  }

  if (to.meta.requiresAuth && !authStore.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresGuest && authStore.user) {
    return { name: 'dashboard' }
  }
})

export default router
