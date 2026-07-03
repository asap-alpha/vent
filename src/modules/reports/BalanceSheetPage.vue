<template>
  <div class="balance-sheet-report">
    <PageHeader title="Balance Sheet" />

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

    <v-row>
      <!-- Assets -->
      <v-col cols="12" md="6">
        <v-card class="mb-4">
          <v-card-text class="pa-5">
            <div class="text-subtitle-2 font-weight-bold mb-3">Assets</div>
            <v-table density="comfortable">
              <tbody>
                <tr v-for="acc in assetAccounts" :key="acc.id">
                  <td>{{ acc.code }} — {{ acc.name }}</td>
                  <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
                </tr>
                <tr v-if="assetAccounts.length === 0">
                  <td colspan="2" class="text-center text-grey">No asset accounts</td>
                </tr>
                <tr class="font-weight-bold">
                  <td>Total Assets</td>
                  <td class="text-end">{{ formatCurrency(totalAssets, currency) }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Liabilities + Equity -->
      <v-col cols="12" md="6">
        <v-card class="mb-4">
          <v-card-text class="pa-5">
            <div class="text-subtitle-2 font-weight-bold mb-3">Liabilities</div>
            <v-table density="comfortable">
              <tbody>
                <tr v-for="acc in liabilityAccounts" :key="acc.id">
                  <td>{{ acc.code }} — {{ acc.name }}</td>
                  <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
                </tr>
                <tr v-if="liabilityAccounts.length === 0">
                  <td colspan="2" class="text-center text-grey">No liability accounts</td>
                </tr>
                <tr class="font-weight-bold">
                  <td>Total Liabilities</td>
                  <td class="text-end">{{ formatCurrency(totalLiabilities, currency) }}</td>
                </tr>
              </tbody>
            </v-table>

            <v-divider class="my-4" />

            <div class="text-subtitle-2 font-weight-bold mb-3">Equity</div>
            <v-table density="comfortable">
              <tbody>
                <tr v-for="acc in equityAccounts" :key="acc.id">
                  <td>{{ acc.code }} — {{ acc.name }}</td>
                  <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
                </tr>
                <tr>
                  <td>Retained Earnings (prior years)</td>
                  <td class="text-end">{{ formatCurrency(priorYearRetained, currency) }}</td>
                </tr>
                <tr>
                  <td>Current Year Earnings</td>
                  <td class="text-end">{{ formatCurrency(currentYearEarnings, currency) }}</td>
                </tr>
                <tr class="font-weight-bold">
                  <td>Total Equity</td>
                  <td class="text-end">{{ formatCurrency(totalEquity, currency) }}</td>
                </tr>
                <tr class="font-weight-bold">
                  <td>Total Liabilities + Equity</td>
                  <td class="text-end">{{ formatCurrency(totalLiabilities + totalEquity, currency) }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-alert
      v-if="!balanced"
      type="warning"
      variant="tonal"
      class="mt-2"
    >
      Balance sheet does not balance.
      Difference: {{ formatCurrency(Math.abs(totalAssets - (totalLiabilities + totalEquity)), currency) }}
    </v-alert>
    <v-alert
      v-else
      type="success"
      variant="tonal"
      class="mt-2"
    >
      Balance sheet is balanced.
    </v-alert>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'
import { formatDateISO, endOfLocalDay } from '@/utils/date'
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

const assetAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'asset').sort((a, b) => a.code.localeCompare(b.code))
)
const liabilityAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'liability').sort((a, b) => a.code.localeCompare(b.code))
)
// Exclude the tagged Retained Earnings account — it's presented as an auto-computed
// figure below (prior-year + current-year earnings), the way Manager/Xero do it.
const equityAccounts = computed(() =>
  accountsStore.accounts
    .filter((a) => a.type === 'equity' && a.systemType !== 'retained_earnings')
    .sort((a, b) => a.code.localeCompare(b.code))
)

function getBalance(accountId: string): number {
  return transactionsStore.getAccountBalance(
    accountId,
    asOfDate.value ? endOfLocalDay(asOfDate.value) : undefined
  )
}

const totalAssets = computed(() => assetAccounts.value.reduce((s, a) => s + getBalance(a.id), 0))
const totalLiabilities = computed(() => liabilityAccounts.value.reduce((s, a) => s + getBalance(a.id), 0))

const asOf = computed(() => (asOfDate.value ? endOfLocalDay(asOfDate.value) : new Date()))

// First day of the fiscal year containing `d`, honoring the org's fiscalYearStart
// (a month, 1-12; defaults to January).
function fiscalYearStartFor(d: Date): Date {
  const startMonth = orgStore.currentOrg?.fiscalYearStart || 1
  const year = d.getMonth() + 1 >= startMonth ? d.getFullYear() : d.getFullYear() - 1
  return new Date(year, startMonth - 1, 1, 0, 0, 0, 0)
}

// Retained earnings accumulated from all fiscal years BEFORE the current one.
const priorYearRetained = computed(() => {
  const priorEnd = new Date(fiscalYearStartFor(asOf.value).getTime() - 1)
  return transactionsStore.sumByType('revenue', undefined, priorEnd) -
         transactionsStore.sumByType('expense', undefined, priorEnd)
})

// Net income earned within the current fiscal year, up to the as-of date.
const currentYearEarnings = computed(() => {
  const fyStart = fiscalYearStartFor(asOf.value)
  return transactionsStore.sumByType('revenue', fyStart, asOf.value) -
         transactionsStore.sumByType('expense', fyStart, asOf.value)
})

// Total retained earnings up to the as-of date (used for the balancing check).
const retainedEarnings = computed(() => priorYearRetained.value + currentYearEarnings.value)

const totalEquity = computed(
  () => equityAccounts.value.reduce((s, a) => s + getBalance(a.id), 0) + retainedEarnings.value
)

const balanced = computed(
  () => Math.abs(totalAssets.value - (totalLiabilities.value + totalEquity.value)) < 0.005
)

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
  .balance-sheet-report {
    padding: 0;
  }
}
</style>
