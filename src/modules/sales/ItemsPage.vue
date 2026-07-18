<template>
  <div>
    <PageHeader title="Products & Services">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
          New Item
        </v-btn>
      </template>
    </PageHeader>

    <v-card>
      <div class="d-flex align-center flex-wrap ga-2 pa-4 pb-0">
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
        :items="itemsStore.items"
        :loading="itemsStore.loading"
        :items-per-page="25"
        :search="search"
      >
        <template #item.kind="{ item }">
          <v-chip :color="item.kind === 'inventory' ? 'primary' : 'grey'" size="x-small" variant="tonal">
            {{ item.kind === 'inventory' ? 'Inventory' : 'Service' }}
          </v-chip>
        </template>
        <template #item.salesPrice="{ item }">{{ formatCurrency(item.salesPrice, currency) }}</template>
        <template #item.qtyOnHand="{ item }">
          {{ item.kind === 'inventory' ? formatNumber(item.qtyOnHand, 0) : '—' }}
        </template>
        <template #item.stockValue="{ item }">
          {{ item.kind === 'inventory' ? formatCurrency(item.stockValue, currency) : '—' }}
        </template>
        <template #item.isActive="{ item }">
          <v-chip :color="item.isActive ? 'success' : 'grey'" size="x-small" variant="tonal">
            {{ item.isActive ? 'Active' : 'Inactive' }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="confirmDelete(item)" />
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-package-variant-closed"
            title="No items yet"
            description="Add products or services to speed up invoicing and track stock."
            action-label="New Item"
            action-icon="mdi-plus"
            @action="openCreate"
          />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="680" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Edit Item' : 'New Item' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="save">
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field v-model="form.name" label="Name" :rules="[required]" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.sku" label="SKU / Code" />
              </v-col>
            </v-row>

            <v-btn-toggle v-model="form.kind" mandatory density="compact" rounded="lg" variant="outlined" class="mb-3">
              <v-btn value="service" size="small">Service</v-btn>
              <v-btn value="inventory" size="small">Inventory (tracked stock)</v-btn>
            </v-btn-toggle>

            <v-textarea v-model="form.description" label="Description" rows="2" variant="outlined" density="comfortable" class="mb-2" />

            <div class="text-caption text-medium-emphasis text-uppercase mb-1">Sales</div>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model.number="form.salesPrice" label="Sales price" type="number" step="0.01" />
              </v-col>
              <v-col cols="12" md="4">
                <v-select v-model="form.incomeAccountId" label="Income account" :items="incomeAccountOptions" item-title="title" item-value="value" />
              </v-col>
              <v-col cols="12" md="4">
                <v-select v-model="form.defaultTaxCodeId" label="Default tax" :items="taxCodeOptions" item-title="title" item-value="value" clearable />
              </v-col>
            </v-row>

            <div class="text-caption text-medium-emphasis text-uppercase mb-1 mt-2">Purchases</div>
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field v-model.number="form.purchasePrice" label="Purchase price / cost" type="number" step="0.01" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.unit" label="Unit (e.g. each, hour)" />
              </v-col>
            </v-row>

            <template v-if="form.kind === 'inventory'">
              <p class="text-caption text-medium-emphasis mt-2">
                Stock is valued at weighted-average cost and held in the <strong>Inventory</strong>
                account. Cost of goods sold posts automatically to the <strong>Cost of Goods Sold</strong>
                account on each sale.
              </p>
            </template>
            <template v-else>
              <div class="text-caption text-medium-emphasis text-uppercase mb-1 mt-2">Purchase account</div>
              <v-select v-model="form.expenseAccountId" label="Expense account (on bills)" :items="expenseAccountOptions" item-title="title" item-value="value" />
            </template>

            <v-switch v-model="form.isActive" label="Active" color="primary" hide-details class="mt-2" />
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

    <ConfirmDialog ref="confirmRef" title="Delete Item" message="Delete this item?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useItemsStore } from '@/stores/items'
import { useAccountsStore } from '@/stores/accounts'
import { useTaxStore } from '@/stores/tax'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency, formatNumber } from '@/utils/currency'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { Item, ItemKind } from '@/types/inventory'

const itemsStore = useItemsStore()
const accountsStore = useAccountsStore()
const taxStore = useTaxStore()
const orgStore = useOrganizationStore()

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const search = ref('')

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'SKU', key: 'sku', width: 120 },
  { title: 'Type', key: 'kind', width: 120 },
  { title: 'Sales Price', key: 'salesPrice', align: 'end' as const, width: 140 },
  { title: 'On Hand', key: 'qtyOnHand', align: 'end' as const, width: 100 },
  { title: 'Stock Value', key: 'stockValue', align: 'end' as const, width: 140 },
  { title: 'Status', key: 'isActive', width: 100, align: 'center' as const },
  { title: '', key: 'actions', sortable: false, width: 100, align: 'end' as const },
]

function accountOptions(type: 'revenue' | 'expense' | 'asset') {
  return accountsStore.activeAccounts
    .filter((a) => a.type === type)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => ({ title: `${a.code} — ${a.name}`, value: a.id }))
}
const incomeAccountOptions = computed(() => accountOptions('revenue'))
const expenseAccountOptions = computed(() => accountOptions('expense'))
const taxCodeOptions = computed(() =>
  taxStore.activeTaxCodes.map((t) => ({ title: `${t.name} (${t.rate}%)`, value: t.id }))
)

function blankForm() {
  return {
    name: '',
    sku: '',
    description: '',
    kind: 'service' as ItemKind,
    salesPrice: 0,
    incomeAccountId: accountsStore.getSystemAccount('sales')?.id || '',
    purchasePrice: 0,
    expenseAccountId: accountsStore.getSystemAccount('purchases')?.id || '',
    inventoryAccountId: accountsStore.getSystemAccount('inventory')?.id || '',
    cogsAccountId: accountsStore.getSystemAccount('cogs')?.id || '',
    defaultTaxCodeId: undefined as string | undefined,
    unit: 'each',
    isActive: true,
  }
}

const dialog = ref(false)
const editing = ref<Item | null>(null)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref(blankForm())

function openCreate() {
  form.value = blankForm()
  error.value = ''
  editing.value = null
  dialog.value = true
}

function openEdit(item: Item) {
  editing.value = item
  form.value = {
    name: item.name,
    sku: item.sku || '',
    description: item.description || '',
    kind: item.kind,
    salesPrice: item.salesPrice || 0,
    incomeAccountId: item.incomeAccountId || accountsStore.getSystemAccount('sales')?.id || '',
    purchasePrice: item.purchasePrice || 0,
    expenseAccountId: item.expenseAccountId || accountsStore.getSystemAccount('purchases')?.id || '',
    inventoryAccountId: item.inventoryAccountId || accountsStore.getSystemAccount('inventory')?.id || '',
    cogsAccountId: item.cogsAccountId || accountsStore.getSystemAccount('cogs')?.id || '',
    defaultTaxCodeId: item.defaultTaxCodeId,
    unit: item.unit || 'each',
    isActive: item.isActive,
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
    // Only persist the account fields relevant to the chosen kind.
    const payload = {
      ...form.value,
      inventoryAccountId: form.value.kind === 'inventory' ? form.value.inventoryAccountId : undefined,
      cogsAccountId: form.value.kind === 'inventory' ? form.value.cogsAccountId : undefined,
      expenseAccountId: form.value.kind === 'service' ? form.value.expenseAccountId : undefined,
    }
    if (editing.value) await itemsStore.updateItem(editing.value.id, payload)
    else await itemsStore.createItem(payload)
    dialog.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(item: Item) {
  const ok = await confirmRef.value?.open()
  if (!ok) return
  try {
    await itemsStore.deleteItem(item.id)
  } catch (e: any) {
    error.value = e.message
    dialog.value = false
    alert(e.message)
  }
}

function subscribeAll() {
  if (!orgStore.orgId) return
  itemsStore.subscribe()
  accountsStore.subscribe()
  taxStore.subscribe()
}

onMounted(subscribeAll)
watch(() => orgStore.orgId, (id) => id && subscribeAll())
</script>
