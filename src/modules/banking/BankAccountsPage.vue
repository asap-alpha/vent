<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Bank Accounts</h1>
      <v-spacer />
      <v-btn
        v-if="selectedAccount"
        color="primary"
        prepend-icon="mdi-plus"
        class="mr-2"
        @click="openTransaction('deposit')"
      >Deposit</v-btn>
      <v-btn
        v-if="selectedAccount"
        color="warning"
        prepend-icon="mdi-minus"
        class="mr-2"
        @click="openTransaction('withdrawal')"
      >Withdrawal</v-btn>
      <v-btn
        v-if="bankingStore.activeAccounts.length >= 2"
        variant="outlined"
        prepend-icon="mdi-bank-transfer"
        class="mr-2"
        @click="openTransfer"
      >Transfer</v-btn>
      <v-btn
        v-if="selectedAccount"
        variant="outlined"
        prepend-icon="mdi-file-upload"
        class="mr-2"
        @click="openImport"
      >Import CSV</v-btn>
      <v-btn color="primary" prepend-icon="mdi-bank-plus" @click="openCreate">New Account</v-btn>
    </div>

    <v-row>
      <!-- Account list -->
      <v-col cols="12" md="4">
        <v-card elevation="1">
          <v-list>
            <v-list-subheader>ACCOUNTS</v-list-subheader>
            <v-list-item
              v-for="acc in bankingStore.accounts"
              :key="acc.id"
              :active="selectedId === acc.id"
              @click="selectedId = acc.id"
            >
              <template #prepend>
                <v-icon>{{ accountIcon(acc.type) }}</v-icon>
              </template>
              <v-list-item-title>{{ acc.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ acc.bankName }} {{ acc.accountNumber ? `· ${acc.accountNumber}` : '' }}
              </v-list-item-subtitle>
              <template #append>
                <div class="text-end">
                  <div class="font-weight-bold">{{ formatCurrency(bankingStore.currentBalance(acc.id), acc.currency) }}</div>
                  <v-btn icon="mdi-pencil" size="x-small" variant="text" @click.stop="openEdit(acc)" />
                </div>
              </template>
            </v-list-item>
            <v-list-item v-if="bankingStore.accounts.length === 0" class="text-center text-grey">
              No bank accounts yet
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Transactions for selected account -->
      <v-col cols="12" md="8">
        <v-card v-if="selectedAccount" elevation="1">
          <v-card-title>
            {{ selectedAccount.name }}
            <v-chip class="ml-2" size="small" variant="tonal">{{ selectedAccount.type }}</v-chip>
          </v-card-title>
          <v-card-subtitle>
            Current balance: <strong>{{ formatCurrency(bankingStore.currentBalance(selectedAccount.id), selectedAccount.currency) }}</strong>
            · Opening: {{ formatCurrency(selectedAccount.openingBalance, selectedAccount.currency) }}
          </v-card-subtitle>
          <v-data-table
            :headers="txnHeaders"
            :items="accountTransactions"
            :items-per-page="25"
          >
            <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
            <template #item.type="{ item }">
              <v-chip :color="typeColor(item.type)" size="small" variant="tonal">{{ item.type }}</v-chip>
            </template>
            <template #item.amount="{ item }">
              <span :class="item.type === 'deposit' ? 'text-success' : 'text-error'">
                {{ item.type === 'deposit' ? '+' : '−' }}{{ formatCurrency(item.amount, selectedAccount!.currency) }}
              </span>
            </template>
            <template #item.reconciled="{ item }">
              <v-icon :color="item.reconciled ? 'success' : 'grey'">
                {{ item.reconciled ? 'mdi-check-circle' : 'mdi-circle-outline' }}
              </v-icon>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDeleteTxn(item.id)" />
            </template>
            <template #no-data>
              <div class="text-center pa-8 text-grey">No transactions yet.</div>
            </template>
          </v-data-table>
        </v-card>
        <v-card v-else elevation="1" class="pa-8 text-center text-grey">
          Select an account to view transactions.
        </v-card>
      </v-col>
    </v-row>

    <!-- Account Create/Edit Dialog -->
    <v-dialog v-model="accountDialog" max-width="600" persistent>
      <v-card>
        <v-card-title>{{ !!editing ? 'Edit Bank Account' : 'New Bank Account' }}</v-card-title>
        <v-card-text>
          <v-form ref="accountFormRef" @submit.prevent="saveAccount">
            <v-text-field v-model="accountForm.name" label="Account Name" :rules="[required]" class="mb-2" />
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="accountForm.bankName" label="Bank Name" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="accountForm.accountNumber" label="Account Number" />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" md="6">
                <v-select v-model="accountForm.type" label="Type" :items="accountTypes" :rules="[required]" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="accountForm.currency" label="Currency" :rules="[required]" />
              </v-col>
            </v-row>
            <v-text-field
              v-model.number="accountForm.openingBalance"
              label="Opening Balance"
              type="number"
              step="0.01"
              :disabled="!!editing"
              :hint="editing ? 'Cannot change after creation' : 'Initial balance when account is added'"
              persistent-hint
              class="mb-2"
            />
            <v-switch v-model="accountForm.isActive" label="Active" color="primary" hide-details />
            <v-alert v-if="accountError" type="error" variant="tonal" class="mt-2">{{ accountError }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="accountDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingAccount" @click="saveAccount">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Transaction Dialog -->
    <v-dialog v-model="txnDialog" max-width="500" persistent>
      <v-card v-if="selectedAccount">
        <v-card-title>
          {{ txnForm.type === 'deposit' ? 'Record Deposit' : 'Record Withdrawal' }}
        </v-card-title>
        <v-card-subtitle>{{ selectedAccount.name }}</v-card-subtitle>
        <v-card-text>
          <v-form ref="txnFormRef" @submit.prevent="saveTransaction">
            <v-row>
              <v-col cols="6">
                <v-text-field v-model="txnForm.dateStr" label="Date" type="date" :rules="[required]" />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="txnForm.amount"
                  label="Amount"
                  type="number"
                  step="0.01"
                  :rules="[required, positiveNumber]"
                />
              </v-col>
            </v-row>
            <v-text-field v-model="txnForm.payee" label="Payee / From" class="mb-2" />
            <v-text-field v-model="txnForm.reference" label="Reference" class="mb-2" />
            <v-text-field v-model="txnForm.category" label="Category" class="mb-2" />
            <v-textarea
              v-model="txnForm.description"
              label="Description"
              rows="2"
              variant="outlined"
              density="comfortable"
            />
            <v-alert v-if="txnError" type="error" variant="tonal" class="mt-2">{{ txnError }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="txnDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingTxn" @click="saveTransaction">Record</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Transfer Dialog -->
    <v-dialog v-model="transferDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>Transfer Funds</v-card-title>
        <v-card-text>
          <v-form ref="transferFormRef" @submit.prevent="saveTransfer">
            <v-select
              v-model="transferForm.fromAccountId"
              label="From Account"
              :items="accountSelectOptions"
              item-title="title"
              item-value="value"
              :rules="[required]"
              class="mb-2"
            />
            <v-select
              v-model="transferForm.toAccountId"
              label="To Account"
              :items="accountSelectOptions.filter(o => o.value !== transferForm.fromAccountId)"
              item-title="title"
              item-value="value"
              :rules="[required]"
              class="mb-2"
            />
            <v-row>
              <v-col cols="6">
                <v-text-field v-model="transferForm.dateStr" label="Date" type="date" :rules="[required]" />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="transferForm.amount"
                  label="Amount"
                  type="number"
                  step="0.01"
                  :rules="[required, positiveNumber]"
                />
              </v-col>
            </v-row>
            <v-text-field v-model="transferForm.reference" label="Reference" class="mb-2" />
            <v-textarea
              v-model="transferForm.description"
              label="Description"
              rows="2"
              variant="outlined"
              density="comfortable"
            />
            <v-alert v-if="transferError" type="error" variant="tonal" class="mt-2">{{ transferError }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="transferDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingTransfer" @click="saveTransfer">Transfer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CSV Import Dialog -->
    <v-dialog v-model="importDialog" max-width="800" persistent>
      <v-card v-if="selectedAccount">
        <v-card-title>Import Bank Statement (CSV)</v-card-title>
        <v-card-subtitle>{{ selectedAccount.name }}</v-card-subtitle>
        <v-card-text>
          <p class="text-body-2 mb-3">
            Upload a CSV with columns: <code>date, description, amount</code>.
            Negative amounts are withdrawals, positive are deposits.
            Date format: YYYY-MM-DD or DD/MM/YYYY.
          </p>
          <v-file-input
            v-model="csvFile"
            label="Select CSV File"
            accept=".csv"
            prepend-icon="mdi-file-delimited"
            @update:model-value="onFileSelected"
          />
          <div v-if="parsedRows.length > 0" class="mt-4">
            <p class="text-body-2 mb-2">
              <strong>{{ parsedRows.length }}</strong> rows parsed.
              Preview:
            </p>
            <v-table density="compact" class="mb-2">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th class="text-end">Amount</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in parsedRows.slice(0, 5)" :key="idx">
                  <td>{{ formatDate(row.date) }}</td>
                  <td>{{ row.payee }}</td>
                  <td class="text-end">{{ formatCurrency(row.amount, selectedAccount.currency) }}</td>
                  <td>{{ row.type }}</td>
                </tr>
              </tbody>
            </v-table>
            <p v-if="parsedRows.length > 5" class="text-caption text-grey">
              ... and {{ parsedRows.length - 5 }} more
            </p>
          </div>
          <v-alert v-if="importError" type="error" variant="tonal" class="mt-2">{{ importError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="importDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="importing"
            :disabled="parsedRows.length === 0"
            @click="doImport"
          >Import {{ parsedRows.length }} transactions</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog ref="confirmRef" title="Delete" message="Delete this item?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBankingStore } from '@/stores/banking'
import { useOrganizationStore } from '@/stores/organization'
import { required, positiveNumber } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO } from '@/utils/date'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { parseStatementCSV, type ParsedTransaction } from '@/utils/csv'
import type { BankAccount, BankAccountType, BankTransactionType } from '@/types/banking'

const bankingStore = useBankingStore()
const orgStore = useOrganizationStore()

const selectedId = ref<string>('')

const selectedAccount = computed(() =>
  selectedId.value ? bankingStore.getAccount(selectedId.value) : null
)

const accountTransactions = computed(() =>
  selectedAccount.value ? bankingStore.transactionsFor(selectedAccount.value.id) : []
)

const accountTypes = [
  { title: 'Bank', value: 'bank' },
  { title: 'Cash', value: 'cash' },
  { title: 'Credit Card', value: 'credit_card' },
]

function accountIcon(type: BankAccountType): string {
  return { bank: 'mdi-bank', cash: 'mdi-cash', credit_card: 'mdi-credit-card' }[type]
}

function typeColor(t: BankTransactionType): string {
  return { deposit: 'success', withdrawal: 'error', transfer: 'info' }[t]
}

const txnHeaders = [
  { title: 'Date', key: 'date', width: 120 },
  { title: 'Type', key: 'type', width: 110 },
  { title: 'Payee', key: 'payee' },
  { title: 'Reference', key: 'reference', width: 130 },
  { title: 'Amount', key: 'amount', align: 'end' as const, width: 140 },
  { title: 'Reconciled', key: 'reconciled', width: 100, align: 'center' as const },
  { title: '', key: 'actions', sortable: false, width: 60, align: 'end' as const },
]

const accountSelectOptions = computed(() =>
  bankingStore.activeAccounts.map((a) => ({ title: a.name, value: a.id }))
)

// ----- Account dialog -----
const accountDialog = ref(false)
const editing = ref<BankAccount | null>(null)
const accountFormRef = ref()
const savingAccount = ref(false)
const accountError = ref('')
const accountForm = ref({
  name: '',
  bankName: '',
  accountNumber: '',
  type: 'bank' as BankAccountType,
  currency: 'GHS',
  openingBalance: 0,
  isActive: true,
})

function resetAccountForm() {
  accountForm.value = {
    name: '',
    bankName: '',
    accountNumber: '',
    type: 'bank',
    currency: orgStore.currentOrg?.currency || 'GHS',
    openingBalance: 0,
    isActive: true,
  }
  accountError.value = ''
  editing.value = null
}

function openCreate() {
  resetAccountForm()
  accountDialog.value = true
}

function openEdit(acc: BankAccount) {
  editing.value = acc
  accountForm.value = {
    name: acc.name,
    bankName: acc.bankName,
    accountNumber: acc.accountNumber,
    type: acc.type,
    currency: acc.currency,
    openingBalance: acc.openingBalance,
    isActive: acc.isActive,
  }
  accountError.value = ''
  accountDialog.value = true
}

async function saveAccount() {
  const { valid } = await accountFormRef.value.validate()
  if (!valid) return
  savingAccount.value = true
  accountError.value = ''
  try {
    if (editing.value) {
      const { openingBalance, ...rest } = accountForm.value
      void openingBalance
      await bankingStore.updateAccount(editing.value.id, rest)
    } else {
      await bankingStore.createAccount(accountForm.value)
    }
    accountDialog.value = false
  } catch (e: any) {
    accountError.value = e.message
  } finally {
    savingAccount.value = false
  }
}

// ----- Transaction dialog -----
const txnDialog = ref(false)
const txnFormRef = ref()
const savingTxn = ref(false)
const txnError = ref('')
const txnForm = ref({
  type: 'deposit' as 'deposit' | 'withdrawal',
  dateStr: formatDateISO(new Date()),
  amount: 0,
  payee: '',
  reference: '',
  category: '',
  description: '',
})

function openTransaction(type: 'deposit' | 'withdrawal') {
  txnForm.value = {
    type,
    dateStr: formatDateISO(new Date()),
    amount: 0,
    payee: '',
    reference: '',
    category: '',
    description: '',
  }
  txnError.value = ''
  txnDialog.value = true
}

async function saveTransaction() {
  if (!selectedAccount.value) return
  const { valid } = await txnFormRef.value.validate()
  if (!valid) return
  savingTxn.value = true
  txnError.value = ''
  try {
    await bankingStore.recordTransaction({
      bankAccountId: selectedAccount.value.id,
      date: new Date(txnForm.value.dateStr),
      type: txnForm.value.type,
      amount: txnForm.value.amount,
      payee: txnForm.value.payee,
      reference: txnForm.value.reference,
      description: txnForm.value.description,
      category: txnForm.value.category,
    })
    txnDialog.value = false
  } catch (e: any) {
    txnError.value = e.message
  } finally {
    savingTxn.value = false
  }
}

// ----- Transfer dialog -----
const transferDialog = ref(false)
const transferFormRef = ref()
const savingTransfer = ref(false)
const transferError = ref('')
const transferForm = ref({
  fromAccountId: '',
  toAccountId: '',
  dateStr: formatDateISO(new Date()),
  amount: 0,
  reference: '',
  description: '',
})

function openTransfer() {
  transferForm.value = {
    fromAccountId: selectedAccount.value?.id || '',
    toAccountId: '',
    dateStr: formatDateISO(new Date()),
    amount: 0,
    reference: '',
    description: '',
  }
  transferError.value = ''
  transferDialog.value = true
}

async function saveTransfer() {
  const { valid } = await transferFormRef.value.validate()
  if (!valid) return
  savingTransfer.value = true
  transferError.value = ''
  try {
    await bankingStore.recordTransfer({
      fromAccountId: transferForm.value.fromAccountId,
      toAccountId: transferForm.value.toAccountId,
      date: new Date(transferForm.value.dateStr),
      amount: transferForm.value.amount,
      reference: transferForm.value.reference,
      description: transferForm.value.description,
    })
    transferDialog.value = false
  } catch (e: any) {
    transferError.value = e.message
  } finally {
    savingTransfer.value = false
  }
}

// ----- CSV Import dialog -----
const importDialog = ref(false)
const csvFile = ref<File | null>(null)
const parsedRows = ref<ParsedTransaction[]>([])
const importing = ref(false)
const importError = ref('')

function openImport() {
  csvFile.value = null
  parsedRows.value = []
  importError.value = ''
  importDialog.value = true
}

async function onFileSelected(file: File | File[] | null) {
  importError.value = ''
  parsedRows.value = []
  const f = Array.isArray(file) ? file[0] : file
  if (!f) return
  try {
    const text = await f.text()
    parsedRows.value = parseStatementCSV(text)
  } catch (e: any) {
    importError.value = e.message
  }
}

async function doImport() {
  if (!selectedAccount.value || parsedRows.value.length === 0) return
  importing.value = true
  importError.value = ''
  try {
    await bankingStore.importTransactions(selectedAccount.value.id, parsedRows.value)
    importDialog.value = false
  } catch (e: any) {
    importError.value = e.message
  } finally {
    importing.value = false
  }
}

// ----- Delete -----
const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDeleteTxn(id: string) {
  const ok = await confirmRef.value?.open()
  if (ok) await bankingStore.deleteTransaction(id)
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
    if (!selectedId.value && accs.length > 0) selectedId.value = accs[0].id
  }
)
</script>
