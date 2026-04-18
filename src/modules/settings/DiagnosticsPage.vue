<template>
  <div>
    <!-- Owner-only guard -->
    <v-alert v-if="orgStore.myRole !== 'owner' && orgStore.myRole !== 'admin'" type="warning" variant="tonal" class="mb-4">
      Diagnostics is only available to owners and admins.
      <template #append>
        <v-btn variant="text" :to="{ name: 'dashboard' }">Go to Dashboard</v-btn>
      </template>
    </v-alert>

    <template v-if="orgStore.myRole === 'owner' || orgStore.myRole === 'admin'">
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Diagnostics</h1>
      <v-spacer />
      <v-btn variant="outlined" prepend-icon="mdi-refresh" @click="refresh" :loading="refreshing">
        Refresh
      </v-btn>
    </div>

    <!-- Organization Info -->
    <v-card elevation="1" class="mb-4">
      <v-card-title>Organization</v-card-title>
      <v-card-text>
        <v-table density="comfortable">
          <tbody>
            <tr>
              <td style="width: 30%">Email</td>
              <td>{{ authStore.user?.email || '—' }}</td>
            </tr>
            <tr>
              <td>Platform Role</td>
              <td>
                <v-chip
                  :color="authStore.isSuperAdmin ? 'error' : 'grey'"
                  size="small"
                >
                  {{ authStore.profile?.platformRole || 'user' }}
                </v-chip>
                <span v-if="!authStore.isSuperAdmin" class="ml-2 text-caption text-grey">
                  Set to "super_admin" in Firestore to enable platform admin
                </span>
              </td>
            </tr>
            <tr>
              <td>Organization</td>
              <td>{{ orgStore.currentOrg?.name || '—' }}</td>
            </tr>
            <tr>
              <td>My Role</td>
              <td>
                <v-chip v-if="orgStore.myRole" :color="roleColor(orgStore.myRole)" size="small" variant="tonal">
                  {{ roleLabel(orgStore.myRole) }}
                </v-chip>
                <span v-else class="text-error">No role</span>
              </td>
            </tr>
            <tr>
              <td>Members</td>
              <td>{{ orgStore.members.length }}</td>
            </tr>
            <tr>
              <td>Pending Invitations</td>
              <td>{{ orgStore.invitations.length }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <!-- Data Health Check -->
    <v-card elevation="1" class="mb-4">
      <v-card-title>
        Data Health Check
        <v-spacer />
        <v-btn size="small" variant="outlined" :loading="checking" @click="runHealthCheck">Run Check</v-btn>
      </v-card-title>
      <v-card-text>
        <v-list density="compact">
          <v-list-item
            v-for="(check, idx) in healthChecks"
            :key="idx"
            :prepend-icon="check.status === 'ok' ? 'mdi-check-circle' : check.status === 'fix' ? 'mdi-alert-circle' : 'mdi-progress-clock'"
            :class="check.status === 'ok' ? 'text-success' : check.status === 'fix' ? 'text-error' : 'text-grey'"
          >
            <v-list-item-title>{{ check.label }}</v-list-item-title>
            <v-list-item-subtitle>{{ check.detail }}</v-list-item-subtitle>
            <template #append>
              <v-btn
                v-if="check.fixable"
                size="small"
                color="primary"
                variant="tonal"
                :loading="fixing[check.fixId || '']"
                @click="runFix(check.fixId!)"
              >Fix</v-btn>
            </template>
          </v-list-item>
        </v-list>
        <v-alert v-if="healthChecks.length === 0" type="info" variant="tonal" class="mt-2">
          Click "Run Check" to diagnose data issues.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Store subscriptions / counts -->
    <v-card elevation="1" class="mb-4">
      <v-card-title>
        Store Subscriptions
        <v-spacer />
        <v-btn size="small" variant="text" @click="subscribeAll">Re-subscribe All</v-btn>
      </v-card-title>
      <v-data-table
        :headers="storeHeaders"
        :items="storeStatuses"
        :items-per-page="-1"
        hide-default-footer
        density="compact"
      >
        <template #item.status="{ item }">
          <StatusChip :ok="item.count > 0" :label="item.count > 0 ? 'Loaded' : 'Empty'" />
        </template>
        <template #item.loading="{ item }">
          <v-icon v-if="item.loading" color="warning" size="small">mdi-loading mdi-spin</v-icon>
          <v-icon v-else color="grey" size="small">mdi-check-circle-outline</v-icon>
        </template>
      </v-data-table>
    </v-card>

    <!-- Raw Firestore check -->
    <v-card elevation="1" class="mb-4">
      <v-card-title>
        Raw Firestore Counts
        <v-spacer />
        <v-btn size="small" variant="text" :loading="counting" @click="countFirestore">
          Count Directly
        </v-btn>
      </v-card-title>
      <v-card-subtitle>
        Reads directly from Firestore, bypassing the stores. Use this to see what's actually saved on the server.
      </v-card-subtitle>
      <v-data-table
        :headers="rawHeaders"
        :items="rawCounts"
        :items-per-page="-1"
        hide-default-footer
        density="compact"
      >
        <template #item.match="{ item }">
          <v-icon v-if="item.storeCount === item.rawCount" color="success">mdi-check-circle</v-icon>
          <v-icon v-else color="error" title="Store count differs from server count">mdi-alert-circle</v-icon>
        </template>
      </v-data-table>
      <v-alert v-if="rawError" type="error" variant="tonal" class="ma-4">{{ rawError }}</v-alert>
    </v-card>

    <!-- Write test -->
    <v-card elevation="1" class="mb-4">
      <v-card-title>Write Test</v-card-title>
      <v-card-subtitle>Tries a write + delete round-trip to verify permissions.</v-card-subtitle>
      <v-card-text>
        <div class="d-flex ga-2 flex-wrap">
          <v-btn size="small" variant="outlined" :loading="testing.customer" @click="testWrite('customers')">
            Test Customer Write
          </v-btn>
          <v-btn size="small" variant="outlined" :loading="testing.account" @click="testWrite('accounts')">
            Test Account Write
          </v-btn>
          <v-btn size="small" variant="outlined" :loading="testing.bank" @click="testWrite('bankAccounts')">
            Test Bank Account Write
          </v-btn>
        </div>
        <div v-if="writeLog.length > 0" class="mt-4">
          <v-list density="compact">
            <v-list-item
              v-for="(log, idx) in writeLog"
              :key="idx"
              :prepend-icon="log.ok ? 'mdi-check-circle' : 'mdi-close-circle'"
              :class="log.ok ? 'text-success' : 'text-error'"
            >
              <v-list-item-title class="text-body-2">{{ log.message }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ log.time }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </div>
      </v-card-text>
    </v-card>

    <!-- Live Logs -->
    <v-card elevation="1" class="mb-4">
      <v-card-title class="d-flex align-center">
        Live Logs ({{ filteredLogs.length }})
        <v-spacer />
        <v-select
          v-model="logLevelFilter"
          :items="logLevelOptions"
          density="compact"
          hide-details
          style="max-width: 140px"
          class="mr-2"
        />
        <v-select
          v-model="logScopeFilter"
          :items="logScopeOptions"
          density="compact"
          hide-details
          style="max-width: 160px"
          class="mr-2"
        />
        <v-btn size="small" variant="text" prepend-icon="mdi-broom" @click="clearLogs">Clear</v-btn>
      </v-card-title>
      <v-card-subtitle>
        Shows recent app events (last 500). Useful for tracing why data didn't persist.
      </v-card-subtitle>
      <div class="log-container" style="max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px;">
        <div
          v-for="entry in filteredLogs"
          :key="entry.id"
          class="log-line pa-2"
          :style="{ borderLeft: `3px solid ${levelColor(entry.level)}` }"
        >
          <span class="text-grey">{{ entry.timestamp.toTimeString().slice(0, 8) }}</span>
          <span :style="{ color: scopeColor(entry.scope), fontWeight: 'bold' }" class="mx-2">
            [{{ entry.scope }}]
          </span>
          <span :style="{ color: levelColor(entry.level) }" class="text-uppercase mr-2">
            {{ entry.level }}
          </span>
          <span>{{ entry.message }}</span>
          <pre v-if="entry.data" class="text-grey mt-1 mb-0" style="white-space: pre-wrap; font-size: 11px;">{{ formatData(entry.data) }}</pre>
        </div>
        <div v-if="filteredLogs.length === 0" class="text-center text-grey pa-8">
          No logs match the current filter.
        </div>
      </div>
    </v-card>

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import {
  collection, getCountFromServer, addDoc, deleteDoc, doc, setDoc, getDoc, getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/plugins/firebase'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useCustomersStore } from '@/stores/customers'
import { useInvoicesStore } from '@/stores/invoices'
import { useSuppliersStore } from '@/stores/suppliers'
import { useBillsStore } from '@/stores/bills'
import { useBankingStore } from '@/stores/banking'
import { roleLabel, roleColor } from '@/utils/permissions'
import { logs, clearLogs as clearLogBuffer, type LogLevel } from '@/utils/logger'
import { subscribeAll as centralSubscribeAll } from '@/composables/useAppInit'

const authStore = useAuthStore()
const orgStore = useOrganizationStore()
const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const customersStore = useCustomersStore()
const invoicesStore = useInvoicesStore()
const suppliersStore = useSuppliersStore()
const billsStore = useBillsStore()
const bankingStore = useBankingStore()

// Inline status chip
const StatusChip = (props: { ok: boolean; label: string }) =>
  h('v-chip' as any, {
    color: props.ok ? 'success' : 'error',
    size: 'small',
    variant: 'tonal',
  }, () => props.label)

// ---- Store statuses ----
const storeStatuses = computed(() => [
  { name: 'Chart of Accounts', collection: 'accounts', count: accountsStore.accounts.length, loading: accountsStore.loading },
  { name: 'Journal Entries', collection: 'journalEntries', count: transactionsStore.entries.length, loading: transactionsStore.loading },
  { name: 'Customers', collection: 'customers', count: customersStore.customers.length, loading: customersStore.loading },
  { name: 'Sales Invoices', collection: 'salesInvoices', count: invoicesStore.invoices.length, loading: invoicesStore.loading },
  { name: 'Quotes', collection: 'quotes', count: invoicesStore.quotes.length, loading: invoicesStore.loading },
  { name: 'Credit Notes', collection: 'creditNotes', count: invoicesStore.creditNotes.length, loading: invoicesStore.loading },
  { name: 'Receipts', collection: 'receipts', count: invoicesStore.receipts.length, loading: invoicesStore.loading },
  { name: 'Suppliers', collection: 'suppliers', count: suppliersStore.suppliers.length, loading: suppliersStore.loading },
  { name: 'Bills', collection: 'purchaseInvoices', count: billsStore.bills.length, loading: billsStore.loading },
  { name: 'Purchase Orders', collection: 'purchaseOrders', count: billsStore.purchaseOrders.length, loading: billsStore.loading },
  { name: 'Debit Notes', collection: 'debitNotes', count: billsStore.debitNotes.length, loading: billsStore.loading },
  { name: 'Payments', collection: 'payments', count: billsStore.payments.length, loading: billsStore.loading },
  { name: 'Bank Accounts', collection: 'bankAccounts', count: bankingStore.accounts.length, loading: bankingStore.loading },
  { name: 'Bank Transactions', collection: 'bankTransactions', count: bankingStore.transactions.length, loading: bankingStore.loading },
  { name: 'Reconciliations', collection: 'reconciliations', count: bankingStore.reconciliations.length, loading: bankingStore.loading },
])

const storeHeaders = [
  { title: 'Store', key: 'name' },
  { title: 'Collection', key: 'collection' },
  { title: 'Docs Loaded', key: 'count', align: 'end' as const, width: 120 },
  { title: 'Status', key: 'status', width: 120 },
  { title: 'Loading', key: 'loading', width: 80, align: 'center' as const },
]

// ---- Raw Firestore counts ----
const rawCounts = ref<Array<{ name: string; collection: string; storeCount: number; rawCount: number }>>([])
const rawError = ref('')
const counting = ref(false)

const rawHeaders = [
  { title: 'Collection', key: 'name' },
  { title: 'Store Count', key: 'storeCount', align: 'end' as const, width: 120 },
  { title: 'Server Count', key: 'rawCount', align: 'end' as const, width: 120 },
  { title: 'Match', key: 'match', width: 80, align: 'center' as const },
]

async function countFirestore() {
  if (!orgStore.orgId) {
    rawError.value = 'No organization selected'
    return
  }
  counting.value = true
  rawError.value = ''
  const results: typeof rawCounts.value = []
  try {
    for (const s of storeStatuses.value) {
      try {
        const snap = await getCountFromServer(
          collection(db, 'organizations', orgStore.orgId, s.collection)
        )
        results.push({
          name: s.name,
          collection: s.collection,
          storeCount: s.count,
          rawCount: snap.data().count,
        })
      } catch (e: any) {
        results.push({
          name: s.name,
          collection: s.collection,
          storeCount: s.count,
          rawCount: -1,
        })
        console.error(`Count failed for ${s.collection}:`, e.message)
      }
    }
    rawCounts.value = results
  } catch (e: any) {
    rawError.value = e.message
  } finally {
    counting.value = false
  }
}

// ---- Write test ----
const writeLog = ref<Array<{ ok: boolean; message: string; time: string }>>([])
const testing = ref<Record<string, boolean>>({ customer: false, account: false, bank: false })

async function testWrite(collectionName: 'customers' | 'accounts' | 'bankAccounts') {
  if (!orgStore.orgId) {
    logResult(false, 'No organization — cannot write')
    return
  }
  const key = collectionName === 'customers' ? 'customer' : collectionName === 'accounts' ? 'account' : 'bank'
  testing.value[key] = true
  try {
    const testData: any = { _diagnostic: true, createdAt: serverTimestamp() }
    if (collectionName === 'customers') {
      Object.assign(testData, { name: '__TEST__', email: '', phone: '', address: '', taxId: '', isActive: true, balance: 0 })
    } else if (collectionName === 'accounts') {
      Object.assign(testData, { code: '__TEST__', name: '__TEST__', type: 'asset', parentId: null, currency: 'GHS', isActive: false, balance: 0, description: '' })
    } else {
      Object.assign(testData, { name: '__TEST__', accountNumber: '', bankName: '', currency: 'GHS', type: 'cash', openingBalance: 0, currentBalance: 0, isActive: false })
    }

    const ref = await addDoc(collection(db, 'organizations', orgStore.orgId, collectionName), testData)
    logResult(true, `Write to ${collectionName} succeeded (doc id: ${ref.id.slice(0, 8)}…). Cleaning up…`)
    await deleteDoc(doc(db, 'organizations', orgStore.orgId, collectionName, ref.id))
    logResult(true, `Cleanup delete for ${collectionName} succeeded`)
  } catch (e: any) {
    logResult(false, `${collectionName}: ${e.code || 'error'} — ${e.message}`)
  } finally {
    testing.value[key] = false
  }
}

function logResult(ok: boolean, message: string) {
  writeLog.value.unshift({
    ok,
    message,
    time: new Date().toLocaleTimeString(),
  })
}

// ---- Actions ----
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  try {
    subscribeAll()
    await countFirestore()
  } finally {
    refreshing.value = false
  }
}

function subscribeAll() {
  if (!orgStore.orgId) return
  centralSubscribeAll()
  orgStore.subscribeMembers()
  orgStore.subscribeInvitations()
}

// ---- Health checks ----
interface HealthCheck {
  label: string
  detail: string
  status: 'ok' | 'fix' | 'pending'
  fixable?: boolean
  fixId?: string
}

const healthChecks = ref<HealthCheck[]>([])
const checking = ref(false)
const fixing = ref<Record<string, boolean>>({})

async function runHealthCheck() {
  if (!orgStore.orgId || !authStore.user) {
    healthChecks.value = [{ label: 'No org or user', detail: 'Sign in and create an org first', status: 'fix' }]
    return
  }
  checking.value = true
  const checks: HealthCheck[] = []

  // 1. Check if member doc exists at /members/{userId}
  try {
    const memberDoc = await getDoc(doc(db, 'organizations', orgStore.orgId, 'members', authStore.user.uid))
    if (memberDoc.exists()) {
      checks.push({ label: 'Member doc (by userId)', detail: `Role: ${memberDoc.data().role}`, status: 'ok' })
    } else {
      // Check if there's a member doc with a random ID (old addDoc code)
      const membersSnap = await getDocs(collection(db, 'organizations', orgStore.orgId, 'members'))
      const myMember = membersSnap.docs.find((d) => d.data().userId === authStore.user!.uid || d.data().email === authStore.user!.email)
      if (myMember) {
        checks.push({
          label: 'Member doc has wrong ID',
          detail: `Found at members/${myMember.id} instead of members/${authStore.user.uid}. Firestore rules will fail. Click Fix to migrate.`,
          status: 'fix',
          fixable: true,
          fixId: 'member-id',
        })
      } else {
        checks.push({
          label: 'Member doc missing entirely',
          detail: 'You are not registered as a member of this org. Click Fix to add yourself as owner.',
          status: 'fix',
          fixable: true,
          fixId: 'member-missing',
        })
      }
    }
  } catch (e: any) {
    checks.push({ label: 'Member doc check failed', detail: `${e.code}: ${e.message}`, status: 'fix' })
  }

  // 2. Check settings doc
  try {
    const settingsDoc = await getDoc(doc(db, 'organizations', orgStore.orgId, 'settings', 'general'))
    if (settingsDoc.exists()) {
      checks.push({ label: 'Settings doc', detail: `Currency: ${settingsDoc.data().currency}`, status: 'ok' })
    } else {
      checks.push({
        label: 'Settings doc missing',
        detail: 'Organization settings not found. Click Fix to create.',
        status: 'fix',
        fixable: true,
        fixId: 'settings-missing',
      })
    }
  } catch (e: any) {
    checks.push({ label: 'Settings check failed', detail: `${e.code}: ${e.message}`, status: 'fix' })
  }

  // 3. Check if writes are actually reaching the server (not just cache)
  try {
    // Force network sync check
    const countSnap = await getCountFromServer(collection(db, 'organizations', orgStore.orgId, 'accounts'))
    checks.push({
      label: 'Server connectivity',
      detail: `Firestore server reachable. accounts count: ${countSnap.data().count}`,
      status: 'ok',
    })
  } catch (e: any) {
    checks.push({
      label: 'Server connectivity',
      detail: `Cannot reach Firestore server: ${e.code || e.message}. Data may be in offline cache only.`,
      status: 'fix',
    })
  }

  // 4. Check each expected subcollection
  const expectedCollections = [
    'members', 'settings', 'accounts', 'journalEntries',
    'customers', 'salesInvoices', 'quotes', 'creditNotes', 'receipts',
    'suppliers', 'purchaseInvoices', 'purchaseOrders', 'debitNotes', 'payments',
    'bankAccounts', 'bankTransactions', 'reconciliations',
  ]

  for (const coll of expectedCollections) {
    try {
      const snap = await getCountFromServer(collection(db, 'organizations', orgStore.orgId, coll))
      const count = snap.data().count
      if (count > 0) {
        checks.push({ label: `${coll}`, detail: `${count} doc(s) on server`, status: 'ok' })
      } else {
        checks.push({ label: `${coll}`, detail: 'Empty (no docs on server yet)', status: 'pending' })
      }
    } catch (e: any) {
      checks.push({ label: `${coll}`, detail: `Error: ${e.code || e.message}`, status: 'fix' })
    }
  }

  healthChecks.value = checks
  checking.value = false
}

async function runFix(fixId: string) {
  if (!orgStore.orgId || !authStore.user) return
  fixing.value[fixId] = true

  try {
    if (fixId === 'member-id') {
      // Find the old member doc and migrate it
      const membersSnap = await getDocs(collection(db, 'organizations', orgStore.orgId, 'members'))
      const myMember = membersSnap.docs.find(
        (d) => d.data().userId === authStore.user!.uid || d.data().email === authStore.user!.email
      )
      if (myMember) {
        const data = myMember.data()
        // Create new doc at correct path
        await setDoc(doc(db, 'organizations', orgStore.orgId, 'members', authStore.user.uid), {
          userId: authStore.user.uid,
          role: data.role || 'owner',
          email: authStore.user.email || data.email,
          displayName: authStore.profile?.displayName || data.displayName || '',
          invitedBy: data.invitedBy || authStore.user.uid,
          joinedAt: data.joinedAt || serverTimestamp(),
        })
        // Delete old doc
        await deleteDoc(doc(db, 'organizations', orgStore.orgId, 'members', myMember.id))
        logResult(true, `Migrated member doc from ${myMember.id} to ${authStore.user.uid}`)
      }
    } else if (fixId === 'member-missing') {
      await setDoc(doc(db, 'organizations', orgStore.orgId, 'members', authStore.user.uid), {
        userId: authStore.user.uid,
        role: 'owner',
        email: authStore.user.email,
        displayName: authStore.profile?.displayName || '',
        invitedBy: authStore.user.uid,
        joinedAt: serverTimestamp(),
      })
      logResult(true, 'Created member doc as owner')
    } else if (fixId === 'settings-missing') {
      const org = orgStore.currentOrg
      await setDoc(doc(db, 'organizations', orgStore.orgId, 'settings', 'general'), {
        fiscalYearStart: org?.fiscalYearStart || 1,
        currency: org?.currency || 'GHS',
        taxRates: [],
        invoicePrefix: 'INV-',
        nextInvoiceNum: 1,
      })
      logResult(true, 'Created settings doc')
    }

    // Re-run health check after fix
    await runHealthCheck()
    // Re-subscribe to pick up changes
    subscribeAll()
    orgStore.subscribeMembers()
  } catch (e: any) {
    logResult(false, `Fix "${fixId}" failed: ${e.code || e.message}`)
  } finally {
    fixing.value[fixId] = false
  }
}

onMounted(async () => {
  subscribeAll()
  if (orgStore.orgId) {
    setTimeout(() => {
      countFirestore()
      runHealthCheck()
    }, 800)
  }
})

// ---- Logs viewer ----
const logLevelFilter = ref<'all' | LogLevel>('all')
const logScopeFilter = ref<'all' | string>('all')

const logLevelOptions = [
  { title: 'All levels', value: 'all' },
  { title: 'Debug+', value: 'debug' },
  { title: 'Info+', value: 'info' },
  { title: 'Warn+', value: 'warn' },
  { title: 'Error only', value: 'error' },
]

const levelRank: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const logScopeOptions = computed(() => {
  const scopes = new Set<string>()
  for (const e of logs.entries) scopes.add(e.scope)
  return [
    { title: 'All scopes', value: 'all' },
    ...Array.from(scopes).sort().map((s) => ({ title: s, value: s })),
  ]
})

const filteredLogs = computed(() => {
  let list = [...logs.entries].reverse()
  if (logLevelFilter.value !== 'all') {
    const min = levelRank[logLevelFilter.value as LogLevel]
    list = list.filter((e) => levelRank[e.level] >= min)
  }
  if (logScopeFilter.value !== 'all') {
    list = list.filter((e) => e.scope === logScopeFilter.value)
  }
  return list.slice(0, 200)
})

function levelColor(level: LogLevel): string {
  return { debug: '#9E9E9E', info: '#1976D2', warn: '#F57C00', error: '#D32F2F' }[level]
}

function scopeColor(scope: string): string {
  const colors: Record<string, string> = {
    auth: '#1976D2', org: '#7B1FA2', router: '#00796B', firebase: '#F57F17',
    accounts: '#388E3C', transactions: '#388E3C',
    customers: '#1565C0', invoices: '#1565C0',
    suppliers: '#C62828', bills: '#C62828',
    banking: '#F57C00', diagnostics: '#5D4037',
  }
  return colors[scope] || '#616161'
}

function formatData(data: any): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function clearLogs() {
  clearLogBuffer()
}
</script>
