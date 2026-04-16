<template>
  <div>
    <!-- Onboarding: no org and no invitations — force org creation -->
    <v-dialog v-model="showOrgSetup" persistent max-width="480">
      <v-card class="pa-6">
        <div class="text-center mb-4">
          <v-icon size="48" color="primary">mdi-finance</v-icon>
          <h2 class="text-h5 font-weight-bold mt-2">Set Up Your Organization</h2>
          <p class="text-body-2 text-medium-emphasis mt-1">Create your first organization to get started.</p>
        </div>
        <v-form ref="orgFormRef" @submit.prevent="createOrg">
          <v-text-field v-model="orgForm.name" label="Organization Name" :rules="[required]" class="mb-3" />
          <v-select
            v-model="orgForm.currency"
            label="Currency"
            :items="currencies"
            item-title="label"
            item-value="value"
            :rules="[required]"
            class="mb-3"
          />
          <v-select
            v-model="orgForm.fiscalYearStart"
            label="Fiscal Year Start"
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

    <!-- Pending Invitations — shown for users with no org or as banners -->
    <template v-if="myInvitations.length > 0">
      <!-- Full welcome screen when user has no org yet -->
      <v-card v-if="!orgStore.currentOrg" class="mb-4 pa-6">
        <div class="text-center mb-4">
          <v-icon size="48" color="primary">mdi-email-open-outline</v-icon>
          <h2 class="text-h5 font-weight-bold mt-2">You have {{ myInvitations.length }} invitation{{ myInvitations.length > 1 ? 's' : '' }}</h2>
          <p class="text-body-2 text-medium-emphasis mt-1">Accept an invitation to join an organization, or create your own.</p>
        </div>

        <v-list lines="two" class="mb-4">
          <v-list-item
            v-for="inv in myInvitations"
            :key="inv.id"
            class="mb-2"
          >
            <template #prepend>
              <v-avatar color="primary" size="40">
                <v-icon color="white">mdi-office-building</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title class="font-weight-bold">{{ inv.orgName }}</v-list-item-title>
            <v-list-item-subtitle>
              Invited as
              <v-chip :color="roleColor(inv.role)" size="x-small" class="ml-1">{{ roleLabel(inv.role) }}</v-chip>
            </v-list-item-subtitle>
            <template #append>
              <v-btn size="small" color="success" variant="flat" class="mr-2" @click="acceptInvitation(inv.id)">Accept</v-btn>
              <v-btn size="small" variant="text" @click="declineInvitation(inv.id)">Decline</v-btn>
            </template>
          </v-list-item>
        </v-list>

        <v-divider class="my-4" />
        <div class="text-center">
          <p class="text-body-2 text-medium-emphasis mb-3">Or start fresh with your own organization</p>
          <v-btn variant="outlined" prepend-icon="mdi-plus" @click="createOrgDialog.open()">
            Create My Own Organization
          </v-btn>
        </div>
      </v-card>

      <!-- Compact banners when user already has an org -->
      <template v-else>
        <v-alert
          v-for="inv in myInvitations"
          :key="inv.id"
          type="info"
          class="mb-3"
        >
          <div class="d-flex align-center flex-wrap ga-2">
            <span>
              You've been invited to <strong>{{ inv.orgName }}</strong> as
              <v-chip :color="roleColor(inv.role)" class="mx-1">{{ roleLabel(inv.role) }}</v-chip>
            </span>
            <v-spacer />
            <v-btn size="small" color="success" variant="flat" @click="acceptInvitation(inv.id)">Accept</v-btn>
            <v-btn size="small" variant="text" @click="declineInvitation(inv.id)">Decline</v-btn>
          </div>
        </v-alert>
      </template>
    </template>

    <!-- Dashboard -->
    <!-- Org pending / rejected / suspended -->
    <v-card v-if="orgStore.currentOrg && !orgStore.isOrgApproved" class="mb-4 pa-6">
      <div class="text-center">
        <v-icon
          size="56"
          :color="orgStore.orgStatus === 'pending' ? 'warning' : 'error'"
          class="mb-4"
        >
          {{ orgStore.orgStatus === 'pending' ? 'mdi-clock-outline' : orgStore.orgStatus === 'rejected' ? 'mdi-close-circle-outline' : 'mdi-lock-outline' }}
        </v-icon>
        <h2 class="text-h5 font-weight-bold mb-2">
          {{ orgStore.orgStatus === 'pending' ? 'Organization Pending Approval' : orgStore.orgStatus === 'rejected' ? 'Organization Rejected' : 'Organization Suspended' }}
        </h2>
        <p class="text-body-1 text-medium-emphasis mb-2" style="max-width: 480px; margin: 0 auto">
          <template v-if="orgStore.orgStatus === 'pending'">
            Your organization <strong>{{ orgStore.orgName }}</strong> has been submitted for review. You'll be able to use it once a super admin approves it.
          </template>
          <template v-else-if="orgStore.orgStatus === 'rejected'">
            Your organization <strong>{{ orgStore.orgName }}</strong> was not approved.
            <span v-if="orgStore.currentOrg.rejectionReason" class="d-block mt-2">
              <strong>Reason:</strong> {{ orgStore.currentOrg.rejectionReason }}
            </span>
          </template>
          <template v-else>
            Your organization <strong>{{ orgStore.orgName }}</strong> has been suspended. Please contact your administrator.
          </template>
        </p>
        <v-chip :color="orgStore.orgStatus === 'pending' ? 'warning' : 'error'" class="mt-2">
          {{ orgStore.orgStatus.charAt(0).toUpperCase() + orgStore.orgStatus.slice(1) }}
        </v-chip>
      </div>
    </v-card>

    <div v-if="orgStore.currentOrg && orgStore.isOrgApproved">
      <!-- Quick Actions -->
      <div class="d-flex align-center flex-wrap ga-2 mb-6">
        <h1 class="text-h5 font-weight-bold mr-auto">Dashboard</h1>
        <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'invoice-new' }" size="small">Invoice</v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-plus" :to="{ name: 'bill-new' }" size="small">Bill</v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-plus" :to="{ name: 'journal-entry-new' }" size="small">Journal Entry</v-btn>
      </div>

      <!-- KPI Cards -->
      <v-row>
        <v-col cols="6" md="3">
          <v-card class="kpi-card kpi-green">
            <v-card-text class="pa-4">
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Revenue (MTD)</div>
              <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(monthRevenue, currency) }}</div>
              <div class="text-caption text-medium-emphasis">{{ monthLabel }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card class="kpi-card kpi-red">
            <v-card-text class="pa-4">
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Expenses (MTD)</div>
              <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(monthExpenses, currency) }}</div>
              <div class="text-caption text-medium-emphasis">{{ monthLabel }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card class="kpi-card kpi-blue">
            <v-card-text class="pa-4">
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Receivables</div>
              <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(totalReceivables, currency) }}</div>
              <div class="text-caption" :class="overdueReceivables > 0 ? 'text-error' : 'text-medium-emphasis'">
                {{ formatCurrency(overdueReceivables, currency) }} overdue
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card class="kpi-card kpi-orange">
            <v-card-text class="pa-4">
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Payables</div>
              <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(totalPayables, currency) }}</div>
              <div class="text-caption" :class="overduePayables > 0 ? 'text-error' : 'text-medium-emphasis'">
                {{ formatCurrency(overduePayables, currency) }} overdue
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Cash + Net Income -->
      <v-row class="mt-1">
        <v-col cols="12" md="4">
          <v-card>
            <v-card-text class="pa-4">
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Cash Position</div>
              <div class="text-h5 font-weight-bold mt-1">{{ formatCurrency(cashPosition, currency) }}</div>
              <div class="text-caption text-medium-emphasis">{{ bankingStore.accounts.length }} account(s)</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card>
            <v-card-text class="pa-4">
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Net Income (MTD)</div>
              <div class="text-h5 font-weight-bold mt-1" :class="netIncome >= 0 ? 'text-success' : 'text-error'">
                {{ formatCurrency(Math.abs(netIncome), currency) }}
              </div>
              <div class="text-caption text-medium-emphasis">{{ netIncome >= 0 ? 'Profit' : 'Loss' }}</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="4">
          <v-card>
            <v-card-text class="pa-4">
              <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Records</div>
              <div class="text-h5 font-weight-bold mt-1">
                {{ customersStore.customers.length + suppliersStore.suppliers.length }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ customersStore.customers.length }} customers, {{ suppliersStore.suppliers.length }} suppliers
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Recent Activity -->
      <v-row class="mt-1">
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title class="d-flex align-center text-subtitle-2 font-weight-bold pa-4 pb-0">
              Recent Invoices
              <v-spacer />
              <v-btn variant="text" size="x-small" :to="{ name: 'invoices' }" append-icon="mdi-chevron-right">
                View all
              </v-btn>
            </v-card-title>
            <v-list v-if="recentInvoices.length > 0" lines="two" density="compact">
              <v-list-item
                v-for="inv in recentInvoices"
                :key="inv.id"
                :to="{ name: 'invoice-edit', params: { id: inv.id } }"
              >
                <template #prepend>
                  <div class="status-dot mr-3" :class="`dot-${inv.status}`" />
                </template>
                <v-list-item-title class="text-body-2">
                  <strong>{{ inv.number }}</strong> — {{ inv.customerName }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ formatDate(inv.date) }}
                </v-list-item-subtitle>
                <template #append>
                  <span class="text-body-2 font-weight-medium">{{ formatCurrency(inv.total, currency) }}</span>
                </template>
              </v-list-item>
            </v-list>
            <EmptyState
              v-else
              icon="mdi-receipt-text-outline"
              title="No invoices yet"
              description="Create your first invoice to start tracking revenue."
              action-label="Create Invoice"
              action-icon="mdi-plus"
              :action-to="{ name: 'invoice-new' }"
            />
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card>
            <v-card-title class="d-flex align-center text-subtitle-2 font-weight-bold pa-4 pb-0">
              Recent Bills
              <v-spacer />
              <v-btn variant="text" size="x-small" :to="{ name: 'bills' }" append-icon="mdi-chevron-right">
                View all
              </v-btn>
            </v-card-title>
            <v-list v-if="recentBills.length > 0" lines="two" density="compact">
              <v-list-item
                v-for="bill in recentBills"
                :key="bill.id"
                :to="{ name: 'bill-edit', params: { id: bill.id } }"
              >
                <template #prepend>
                  <div class="status-dot mr-3" :class="`dot-${bill.status}`" />
                </template>
                <v-list-item-title class="text-body-2">
                  <strong>{{ bill.number }}</strong> — {{ bill.supplierName }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ formatDate(bill.date) }}
                </v-list-item-subtitle>
                <template #append>
                  <span class="text-body-2 font-weight-medium">{{ formatCurrency(bill.total, currency) }}</span>
                </template>
              </v-list-item>
            </v-list>
            <EmptyState
              v-else
              icon="mdi-file-document-outline"
              title="No bills yet"
              description="Record bills from your suppliers here."
              action-label="Create Bill"
              action-icon="mdi-plus"
              :action-to="{ name: 'bill-new' }"
            />
          </v-card>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
import EmptyState from '@/components/common/EmptyState.vue'
import { useCreateOrg } from '@/composables/useCreateOrg'

const authStore = useAuthStore()
const orgStore = useOrganizationStore()
const transactionsStore = useTransactionsStore()
const invoicesStore = useInvoicesStore()
const billsStore = useBillsStore()
const customersStore = useCustomersStore()
const suppliersStore = useSuppliersStore()
const bankingStore = useBankingStore()

// Only force the org setup dialog when user has NO orgs AND NO pending invitations
const showOrgSetup = computed(() =>
  !!authStore.profile &&
  authStore.profile.organizations.length === 0 &&
  myInvitations.value.length === 0
)
const myInvitations = computed(() => orgStore.myInvitations)
const createOrgDialog = useCreateOrg()
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const monthLabel = computed(() => format(new Date(), 'MMMM yyyy'))
const monthStart = computed(() => startOfMonth(new Date()))

const monthRevenue = computed(() => transactionsStore.sumByType('revenue', monthStart.value, new Date()))
const monthExpenses = computed(() => transactionsStore.sumByType('expense', monthStart.value, new Date()))
const netIncome = computed(() => monthRevenue.value - monthExpenses.value)

const totalReceivables = computed(() =>
  invoicesStore.invoices.filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft').reduce((s, i) => s + i.amountDue, 0)
)
const overdueReceivables = computed(() => {
  const now = new Date()
  return invoicesStore.invoices.filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'draft' && i.dueDate < now).reduce((s, i) => s + i.amountDue, 0)
})
const totalPayables = computed(() =>
  billsStore.bills.filter((b) => b.status !== 'paid' && b.status !== 'void' && b.status !== 'draft').reduce((s, b) => s + b.amountDue, 0)
)
const overduePayables = computed(() => {
  const now = new Date()
  return billsStore.bills.filter((b) => b.status !== 'paid' && b.status !== 'void' && b.status !== 'draft' && b.dueDate < now).reduce((s, b) => s + b.amountDue, 0)
})
const cashPosition = computed(() =>
  bankingStore.accounts.reduce((sum, acc) => sum + bankingStore.currentBalance(acc.id), 0)
)
const recentInvoices = computed(() => invoicesStore.invoices.slice(0, 5))
const recentBills = computed(() => billsStore.bills.slice(0, 5))

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
  try { await orgStore.acceptInvitation(id) } catch (e: any) { alert(e.message) }
}
async function declineInvitation(id: string) {
  await orgStore.declineInvitation(id)
}

onMounted(() => {})
</script>

<style scoped>
.kpi-card {
  border-left: 4px solid transparent !important;
}
.kpi-green { border-left-color: #16A34A !important; }
.kpi-red { border-left-color: #DC2626 !important; }
.kpi-blue { border-left-color: #2563EB !important; }
.kpi-orange { border-left-color: #D97706 !important; }

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-draft { background: #94A3B8; }
.dot-sent, .dot-received { background: #2563EB; }
.dot-paid { background: #16A34A; }
.dot-partially_paid { background: #D97706; }
.dot-overdue { background: #DC2626; }
.dot-void { background: #CBD5E1; }
</style>
