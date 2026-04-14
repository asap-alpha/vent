<template>
  <div>
    <div class="d-flex align-center mb-6 flex-wrap ga-2">
      <h1 class="text-h4 font-weight-bold">Profit &amp; Loss</h1>
      <v-spacer />
      <v-text-field
        v-model="fromDate"
        label="From"
        type="date"
        density="compact"
        hide-details
        style="max-width: 180px"
      />
      <v-text-field
        v-model="toDate"
        label="To"
        type="date"
        density="compact"
        hide-details
        style="max-width: 180px"
      />
    </div>

    <v-card elevation="1" class="pa-6">
      <h2 class="text-h6 mb-2">Revenue</h2>
      <v-table density="comfortable">
        <tbody>
          <tr v-for="acc in revenueAccounts" :key="acc.id">
            <td>{{ acc.code }} — {{ acc.name }}</td>
            <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
          </tr>
          <tr v-if="revenueAccounts.length === 0">
            <td colspan="2" class="text-center text-grey">No revenue accounts</td>
          </tr>
          <tr class="font-weight-bold">
            <td>Total Revenue</td>
            <td class="text-end">{{ formatCurrency(totalRevenue, currency) }}</td>
          </tr>
        </tbody>
      </v-table>

      <v-divider class="my-4" />

      <h2 class="text-h6 mb-2">Expenses</h2>
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
            <td>Total Expenses</td>
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
import { startOfYear } from 'date-fns'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const fromDate = ref(formatDateISO(startOfYear(new Date())))
const toDate = ref(formatDateISO(new Date()))

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const revenueAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'revenue').sort((a, b) => a.code.localeCompare(b.code))
)
const expenseAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'expense').sort((a, b) => a.code.localeCompare(b.code))
)

function getBalance(accountId: string): number {
  const from = fromDate.value ? new Date(fromDate.value) : undefined
  const to = toDate.value ? new Date(toDate.value) : undefined

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
const totalExpenses = computed(() =>
  expenseAccounts.value.reduce((s, a) => s + getBalance(a.id), 0)
)
const netIncome = computed(() => totalRevenue.value - totalExpenses.value)

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
