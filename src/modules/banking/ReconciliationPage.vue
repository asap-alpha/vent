<template>
  <div>
    <PageHeader title="Bank Reconciliation">
      <template #actions>
        <v-btn
          v-if="selectedAccount && !activeRec"
          color="primary"
          prepend-icon="mdi-play"
          size="small"
          @click="openStart"
        >
          Start Reconciliation
        </v-btn>
      </template>
    </PageHeader>

    <v-card class="mb-4">
      <div class="d-flex align-center flex-wrap ga-2 pa-4">
        <v-select
          v-model="selectedAccountId"
          label="Bank Account"
          :items="accountOptions"
          item-title="title"
          item-value="value"
          hide-details
          density="compact"
          style="max-width: 280px"
        />
      </div>
    </v-card>

    <!-- No active reconciliation -->
    <v-card v-if="selectedAccount && !activeRec">
      <div class="pa-4 pb-0">
        <div class="text-subtitle-1 font-weight-bold">Past Reconciliations</div>
      </div>
      <v-data-table
        :headers="recHeaders"
        :items="pastReconciliations"
        :items-per-page="10"
      >
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.statementBalance="{ item }">{{ formatCurrency(item.statementBalance, currency) }}</template>
        <template #item.reconciledBalance="{ item }">{{ formatCurrency(item.reconciledBalance, currency) }}</template>
        <template #item.difference="{ item }">
          <span :class="Math.abs(item.difference) < 0.005 ? 'text-success' : 'text-error'">
            {{ formatCurrency(item.difference, currency) }}
          </span>
        </template>
        <template #item.status="{ item }">
          <v-chip :color="item.status === 'completed' ? 'success' : 'warning'" size="x-small" variant="tonal">
            {{ item.status.replace('_', ' ') }}
          </v-chip>
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-scale-balance"
            title="No past reconciliations"
            description="Start a reconciliation to match your bank statement with recorded transactions."
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- Active reconciliation -->
    <v-card v-if="activeRec && selectedAccount">
      <div class="d-flex align-center pa-4 pb-0">
        <div class="text-subtitle-1 font-weight-bold">Reconciling — {{ formatDate(activeRec.date) }}</div>
        <v-spacer />
        <v-btn variant="text" color="error" size="small" @click="cancelReconciliation">Cancel</v-btn>
      </div>

      <v-row class="px-4 py-2">
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">Statement Balance</div>
          <div class="text-h6 font-weight-bold">{{ formatCurrency(activeRec.statementBalance, currency) }}</div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">Reconciled Balance</div>
          <div class="text-h6 font-weight-bold">{{ formatCurrency(reconciledTotal, currency) }}</div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">Difference</div>
          <div class="text-h6 font-weight-bold" :class="Math.abs(difference) < 0.005 ? 'text-success' : 'text-error'">
            {{ formatCurrency(difference, currency) }}
          </div>
        </v-col>
        <v-col cols="12" md="3" class="d-flex align-center">
          <v-btn
            color="success"
            prepend-icon="mdi-check"
            :disabled="Math.abs(difference) > 0.005"
            block
            @click="completeReconciliation"
          >
            Complete
          </v-btn>
        </v-col>
      </v-row>

      <v-divider />

      <v-data-table
        :headers="reconcileHeaders"
        :items="unreconciledTransactions"
        :items-per-page="-1"
        hide-default-footer
      >
        <template #item.checked="{ item }">
          <v-checkbox
            :model-value="item.reconciled"
            color="primary"
            hide-details
            density="compact"
            @update:model-value="(v) => toggleReconciled(item.id, !!v)"
          />
        </template>
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.type="{ item }">
          <v-chip :color="typeColor(item.type)" size="x-small" variant="tonal">{{ item.type }}</v-chip>
        </template>
        <template #item.amount="{ item }">
          <span :class="item.type === 'deposit' ? 'text-success' : 'text-error'">
            {{ item.type === 'deposit' ? '+' : '−' }}{{ formatCurrency(item.amount, currency) }}
          </span>
        </template>
      </v-data-table>
    </v-card>

    <!-- Start Reconciliation Dialog -->
    <v-dialog v-model="startDialog" max-width="500" persistent>
      <v-card v-if="selectedAccount">
        <v-card-title>Start Reconciliation</v-card-title>
        <v-card-subtitle>{{ selectedAccount.name }}</v-card-subtitle>
        <v-card-text>
          <v-form ref="startFormRef" @submit.prevent="doStart">
            <v-text-field v-model="startForm.dateStr" label="Statement Date" type="date" :rules="[required]" class="mb-2" />
            <v-text-field
              v-model.number="startForm.statementBalance"
              label="Statement Closing Balance"
              type="number"
              step="0.01"
              :rules="[required]"
              hint="The ending balance shown on your bank statement"
              persistent-hint
            />
            <v-alert v-if="startError" type="error" variant="tonal" class="mt-2">{{ startError }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="startDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="starting" @click="doStart">Start</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBankingStore } from '@/stores/banking'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO } from '@/utils/date'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { BankTransactionType } from '@/types/banking'

const bankingStore = useBankingStore()
const orgStore = useOrganizationStore()

const selectedAccountId = ref<string>('')
const currency = computed(() => selectedAccount.value?.currency || orgStore.currentOrg?.currency || 'GHS')

const selectedAccount = computed(() =>
  selectedAccountId.value ? bankingStore.getAccount(selectedAccountId.value) : null
)

const accountOptions = computed(() =>
  bankingStore.accounts.map((a) => ({ title: a.name, value: a.id }))
)

const pastReconciliations = computed(() =>
  bankingStore.reconciliations.filter((r) => r.bankAccountId === selectedAccountId.value)
)

const activeRec = computed(() =>
  pastReconciliations.value.find((r) => r.status === 'in_progress')
)

const accountTransactions = computed(() =>
  selectedAccount.value ? bankingStore.transactionsFor(selectedAccount.value.id) : []
)

const unreconciledTransactions = computed(() => {
  if (!activeRec.value) return []
  return accountTransactions.value.filter((t) => t.date <= activeRec.value!.date)
})

const reconciledTotal = computed(() => {
  if (!selectedAccount.value || !activeRec.value) return 0
  let total = selectedAccount.value.openingBalance
  for (const txn of unreconciledTransactions.value) {
    if (!txn.reconciled) continue
    total += txn.type === 'deposit' ? txn.amount : -txn.amount
  }
  return total
})

const difference = computed(() => {
  if (!activeRec.value) return 0
  return activeRec.value.statementBalance - reconciledTotal.value
})

function typeColor(t: BankTransactionType): string {
  return { deposit: 'success', withdrawal: 'error', transfer: 'info' }[t]
}

const recHeaders = [
  { title: 'Date', key: 'date', width: 140 },
  { title: 'Statement Balance', key: 'statementBalance', align: 'end' as const, width: 180 },
  { title: 'Reconciled Balance', key: 'reconciledBalance', align: 'end' as const, width: 180 },
  { title: 'Difference', key: 'difference', align: 'end' as const, width: 140 },
  { title: 'Status', key: 'status', width: 130 },
]

const reconcileHeaders = [
  { title: '', key: 'checked', width: 60, sortable: false },
  { title: 'Date', key: 'date', width: 120 },
  { title: 'Type', key: 'type', width: 110 },
  { title: 'Payee', key: 'payee' },
  { title: 'Reference', key: 'reference', width: 130 },
  { title: 'Amount', key: 'amount', align: 'end' as const, width: 140 },
]

// Start dialog
const startDialog = ref(false)
const startFormRef = ref()
const starting = ref(false)
const startError = ref('')
const startForm = ref({
  dateStr: formatDateISO(new Date()),
  statementBalance: 0,
})

function openStart() {
  if (!selectedAccount.value) return
  startForm.value = {
    dateStr: formatDateISO(new Date()),
    statementBalance: bankingStore.currentBalance(selectedAccount.value.id),
  }
  startError.value = ''
  startDialog.value = true
}

async function doStart() {
  if (!selectedAccount.value) return
  const { valid } = await startFormRef.value.validate()
  if (!valid) return
  starting.value = true
  startError.value = ''
  try {
    await bankingStore.startReconciliation({
      bankAccountId: selectedAccount.value.id,
      date: new Date(startForm.value.dateStr),
      statementBalance: startForm.value.statementBalance,
    })
    startDialog.value = false
  } catch (e: any) {
    startError.value = e.message
  } finally {
    starting.value = false
  }
}

async function toggleReconciled(transactionId: string, reconciled: boolean) {
  await bankingStore.toggleTransactionReconciled(transactionId, reconciled)
}

async function completeReconciliation() {
  if (!activeRec.value) return
  const txnIds = unreconciledTransactions.value.filter((t) => t.reconciled).map((t) => t.id)
  await bankingStore.completeReconciliation(activeRec.value.id, reconciledTotal.value, txnIds)
}

async function cancelReconciliation() {
  if (!activeRec.value) return
  const txnIds = unreconciledTransactions.value.filter((t) => t.reconciled).map((t) => t.id)
  await bankingStore.completeReconciliation(activeRec.value.id, reconciledTotal.value, txnIds)
}

onMounted(() => {
  if (orgStore.orgId) bankingStore.subscribe()
})

watch(() => orgStore.orgId, (id) => {
  if (id) bankingStore.subscribe()
})

watch(
  () => bankingStore.accounts,
  (accs) => {
    if (!selectedAccountId.value && accs.length > 0) selectedAccountId.value = accs[0].id
  }
)
</script>
