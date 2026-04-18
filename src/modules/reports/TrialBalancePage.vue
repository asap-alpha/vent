<template>
  <div class="trial-balance-report">
    <PageHeader title="Trial Balance" />

    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-btn-toggle v-model="period" mandatory density="compact" rounded="lg" variant="outlined">
        <v-btn value="today" size="small">Today</v-btn>
        <v-btn value="month" size="small">Month End</v-btn>
        <v-btn value="quarter" size="small">Quarter End</v-btn>
        <v-btn value="year" size="small">Year End</v-btn>
        <v-btn value="custom" size="small">Custom</v-btn>
      </v-btn-toggle>
      <template v-if="period === 'custom'">
        <v-text-field v-model="asOfDate" type="date" label="As of" density="compact" hide-details style="max-width: 160px" />
      </template>
    </div>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="rows"
        :items-per-page="-1"
        hide-default-footer
      >
        <template #item.debit="{ item }">
          {{ item.debit > 0 ? formatCurrency(item.debit, currency) : '' }}
        </template>
        <template #item.credit="{ item }">
          {{ item.credit > 0 ? formatCurrency(item.credit, currency) : '' }}
        </template>
        <template #body.append>
          <tr class="font-weight-bold bg-grey-lighten-4">
            <td colspan="3">Totals</td>
            <td class="text-end">{{ formatCurrency(totalDebits, currency) }}</td>
            <td class="text-end">{{ formatCurrency(totalCredits, currency) }}</td>
          </tr>
          <tr v-if="!balanced">
            <td colspan="5">
              <v-alert type="warning" variant="tonal" density="compact" class="mb-0">
                Out of balance by {{ formatCurrency(Math.abs(totalDebits - totalCredits), currency) }}
              </v-alert>
            </td>
          </tr>
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">No posted entries yet.</div>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'
import { formatDateISO } from '@/utils/date'
import { endOfMonth, endOfQuarter, endOfYear, subMonths, subQuarters } from 'date-fns'
import PageHeader from '@/components/common/PageHeader.vue'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const period = ref('today')
const asOfDate = ref(formatDateISO(new Date()))

watch(period, (val) => {
  const now = new Date()
  if (val === 'today') {
    asOfDate.value = formatDateISO(now)
  } else if (val === 'month') {
    asOfDate.value = formatDateISO(endOfMonth(subMonths(now, 1)))
  } else if (val === 'quarter') {
    asOfDate.value = formatDateISO(endOfQuarter(subQuarters(now, 1)))
  } else if (val === 'year') {
    asOfDate.value = formatDateISO(endOfYear(new Date(now.getFullYear() - 1, 0, 1)))
  }
})

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const rows = computed(() =>
  transactionsStore.getTrialBalance(asOfDate.value ? new Date(asOfDate.value) : undefined)
)

const totalDebits = computed(() => rows.value.reduce((s, r) => s + r.debit, 0))
const totalCredits = computed(() => rows.value.reduce((s, r) => s + r.credit, 0))
const balanced = computed(() => Math.abs(totalDebits.value - totalCredits.value) < 0.005)

const headers = [
  { title: 'Code', key: 'accountCode', width: 100 },
  { title: 'Account', key: 'accountName' },
  { title: 'Type', key: 'accountType', width: 120 },
  { title: 'Debit', key: 'debit', align: 'end' as const, width: 160 },
  { title: 'Credit', key: 'credit', align: 'end' as const, width: 160 },
]

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
  .trial-balance-report {
    padding: 0;
  }
}
</style>
