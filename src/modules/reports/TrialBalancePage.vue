<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Trial Balance</h1>
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

    <v-card elevation="1">
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

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const asOfDate = ref(formatDateISO(new Date()))
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
