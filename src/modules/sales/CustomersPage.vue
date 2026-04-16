<template>
  <div>
    <PageHeader title="Customers">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
          New Customer
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
        :items="customers"
        :loading="customersStore.loading"
        :items-per-page="25"
        :search="search"
      >
        <template #item.balance="{ item }">
          {{ formatCurrency(invoicesStore.customerBalance(item.id), currency) }}
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
            icon="mdi-account-group-outline"
            title="No customers yet"
            description="Add your first customer to start creating invoices and tracking sales."
            action-label="New Customer"
            action-icon="mdi-plus"
            @action="openCreate"
          />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="600" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Edit Customer' : 'New Customer' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="save">
            <v-text-field v-model="form.name" label="Name" :rules="[required]" class="mb-2" />
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.email" label="Email" type="email" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.phone" label="Phone" />
              </v-col>
            </v-row>
            <v-textarea v-model="form.address" label="Address" rows="2" variant="outlined" density="comfortable" class="mb-2" />
            <v-text-field v-model="form.taxId" label="Tax ID" class="mb-2" />
            <v-switch v-model="form.isActive" label="Active" color="primary" hide-details />
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

    <ConfirmDialog ref="confirmRef" title="Delete Customer" message="Delete this customer?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCustomersStore } from '@/stores/customers'
import { useInvoicesStore } from '@/stores/invoices'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { Customer } from '@/types/sales'

const customersStore = useCustomersStore()
const invoicesStore = useInvoicesStore()
const orgStore = useOrganizationStore()

const customers = computed(() => customersStore.customers)
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const search = ref('')

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Email', key: 'email' },
  { title: 'Phone', key: 'phone' },
  { title: 'Balance Due', key: 'balance', align: 'end' as const, width: 160 },
  { title: 'Status', key: 'isActive', width: 100, align: 'center' as const },
  { title: '', key: 'actions', sortable: false, width: 100, align: 'end' as const },
]

const dialog = ref(false)
const editing = ref<Customer | null>(null)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  isActive: true,
})

function reset() {
  form.value = { name: '', email: '', phone: '', address: '', taxId: '', isActive: true }
  error.value = ''
  editing.value = null
}

function openCreate() {
  reset()
  dialog.value = true
}

function openEdit(c: Customer) {
  editing.value = c
  form.value = { name: c.name, email: c.email, phone: c.phone, address: c.address, taxId: c.taxId, isActive: c.isActive }
  error.value = ''
  dialog.value = true
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  saving.value = true
  error.value = ''
  try {
    if (editing.value) await customersStore.updateCustomer(editing.value.id, form.value)
    else await customersStore.createCustomer(form.value)
    dialog.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(c: Customer) {
  const ok = await confirmRef.value?.open()
  if (ok) await customersStore.deleteCustomer(c.id)
}

onMounted(() => {
  if (orgStore.orgId) {
    customersStore.subscribe()
    invoicesStore.subscribe()
  }
})

watch(
  () => orgStore.orgId,
  (id) => {
    if (id) {
      customersStore.subscribe()
      invoicesStore.subscribe()
    }
  }
)
</script>
