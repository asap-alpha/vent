<template>
  <div class="general-ledger-report">
    <PageHeader title="General Ledger" />

    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-btn-toggle v-model="period" mandatory density="compact" rounded="lg" variant="outlined">
        <v-btn value="month" size="small">This Month</v-btn>
        <v-btn value="quarter" size="small">Quarter</v-btn>
        <v-btn value="year" size="small">YTD</v-btn>
        <v-btn value="custom" size="small">Custom</v-btn>
      </v-btn-toggle>
      <template v-if="period === 'custom'">
        <v-text-field v-model="fromDate" type="date" label="From" density="compact" hide-details style="max-width: 160px" />
        <v-text-field v-model="toDate" type="date" label="To" density="compact" hide-details style="max-width: 160px" />
      </template>
    </div>

    <v-card class="mb-4">
      <v-card-text class="pa-5">
        <div class="text-subtitle-2 font-weight-bold mb-3">Select Account</div>
        <v-row align="center">
          <v-col cols="12" md="8">
            <v-select
              v-model="selectedAccountId"
              label="Account"
              :items="accountOptions"
              item-title="title"
              item-value="value"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="4" class="d-flex justify-end">
            <v-btn variant="outlined" prepend-icon="mdi-refresh" @click="refresh">Refresh</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card v-if="selectedAccount">
      <v-card-text class="pa-5 pb-0">
        <div class="d-flex align-center flex-wrap ga-2">
          <div>
            <div class="text-subtitle-2 font-weight-bold">{{ selectedAccount.code }} — {{ selectedAccount.name }}</div>
            <div class="text-body-2 text-medium-emphasis">
              Closing balance: <strong>{{ formatCurrency(closingBalance, currency) }}</strong>
            </div>
          </div>
          <v-spacer />
          <v-chip size="small" variant="tonal">{{ selectedAccount.type }}</v-chip>
        </div>
      </v-card-text>
      <v-data-table
        :headers="headers"
        :items="ledgerEntries"
        :items-per-page="50"
      >
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.debit="{ item }">
          {{ item.debit > 0 ? formatCurrency(item.debit, currency) : '' }}
        </template>
        <template #item.credit="{ item }">
          {{ item.credit > 0 ? formatCurrency(item.credit, currency) : '' }}
        </template>
        <template #item.balance="{ item }">
          <strong>{{ formatCurrency(item.balance, currency) }}</strong>
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">No transactions in this period.</div>
        </template>
      </v-data-table>
    </v-card>

    <v-card v-else class="pa-8 text-center text-medium-emphasis">
      Select an account to view its ledger.
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO } from '@/utils/date'
import { startOfYear, startOfMonth, startOfQuarter } from 'date-fns'
import PageHeader from '@/components/common/PageHeader.vue'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const period = ref('year')
const selectedAccountId = ref<string>('')
const fromDate = ref(formatDateISO(startOfYear(new Date())))
const toDate = ref(formatDateISO(new Date()))
const refreshKey = ref(0)

watch(period, (val) => {
  const now = new Date()
  if (val === 'month') {
    fromDate.value = formatDateISO(startOfMonth(now))
    toDate.value = formatDateISO(now)
  } else if (val === 'quarter') {
    fromDate.value = formatDateISO(startOfQuarter(now))
    toDate.value = formatDateISO(now)
  } else if (val === 'year') {
    fromDate.value = formatDateISO(startOfYear(now))
    toDate.value = formatDateISO(now)
  }
})

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const accountOptions = computed(() =>
  accountsStore.activeAccounts.map((a) => ({
    title: `${a.code} — ${a.name}`,
    value: a.id,
  }))
)

const selectedAccount = computed(() =>
  selectedAccountId.value ? accountsStore.getAccount(selectedAccountId.value) : null
)

const ledgerEntries = computed(() => {
  void refreshKey.value
  if (!selectedAccountId.value) return []
  return transactionsStore.getLedger(
    selectedAccountId.value,
    fromDate.value ? new Date(fromDate.value) : undefined,
    toDate.value ? new Date(toDate.value) : undefined
  )
})

const closingBalance = computed(() =>
  ledgerEntries.value.length > 0
    ? ledgerEntries.value[ledgerEntries.value.length - 1].balance
    : 0
)

const headers = [
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Reference', key: 'reference', width: 130 },
  { title: 'Description', key: 'description' },
  { title: 'Debit', key: 'debit', align: 'end' as const, width: 140 },
  { title: 'Credit', key: 'credit', align: 'end' as const, width: 140 },
  { title: 'Balance', key: 'balance', align: 'end' as const, width: 160 },
]

function refresh() {
  refreshKey.value++
}

onMounted(() => {
  if (orgStore.orgId) {
    accountsStore.subscribe()
    transactionsStore.subscribe()
  }
})

watch(
  () => orgStore.orgId,
  (id) => {
    if (id) {
      accountsStore.subscribe()
      transactionsStore.subscribe()
    }
  }
)
</script>

<style scoped>
@media print {
  .v-navigation-drawer,
  .v-app-bar,
  .v-btn-toggle {
    display: none !important;
  }
  .general-ledger-report {
    padding: 0;
  }
}
</style>
