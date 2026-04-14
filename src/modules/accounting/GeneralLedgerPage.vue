<template>
  <div>
    <h1 class="text-h4 font-weight-bold mb-6">General Ledger</h1>

    <v-card elevation="1" class="pa-4 mb-4">
      <v-row align="center">
        <v-col cols="12" md="5">
          <v-select
            v-model="selectedAccountId"
            label="Account"
            :items="accountOptions"
            item-title="title"
            item-value="value"
            hide-details
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model="fromDate" label="From" type="date" hide-details />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model="toDate" label="To" type="date" hide-details />
        </v-col>
        <v-col cols="12" md="1">
          <v-btn icon="mdi-refresh" variant="text" @click="refresh" />
        </v-col>
      </v-row>
    </v-card>

    <v-card v-if="selectedAccount" elevation="1">
      <v-card-title>
        {{ selectedAccount.code }} — {{ selectedAccount.name }}
        <v-chip class="ml-2" size="small" variant="tonal">{{ selectedAccount.type }}</v-chip>
      </v-card-title>
      <v-card-subtitle>
        Closing balance: <strong>{{ formatCurrency(closingBalance, currency) }}</strong>
      </v-card-subtitle>
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
          {{ formatCurrency(item.balance, currency) }}
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">No transactions in this period.</div>
        </template>
      </v-data-table>
    </v-card>

    <v-card v-else elevation="1" class="pa-8 text-center text-grey">
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
import { startOfYear } from 'date-fns'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const selectedAccountId = ref<string>('')
const fromDate = ref(formatDateISO(startOfYear(new Date())))
const toDate = ref(formatDateISO(new Date()))
const refreshKey = ref(0)

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
