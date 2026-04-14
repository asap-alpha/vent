<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Suppliers</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">New Supplier</v-btn>
    </div>

    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="suppliers"
        :loading="suppliersStore.loading"
        :items-per-page="25"
      >
        <template #item.balance="{ item }">
          {{ formatCurrency(billsStore.supplierBalance(item.id), currency) }}
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
          <div class="text-center pa-8 text-grey">No suppliers yet.</div>
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="600" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Edit Supplier' : 'New Supplier' }}</v-card-title>
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

    <ConfirmDialog ref="confirmRef" title="Delete Supplier" message="Delete this supplier?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSuppliersStore } from '@/stores/suppliers'
import { useBillsStore } from '@/stores/bills'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { Supplier } from '@/types/purchases'

const suppliersStore = useSuppliersStore()
const billsStore = useBillsStore()
const orgStore = useOrganizationStore()

const suppliers = computed(() => suppliersStore.suppliers)
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Email', key: 'email' },
  { title: 'Phone', key: 'phone' },
  { title: 'Balance Due', key: 'balance', align: 'end' as const, width: 160 },
  { title: 'Active', key: 'isActive', width: 80, align: 'center' as const },
  { title: '', key: 'actions', sortable: false, width: 120, align: 'end' as const },
]

const dialog = ref(false)
const editing = ref<Supplier | null>(null)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref({
  name: '', email: '', phone: '', address: '', taxId: '', isActive: true,
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

function openEdit(s: Supplier) {
  editing.value = s
  form.value = { name: s.name, email: s.email, phone: s.phone, address: s.address, taxId: s.taxId, isActive: s.isActive }
  error.value = ''
  dialog.value = true
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  saving.value = true
  error.value = ''
  try {
    if (editing.value) await suppliersStore.updateSupplier(editing.value.id, form.value)
    else await suppliersStore.createSupplier(form.value)
    dialog.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(s: Supplier) {
  const ok = await confirmRef.value?.open()
  if (ok) await suppliersStore.deleteSupplier(s.id)
}

onMounted(() => {
  if (orgStore.orgId) {
    suppliersStore.subscribe()
    billsStore.subscribe()
  }
})

watch(() => orgStore.orgId, (id) => {
  if (id) {
    suppliersStore.subscribe()
    billsStore.subscribe()
  }
})
</script>
