<template>
  <div>
    <PageHeader title="Chart of Accounts">
      <template #actions>
        <v-btn
          v-if="accounts.length === 0"
          variant="outlined"
          prepend-icon="mdi-database-import"
          size="small"
          class="mr-2"
          :loading="seeding"
          @click="seedDefaults"
        >
          Seed Defaults
        </v-btn>
        <v-btn
          v-if="unclassifiedCount > 0"
          variant="outlined"
          prepend-icon="mdi-shape-outline"
          size="small"
          class="mr-2"
          :loading="classifying"
          @click="classifyAccounts"
        >
          Classify {{ unclassifiedCount }} Account{{ unclassifiedCount === 1 ? '' : 's' }}
        </v-btn>
        <v-btn
          v-if="accounts.length > 0 && canBackfill"
          variant="outlined"
          prepend-icon="mdi-book-sync-outline"
          size="small"
          class="mr-2"
          :loading="backfilling"
          @click="runBackfill"
        >
          Post Historical Data
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
          New Account
        </v-btn>
      </template>
    </PageHeader>

    <v-card>
      <v-tabs v-model="activeType" color="primary" grow>
        <v-tab value="all">All</v-tab>
        <v-tab value="asset">Assets</v-tab>
        <v-tab value="liability">Liabilities</v-tab>
        <v-tab value="equity">Equity</v-tab>
        <v-tab value="revenue">Revenue</v-tab>
        <v-tab value="expense">Expenses</v-tab>
      </v-tabs>

      <div class="d-flex align-center flex-wrap ga-2 pa-4 pb-0">
        <v-select
          v-if="subtypeFilterOptions.length > 0"
          v-model="subtypeFilter"
          :items="subtypeFilterOptions"
          label="Group"
          hide-details
          clearable
          density="compact"
          style="max-width: 220px"
        />
        <v-spacer />
        <v-text-field
          v-model="search"
          placeholder="Search..."
          prepend-inner-icon="mdi-magnify"
          hide-details
          density="compact"
          style="max-width: 240px"
        />
      </div>

      <v-data-table
        :headers="headers"
        :items="filteredAccounts"
        :loading="accountsStore.loading"
        :items-per-page="25"
        :search="search"
      >
        <template #item.type="{ item }">
          <v-chip :color="typeColor(item.type)" size="x-small" variant="tonal">
            {{ item.type }}
          </v-chip>
        </template>
        <template #item.subtype="{ item }">
          <span v-if="resolveSubtype(item)" class="text-body-2">
            {{ SUBTYPE_LABELS[resolveSubtype(item)!] }}
            <v-tooltip v-if="!item.subtype" activator="parent" location="top">
              Inferred from the account code and name. Click "Classify" to save it.
            </v-tooltip>
            <v-icon v-if="!item.subtype" icon="mdi-help-circle-outline" size="x-small" class="ms-1 text-grey" />
          </span>
          <span v-else class="text-grey">—</span>
        </template>
        <template #item.balance="{ item }">
          {{ formatCurrency(getBalance(item.id), item.currency) }}
        </template>
        <template #item.isActive="{ item }">
          <v-chip
            :color="item.isActive ? 'success' : 'grey'"
            size="x-small"
            variant="tonal"
          >
            {{ item.isActive ? 'Active' : 'Inactive' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="confirmDelete(item)" />
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-book-open-page-variant-outline"
            title="No accounts yet"
            description="Click 'Seed Defaults' for a standard chart of accounts or create a custom one."
            action-label="New Account"
            action-icon="mdi-plus"
            @action="openCreate"
          />
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
              <v-col v-if="formSubtypeOptions.length > 0" cols="12" md="6">
                <v-select
                  v-model="form.subtype"
                  label="Group"
                  :items="formSubtypeOptions"
                  :rules="[required]"
                  :hint="subtypeHint"
                  persistent-hint
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
import { useAuthStore } from '@/stores/auth'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/plugins/firebase'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { logger } from '@/utils/logger'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  defaultSubtype,
  resolveSubtype,
  subtypeOptions,
  SUBTYPE_LABELS,
  SUBTYPES_BY_TYPE,
} from '@/utils/accountClassification'
import type { Account, AccountSubtype, AccountType } from '@/types/accounting'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()
const authStore = useAuthStore()
const log = logger('accounts-page')

const accounts = computed(() => accountsStore.accounts)
const activeType = ref<'all' | AccountType>('all')
const subtypeFilter = ref<AccountSubtype | null>(null)
const search = ref('')

// Only offered for the tabs whose type actually has subtypes (assets, liabilities,
// expenses); reset whenever the tab changes so a stale filter can't blank the table.
const subtypeFilterOptions = computed(() =>
  activeType.value === 'all' ? [] : subtypeOptions(activeType.value)
)
watch(activeType, () => {
  subtypeFilter.value = null
})

const headers = [
  { title: 'Code', key: 'code', width: 100 },
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type', width: 130 },
  { title: 'Group', key: 'subtype', width: 170 },
  { title: 'Currency', key: 'currency', width: 100 },
  { title: 'Balance', key: 'balance', align: 'end' as const, width: 160 },
  { title: 'Status', key: 'isActive', width: 100, align: 'center' as const },
  { title: '', key: 'actions', sortable: false, width: 100, align: 'end' as const },
]

const accountTypes = [
  { title: 'Asset', value: 'asset' },
  { title: 'Liability', value: 'liability' },
  { title: 'Equity', value: 'equity' },
  { title: 'Revenue', value: 'revenue' },
  { title: 'Expense', value: 'expense' },
]

const filteredAccounts = computed(() => {
  let list = accounts.value
  if (activeType.value !== 'all') list = list.filter((a) => a.type === activeType.value)
  if (subtypeFilter.value) list = list.filter((a) => resolveSubtype(a) === subtypeFilter.value)
  return list
})

const formSubtypeOptions = computed(() => subtypeOptions(form.value.type))

const subtypeHint = computed(() =>
  form.value.type === 'liability'
    ? 'Current if repayable within twelve months, long-term otherwise.'
    : form.value.type === 'expense'
      ? 'Cost of sales appears above the Gross Profit line; expenses below it.'
      : 'Current assets are cash and what converts to cash within a year; fixed assets are held long-term.'
)

// A type change invalidates the previously chosen group — snap to that type's default
// (or null for equity/revenue, which have none) so a liability can never be saved
// carrying, say, 'fixed_asset'.
watch(
  () => form.value.type,
  (type) => {
    const valid = SUBTYPES_BY_TYPE[type]
    if (!form.value.subtype || !valid.includes(form.value.subtype)) {
      form.value.subtype = defaultSubtype(type)
    }
  }
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
  subtype: defaultSubtype('asset') as AccountSubtype | null,
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
    subtype: defaultSubtype('asset'),
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
    // Show the inferred group for a legacy account so saving the form also classifies it.
    subtype: resolveSubtype(account),
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

const unclassifiedCount = computed(() => accountsStore.unclassifiedAccounts.length)
const classifying = ref(false)
async function classifyAccounts() {
  classifying.value = true
  try {
    const updated = await accountsStore.backfillSubtypes()
    log.info('classified accounts', { updated })
  } catch (e: any) {
    log.error('classify failed', { message: e.message })
    alert(`Could not classify accounts: ${e.message}`)
  } finally {
    classifying.value = false
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

// One-time (re-runnable) backfill: posts pre-existing invoices/bills/receipts/
// payments/bank transactions into the general ledger. Owner/admin/super-admin only.
const canBackfill = computed(
  () => authStore.isSuperAdmin || orgStore.myRole === 'owner' || orgStore.myRole === 'admin'
)
const backfilling = ref(false)
async function runBackfill() {
  if (!orgStore.orgId) return
  const ok = window.confirm(
    'Post all existing invoices, bills, receipts, payments and bank transactions to the general ledger?\n\nThis is safe to run more than once.'
  )
  if (!ok) return
  backfilling.value = true
  try {
    const call = httpsCallable(functions, 'backfillLedger')
    const res: any = await call({ orgId: orgStore.orgId })
    const d = res.data || {}
    log.info('backfill complete', d)
    alert(`Ledger backfill complete.\n\nDocuments swept: ${d.grandTotal ?? 0}\nEntries posted: ${d.grandCreated ?? 0}`)
  } catch (e: any) {
    log.error('backfill failed', { message: e.message })
    alert(`Backfill failed: ${e.message}`)
  } finally {
    backfilling.value = false
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
