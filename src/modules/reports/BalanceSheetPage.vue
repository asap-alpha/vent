<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Balance Sheet</h1>
      <v-spacer />
      <v-text-field
        v-model="asOfDate"
        label="As of"
        type="date"
        density="compact"
        hide-details
        style="max-width: 200px"
      />
    </div>

    <v-row>
      <!-- Assets -->
      <v-col cols="12" md="6">
        <v-card elevation="1" class="pa-6">
          <h2 class="text-h6 mb-2">Assets</h2>
          <v-table density="comfortable">
            <tbody>
              <tr v-for="acc in assetAccounts" :key="acc.id">
                <td>{{ acc.code }} — {{ acc.name }}</td>
                <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
              </tr>
              <tr v-if="assetAccounts.length === 0">
                <td colspan="2" class="text-center text-grey">No asset accounts</td>
              </tr>
              <tr class="font-weight-bold bg-blue-lighten-5">
                <td>Total Assets</td>
                <td class="text-end">{{ formatCurrency(totalAssets, currency) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>

      <!-- Liabilities + Equity -->
      <v-col cols="12" md="6">
        <v-card elevation="1" class="pa-6">
          <h2 class="text-h6 mb-2">Liabilities</h2>
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

          <h2 class="text-h6 mt-6 mb-2">Equity</h2>
          <v-table density="comfortable">
            <tbody>
              <tr v-for="acc in equityAccounts" :key="acc.id">
                <td>{{ acc.code }} — {{ acc.name }}</td>
                <td class="text-end">{{ formatCurrency(getBalance(acc.id), currency) }}</td>
              </tr>
              <tr>
                <td>Retained Earnings (current period)</td>
                <td class="text-end">{{ formatCurrency(retainedEarnings, currency) }}</td>
              </tr>
              <tr class="font-weight-bold">
                <td>Total Equity</td>
                <td class="text-end">{{ formatCurrency(totalEquity, currency) }}</td>
              </tr>
              <tr class="font-weight-bold bg-purple-lighten-5">
                <td>Total Liabilities + Equity</td>
                <td class="text-end">{{ formatCurrency(totalLiabilities + totalEquity, currency) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <v-alert
      v-if="!balanced"
      type="warning"
      variant="tonal"
      class="mt-4"
    >
      Balance sheet does not balance.
      Difference: {{ formatCurrency(Math.abs(totalAssets - (totalLiabilities + totalEquity)), currency) }}
    </v-alert>
    <v-alert
      v-else
      type="success"
      variant="tonal"
      class="mt-4"
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
import { formatDateISO } from '@/utils/date'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const asOfDate = ref(formatDateISO(new Date()))
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const assetAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'asset').sort((a, b) => a.code.localeCompare(b.code))
)
const liabilityAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'liability').sort((a, b) => a.code.localeCompare(b.code))
)
const equityAccounts = computed(() =>
  accountsStore.accounts.filter((a) => a.type === 'equity').sort((a, b) => a.code.localeCompare(b.code))
)

function getBalance(accountId: string): number {
  return transactionsStore.getAccountBalance(
    accountId,
    asOfDate.value ? new Date(asOfDate.value) : undefined
  )
}

const totalAssets = computed(() => assetAccounts.value.reduce((s, a) => s + getBalance(a.id), 0))
const totalLiabilities = computed(() => liabilityAccounts.value.reduce((s, a) => s + getBalance(a.id), 0))

// Retained earnings = Revenue - Expenses (up to as-of date)
const retainedEarnings = computed(() => {
  const asOf = asOfDate.value ? new Date(asOfDate.value) : undefined
  return transactionsStore.sumByType('revenue', undefined, asOf) -
         transactionsStore.sumByType('expense', undefined, asOf)
})

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
