<template>
  <div class="profit-loss-report">
    <PageHeader title="Profit &amp; Loss">
      <template #actions>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-file-pdf-box"
          @click="downloadPdf"
        >
          Download PDF
        </v-btn>
      </template>
    </PageHeader>

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
        <div class="text-subtitle-2 font-weight-bold mb-3">Income</div>
        <v-table density="comfortable">
          <tbody>
            <tr v-for="acc in revenueAccounts" :key="acc.id">
              <td>{{ acc.code }} — {{ acc.name }}</td>
              <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
            </tr>
            <tr v-if="revenueAccounts.length === 0">
              <td colspan="2" class="text-center text-grey">No income accounts</td>
            </tr>
            <tr class="font-weight-bold">
              <td>Total — Income</td>
              <td class="text-end">{{ formatCurrency(totalRevenue, currency) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-divider class="my-4" />

        <div class="text-subtitle-2 font-weight-bold mb-3">Cost of Sales</div>
        <v-table density="comfortable">
          <tbody>
            <tr v-for="acc in costOfSalesAccounts" :key="acc.id">
              <td>{{ acc.code }} — {{ acc.name }}</td>
              <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
            </tr>
            <tr v-if="costOfSalesAccounts.length === 0">
              <td colspan="2" class="text-center text-grey">No cost of sales accounts</td>
            </tr>
            <tr class="font-weight-bold">
              <td>Total — Cost of Sales</td>
              <td class="text-end">{{ formatCurrency(totalCostOfSales, currency) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-divider class="my-4" />

        <div class="d-flex align-center px-3 py-2 rounded bg-grey-lighten-4 mb-4">
          <span class="text-subtitle-2 font-weight-bold">Gross Profit</span>
          <v-spacer />
          <span class="text-subtitle-1 font-weight-bold">
            {{ formatCurrency(grossProfit, currency) }}
          </span>
        </div>

        <div class="text-subtitle-2 font-weight-bold mb-3">Less: Expenses</div>
        <v-table density="comfortable">
          <tbody>
            <tr v-for="acc in expenseAccounts" :key="acc.id">
              <td>{{ acc.code }} — {{ acc.name }}</td>
              <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
            </tr>
            <tr v-if="expenseAccounts.length === 0">
              <td colspan="2" class="text-center text-grey">No expense accounts</td>
            </tr>
            <tr class="font-weight-bold">
              <td>Total — Expenses</td>
              <td class="text-end">{{ formatCurrency(totalExpenses, currency) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-divider class="my-4" />

        <div class="d-flex align-center pa-3 rounded" :class="netIncome >= 0 ? 'bg-success' : 'bg-error'">
          <h3 class="text-h6 text-white">Net {{ netIncome >= 0 ? 'Profit' : 'Loss' }}</h3>
          <v-spacer />
          <h3 class="text-h5 text-white font-weight-bold">
            {{ formatCurrency(Math.abs(netIncome), currency) }}
          </h3>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO, startOfLocalDay, endOfLocalDay } from '@/utils/date'
import { startOfYear, startOfMonth, startOfQuarter } from 'date-fns'
import { exportStatementPDF, type StatementRow } from '@/utils/pdf'
import { accountsInSubtype } from '@/utils/accountClassification'
import PageHeader from '@/components/common/PageHeader.vue'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const period = ref('year')
const fromDate = ref(formatDateISO(startOfYear(new Date())))
const toDate = ref(formatDateISO(new Date()))

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

const revenueAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'revenue').sort((a, b) => a.code.localeCompare(b.code))
)
// Expense accounts split by subtype: cost of sales is presented above the Gross Profit
// line, operating expenses below it.
const costOfSalesAccounts = computed(() =>
  accountsInSubtype(accountsStore.accounts, 'cost_of_sales')
)
const expenseAccounts = computed(() =>
  accountsInSubtype(accountsStore.accounts, 'operating_expense')
)

function getBalance(accountId: string): number {
  const from = fromDate.value ? startOfLocalDay(fromDate.value) : undefined
  const to = toDate.value ? endOfLocalDay(toDate.value) : undefined

  // Sum debits/credits for this account in date range
  const account = accountsStore.getAccount(accountId)
  if (!account) return 0
  let debits = 0
  let credits = 0
  for (const entry of transactionsStore.postedEntries) {
    if (from && entry.date < from) continue
    if (to && entry.date > to) continue
    for (const line of entry.lines) {
      if (line.accountId === accountId) {
        debits += line.debit || 0
        credits += line.credit || 0
      }
    }
  }
  // Revenue: credit normal, Expense: debit normal
  return account.type === 'revenue' ? credits - debits : debits - credits
}

const totalRevenue = computed(() =>
  revenueAccounts.value.reduce((s, a) => s + getBalance(a.id), 0)
)
const totalCostOfSales = computed(() =>
  costOfSalesAccounts.value.reduce((s, a) => s + getBalance(a.id), 0)
)
const totalExpenses = computed(() =>
  expenseAccounts.value.reduce((s, a) => s + getBalance(a.id), 0)
)
const grossProfit = computed(() => totalRevenue.value - totalCostOfSales.value)
const netIncome = computed(() => grossProfit.value - totalExpenses.value)

function downloadPdf() {
  const org = orgStore.currentOrg
  if (!org) return

  const rows: StatementRow[] = []

  rows.push({ kind: 'heading', label: 'Income' })
  for (const acc of revenueAccounts.value) {
    rows.push({ kind: 'line', label: `${acc.code} — ${acc.name}`, value: getBalance(acc.id), indent: true })
  }
  rows.push({ kind: 'subtotal', label: 'Total — Income', value: totalRevenue.value })
  rows.push({ kind: 'spacer' })

  rows.push({ kind: 'heading', label: 'Cost of Sales' })
  for (const acc of costOfSalesAccounts.value) {
    rows.push({ kind: 'line', label: `${acc.code} — ${acc.name}`, value: getBalance(acc.id), indent: true })
  }
  rows.push({ kind: 'subtotal', label: 'Total — Cost of Sales', value: totalCostOfSales.value })
  rows.push({ kind: 'spacer' })

  rows.push({ kind: 'subtotal', label: 'Gross Profit', value: grossProfit.value })
  rows.push({ kind: 'spacer' })

  rows.push({ kind: 'heading', label: 'Less: Expenses' })
  for (const acc of expenseAccounts.value) {
    rows.push({ kind: 'line', label: `${acc.code} — ${acc.name}`, value: getBalance(acc.id), indent: true })
  }
  rows.push({ kind: 'subtotal', label: 'Total — Expenses', value: totalExpenses.value })
  rows.push({ kind: 'spacer' })

  rows.push({
    kind: 'total',
    label: netIncome.value >= 0 ? 'Net Profit' : 'Net Loss',
    value: netIncome.value,
  })

  exportStatementPDF({
    org,
    currency: currency.value,
    title: 'Profit & Loss Statement',
    periodLabel: `For the period ${formatDate(startOfLocalDay(fromDate.value))} – ${formatDate(startOfLocalDay(toDate.value))}`,
    basisLabel: 'Accrual basis',
    rows,
    filename: `Profit and Loss — ${fromDate.value} to ${toDate.value}.pdf`,
  })
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
  .profit-loss-report {
    padding: 0;
  }
}
</style>
