<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Chart of Accounts</h1>
      <v-spacer />
      <v-btn
        v-if="accounts.length === 0"
        variant="outlined"
        prepend-icon="mdi-database-import"
        class="mr-2"
        :loading="seeding"
        @click="seedDefaults"
      >
        Seed Defaults
      </v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
        New Account
      </v-btn>
    </div>

    <v-card elevation="1">
      <v-tabs v-model="activeType" color="primary" grow>
        <v-tab value="all">All</v-tab>
        <v-tab value="asset">Assets</v-tab>
        <v-tab value="liability">Liabilities</v-tab>
        <v-tab value="equity">Equity</v-tab>
        <v-tab value="revenue">Revenue</v-tab>
        <v-tab value="expense">Expenses</v-tab>
      </v-tabs>

      <v-data-table
        :headers="headers"
        :items="filteredAccounts"
        :loading="accountsStore.loading"
        :items-per-page="25"
      >
        <template #item.type="{ item }">
          <v-chip :color="typeColor(item.type)" size="small" variant="tonal">
            {{ item.type }}
          </v-chip>
        </template>
        <template #item.balance="{ item }">
          {{ formatCurrency(getBalance(item.id), item.currency) }}
        </template>
        <template #item.isActive="{ item }">
          <v-icon :color="item.isActive ? 'success' : 'grey'">
            {{ item.isActive ? 'mdi-check-circle' : 'mdi-circle-outline' }}
          </v-icon>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">
            No accounts yet. Click "Seed Defaults" or "New Account" to get started.
          </div>
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="600" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Edit Account' : 'New Account' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="save">
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.code" label="Code" :rules="[required]" />
              </v-col>
              <v-col cols="12" md="8">
                <v-text-field v-model="form.name" label="Account Name" :rules="[required]" />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.type"
                  label="Type"
                  :items="accountTypes"
                  :rules="[required]"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.currency" label="Currency" :rules="[required]" />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.description"
                  label="Description"
                  rows="2"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="12">
                <v-switch
                  v-model="form.isActive"
                  label="Active"
                  color="primary"
                  hide-details
                />
              </v-col>
            </v-row>
            <v-alert v-if="error" type="error" variant="tonal" class="mt-2">{{ error }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      ref="confirmRef"
      title="Delete Account"
      message="Are you sure you want to delete this account? This cannot be undone."
      confirm-text="Delete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { Account, AccountType } from '@/types/accounting'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const accounts = computed(() => accountsStore.accounts)
const activeType = ref<'all' | AccountType>('all')

const headers = [
  { title: 'Code', key: 'code', width: 100 },
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type', width: 130 },
  { title: 'Currency', key: 'currency', width: 100 },
  { title: 'Balance', key: 'balance', align: 'end' as const, width: 160 },
  { title: 'Active', key: 'isActive', width: 80, align: 'center' as const },
  { title: '', key: 'actions', sortable: false, width: 100, align: 'end' as const },
]

const accountTypes = [
  { title: 'Asset', value: 'asset' },
  { title: 'Liability', value: 'liability' },
  { title: 'Equity', value: 'equity' },
  { title: 'Revenue', value: 'revenue' },
  { title: 'Expense', value: 'expense' },
]

const filteredAccounts = computed(() =>
  activeType.value === 'all'
    ? accounts.value
    : accounts.value.filter((a) => a.type === activeType.value)
)

function typeColor(type: AccountType): string {
  return {
    asset: 'blue',
    liability: 'orange',
    equity: 'purple',
    revenue: 'green',
    expense: 'red',
  }[type]
}

function getBalance(accountId: string): number {
  return transactionsStore.getAccountBalance(accountId)
}

const dialog = ref(false)
const editing = ref<Account | null>(null)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref({
  code: '',
  name: '',
  type: 'asset' as AccountType,
  parentId: null as string | null,
  currency: 'GHS',
  isActive: true,
  description: '',
})

function resetForm() {
  form.value = {
    code: '',
    name: '',
    type: 'asset',
    parentId: null,
    currency: orgStore.currentOrg?.currency || 'GHS',
    isActive: true,
    description: '',
  }
  error.value = ''
  editing.value = null
}

function openCreate() {
  resetForm()
  dialog.value = true
}

function openEdit(account: Account) {
  editing.value = account
  form.value = {
    code: account.code,
    name: account.name,
    type: account.type,
    parentId: account.parentId,
    currency: account.currency,
    isActive: account.isActive,
    description: account.description || '',
  }
  error.value = ''
  dialog.value = true
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  saving.value = true
  error.value = ''
  try {
    if (editing.value) {
      await accountsStore.updateAccount(editing.value.id, form.value)
    } else {
      await accountsStore.createAccount(form.value)
    }
    dialog.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(account: Account) {
  const ok = await confirmRef.value?.open()
  if (ok) {
    await accountsStore.deleteAccount(account.id)
  }
}

const seeding = ref(false)
async function seedDefaults() {
  seeding.value = true
  try {
    await accountsStore.seedDefaultAccounts()
  } finally {
    seeding.value = false
  }
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
