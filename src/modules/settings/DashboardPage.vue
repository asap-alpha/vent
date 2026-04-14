<template>
  <div>
    <!-- Org Setup Dialog -->
    <v-dialog v-model="showOrgSetup" persistent max-width="500">
      <v-card class="pa-6">
        <v-card-title class="text-h5 mb-2">Set Up Your Organization</v-card-title>
        <v-card-subtitle>Create your first organization to get started.</v-card-subtitle>
        <v-form ref="orgFormRef" class="mt-4" @submit.prevent="createOrg">
          <v-text-field v-model="orgForm.name" label="Organization Name" :rules="[required]" class="mb-2" />
          <v-select
            v-model="orgForm.currency"
            label="Currency"
            :items="currencies"
            item-title="label"
            item-value="value"
            :rules="[required]"
            class="mb-2"
          />
          <v-select
            v-model="orgForm.fiscalYearStart"
            label="Fiscal Year Start Month"
            :items="months"
            item-title="label"
            item-value="value"
            :rules="[required]"
          />
          <v-btn type="submit" color="primary" block size="large" :loading="creatingOrg" class="mt-4">
            Create Organization
          </v-btn>
        </v-form>
      </v-card>
    </v-dialog>

    <!-- Pending Invitations Banner -->
    <div v-if="myInvitations.length > 0" class="mb-4">
      <v-alert
        v-for="inv in myInvitations"
        :key="inv.id"
        type="info"
        variant="tonal"
        class="mb-2"
        :icon="false"
      >
        <div class="d-flex align-center">
          <v-icon class="mr-3">mdi-email</v-icon>
          <div class="flex-grow-1">
            You've been invited to <strong>{{ inv.orgName }}</strong> as
            <v-chip :color="roleColor(inv.role)" size="x-small" variant="tonal" class="mx-1">
              {{ roleLabel(inv.role) }}
            </v-chip>
          </div>
          <v-btn variant="text" color="success" @click="acceptInvitation(inv.id)">Accept</v-btn>
          <v-btn variant="text" @click="declineInvitation(inv.id)">Decline</v-btn>
        </div>
      </v-alert>
    </div>

    <!-- Dashboard Content -->
    <div v-if="orgStore.currentOrg">
      <h1 class="text-h4 font-weight-bold mb-6">Dashboard</h1>

      <v-row>
        <v-col cols="12" md="3">
          <v-card class="pa-4" elevation="1">
            <div class="text-body-2 text-grey">Revenue (MTD)</div>
            <div class="text-h5 font-weight-bold mt-1 text-success">
              {{ formatCurrency(monthRevenue, currency) }}
            </div>
            <div class="text-caption text-grey">{{ monthLabel }}</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="pa-4" elevation="1">
            <div class="text-body-2 text-grey">Expenses (MTD)</div>
            <div class="text-h5 font-weight-bold mt-1 text-error">
              {{ formatCurrency(monthExpenses, currency) }}
            </div>
            <div class="text-caption text-grey">{{ monthLabel }}</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="pa-4" elevation="1">
            <div class="text-body-2 text-grey">Receivables</div>
            <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(totalReceivables, currency) }}</div>
            <div class="text-caption" :class="overdueReceivables > 0 ? 'text-error' : 'text-grey'">
              {{ formatCurrency(overdueReceivables, currency) }} overdue
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="pa-4" elevation="1">
            <div class="text-body-2 text-grey">Payables</div>
            <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(totalPayables, currency) }}</div>
            <div class="text-caption" :class="overduePayables > 0 ? 'text-error' : 'text-grey'">
              {{ formatCurrency(overduePayables, currency) }} overdue
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-2">
        <v-col cols="12" md="4">
          <v-card class="pa-4" elevation="1">
            <div class="text-body-2 text-grey">Cash Position</div>
            <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(cashPosition, currency) }}</div>
            <div class="text-caption text-grey">Across {{ bankingStore.accounts.length }} bank accounts</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card class="pa-4" elevation="1">
            <div class="text-body-2 text-grey">Net Income (MTD)</div>
            <div
              class="text-h5 font-weight-bold mt-1"
              :class="netIncome >= 0 ? 'text-success' : 'text-error'"
            >
              {{ formatCurrency(Math.abs(netIncome), currency) }}
            </div>
            <div class="text-caption text-grey">{{ netIncome >= 0 ? 'Profit' : 'Loss' }} this month</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card class="pa-4" elevation="1">
            <div class="text-body-2 text-grey">Customers / Suppliers</div>
            <div class="text-h5 font-weight-bold mt-1">
              {{ customersStore.customers.length }} / {{ suppliersStore.suppliers.length }}
            </div>
            <div class="text-caption text-grey">Active records</div>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mt-2">
        <v-col cols="12" md="6">
          <v-card elevation="1">
            <v-card-title class="d-flex align-center">
              Recent Invoices
              <v-spacer />
              <v-btn variant="text" size="small" :to="{ name: 'invoices' }">View All</v-btn>
            </v-card-title>
            <v-list v-if="recentInvoices.length > 0" lines="two">
              <v-list-item
                v-for="inv in recentInvoices"
                :key="inv.id"
                :to="{ name: 'invoice-edit', params: { id: inv.id } }"
              >
                <v-list-item-title>
                  {{ inv.number }} — {{ inv.customerName }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(inv.date) }} · Due {{ formatDate(inv.dueDate) }}
                </v-list-item-subtitle>
                <template #append>
                  <div class="text-end">
                    <div class="font-weight-bold">{{ formatCurrency(inv.total, currency) }}</div>
                    <v-chip :color="invoiceStatusColor(inv.status)" size="x-small" variant="tonal">
                      {{ inv.status.replace('_', ' ') }}
                    </v-chip>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <v-card-text v-else class="text-center text-grey pa-8">
              No invoices yet. <router-link :to="{ name: 'invoice-new' }">Create one</router-link>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card elevation="1">
            <v-card-title class="d-flex align-center">
              Recent Bills
              <v-spacer />
              <v-btn variant="text" size="small" :to="{ name: 'bills' }">View All</v-btn>
            </v-card-title>
            <v-list v-if="recentBills.length > 0" lines="two">
              <v-list-item
                v-for="bill in recentBills"
                :key="bill.id"
                :to="{ name: 'bill-edit', params: { id: bill.id } }"
              >
                <v-list-item-title>
                  {{ bill.number }} — {{ bill.supplierName }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(bill.date) }} · Due {{ formatDate(bill.dueDate) }}
                </v-list-item-subtitle>
                <template #append>
                  <div class="text-end">
                    <div class="font-weight-bold">{{ formatCurrency(bill.total, currency) }}</div>
                    <v-chip :color="billStatusColor(bill.status)" size="x-small" variant="tonal">
                      {{ bill.status.replace('_', ' ') }}
                    </v-chip>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <v-card-text v-else class="text-center text-grey pa-8">
              No bills yet. <router-link :to="{ name: 'bill-new' }">Create one</router-link>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationStore } from '@/stores/organization'
import { useTransactionsStore } from '@/stores/transactions'
import { useInvoicesStore } from '@/stores/invoices'
import { useBillsStore } from '@/stores/bills'
import { useCustomersStore } from '@/stores/customers'
import { useSuppliersStore } from '@/stores/suppliers'
import { useBankingStore } from '@/stores/banking'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { roleLabel, roleColor } from '@/utils/permissions'
import { startOfMonth, format } from 'date-fns'
import type { InvoiceStatus } from '@/types/sales'
import type { BillStatus } from '@/types/purchases'

const authStore = useAuthStore()
const orgStore = useOrganizationStore()
const transactionsStore = useTransactionsStore()
const invoicesStore = useInvoicesStore()
const billsStore = useBillsStore()
const customersStore = useCustomersStore()
const suppliersStore = useSuppliersStore()
const bankingStore = useBankingStore()

const showOrgSetup = computed(() =>
  !!authStore.profile && authStore.profile.organizations.length === 0
)

const myInvitations = computed(() => orgStore.myInvitations)

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const monthLabel = computed(() => format(new Date(), 'MMMM yyyy'))

// MTD revenue and expenses
const monthStart = computed(() => startOfMonth(new Date()))

const monthRevenue = computed(() =>
  transactionsStore.sumByType('revenue', monthStart.value, new Date())
)
const monthExpenses = computed(() =>
  transactionsStore.sumByType('expense', monthStart.value, new Date())
)
const netIncome = computed(() => monthRevenue.value - monthExpenses.value)

// Receivables / Payables
const totalReceivables = computed(() =>
  invoicesStore.invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft')
    .reduce((s, i) => s + i.amountDue, 0)
)
const overdueReceivables = computed(() => {
  const now = new Date()
  return invoicesStore.invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft' && i.dueDate < now)
    .reduce((s, i) => s + i.amountDue, 0)
})

const totalPayables = computed(() =>
  billsStore.bills
    .filter((b) => b.status !== 'paid' && b.status !== 'void' && b.status !== 'draft')
    .reduce((s, b) => s + b.amountDue, 0)
)
const overduePayables = computed(() => {
  const now = new Date()
  return billsStore.bills
    .filter((b) => b.status !== 'paid' && b.status !== 'void' && b.status !== 'draft' && b.dueDate < now)
    .reduce((s, b) => s + b.amountDue, 0)
})

// Cash position
const cashPosition = computed(() =>
  bankingStore.accounts.reduce(
    (sum, acc) => sum + bankingStore.currentBalance(acc.id),
    0
  )
)

// Recent records
const recentInvoices = computed(() => invoicesStore.invoices.slice(0, 5))
const recentBills = computed(() => billsStore.bills.slice(0, 5))

function invoiceStatusColor(status: InvoiceStatus): string {
  return {
    draft: 'grey', sent: 'blue', paid: 'success',
    partially_paid: 'orange', overdue: 'error', void: 'grey',
  }[status]
}

function billStatusColor(status: BillStatus): string {
  return {
    draft: 'grey', received: 'blue', paid: 'success',
    partially_paid: 'orange', overdue: 'error', void: 'grey',
  }[status]
}

// Org setup
const orgFormRef = ref()
const creatingOrg = ref(false)
const orgForm = ref({ name: '', currency: 'GHS', fiscalYearStart: 1 })

const currencies = [
  { label: 'Ghana Cedi (GHS)', value: 'GHS' },
  { label: 'US Dollar (USD)', value: 'USD' },
  { label: 'Euro (EUR)', value: 'EUR' },
  { label: 'British Pound (GBP)', value: 'GBP' },
  { label: 'Nigerian Naira (NGN)', value: 'NGN' },
]
const months = [
  { label: 'January', value: 1 }, { label: 'February', value: 2 },
  { label: 'March', value: 3 }, { label: 'April', value: 4 },
  { label: 'May', value: 5 }, { label: 'June', value: 6 },
  { label: 'July', value: 7 }, { label: 'August', value: 8 },
  { label: 'September', value: 9 }, { label: 'October', value: 10 },
  { label: 'November', value: 11 }, { label: 'December', value: 12 },
]

async function createOrg() {
  const { valid } = await orgFormRef.value.validate()
  if (!valid) return
  creatingOrg.value = true
  try {
    await orgStore.createOrganization(orgForm.value.name, orgForm.value.currency, orgForm.value.fiscalYearStart)
  } finally {
    creatingOrg.value = false
  }
}

async function acceptInvitation(id: string) {
  try {
    await orgStore.acceptInvitation(id)
  } catch (e: any) {
    alert(e.message)
  }
}

async function declineInvitation(id: string) {
  await orgStore.declineInvitation(id)
}

function subscribeAll() {
  if (!orgStore.orgId) return
  transactionsStore.subscribe()
  invoicesStore.subscribe()
  billsStore.subscribe()
  customersStore.subscribe()
  suppliersStore.subscribe()
  bankingStore.subscribe()
}

onMounted(async () => {
  // Watch for incoming invitations
  orgStore.subscribeMyInvitations()

  if (authStore.profile && authStore.profile.organizations.length > 0) {
    await orgStore.fetchOrganizations()
  }
  subscribeAll()
})

watch(() => orgStore.orgId, () => subscribeAll())
</script>
