<template>
  <div>
    <PageHeader title="Purchase Orders">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
          New PO
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
        :items="purchaseOrders"
        :loading="billsStore.loading"
        :items-per-page="25"
        :search="search"
      >
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.total="{ item }">{{ formatCurrency(item.total, currency) }}</template>
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" size="x-small" variant="tonal">{{ item.status }}</v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            v-if="item.status !== 'converted'"
            icon="mdi-arrow-right-bold"
            size="x-small"
            variant="text"
            color="success"
            title="Convert to bill"
            @click="openConvert(item)"
          />
          <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="confirmDelete(item.id)" />
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-clipboard-list-outline"
            title="No purchase orders yet"
            description="Create a purchase order to request goods or services from suppliers."
            action-label="New PO"
            action-icon="mdi-plus"
            @action="openCreate"
          />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="900" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Edit Purchase Order' : 'New Purchase Order' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="save">
            <v-row>
              <v-col cols="12" md="5">
                <v-select
                  v-model="form.supplierId"
                  label="Supplier"
                  :items="supplierOptions"
                  item-title="title"
                  item-value="value"
                  :rules="[required]"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="form.number" label="PO #" :rules="[required]" />
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field v-model="form.dateStr" label="Date" type="date" :rules="[required]" />
              </v-col>
            </v-row>
            <LineItemsEditor v-model="form.lines" :currency="currency" />
            <v-textarea
              v-model="form.notes"
              label="Notes"
              rows="2"
              variant="outlined"
              density="comfortable"
              class="mt-4"
            />
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

    <v-dialog v-model="convertDialog" max-width="450" persistent>
      <v-card v-if="convertingPO">
        <v-card-title>Convert PO to Bill</v-card-title>
        <v-card-subtitle>{{ convertingPO.number }} — {{ formatCurrency(convertingPO.total, currency) }}</v-card-subtitle>
        <v-card-text>
          <v-text-field v-model="convertForm.billNumber" label="Bill #" :rules="[required]" class="mb-2" />
          <v-text-field v-model="convertForm.dueDateStr" label="Due Date" type="date" :rules="[required]" />
          <v-alert v-if="convertError" type="error" variant="tonal" class="mt-2">{{ convertError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="convertDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="converting" @click="doConvert">Convert</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog ref="confirmRef" title="Delete Purchase Order" message="Delete this PO?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBillsStore } from '@/stores/bills'
import { useSuppliersStore } from '@/stores/suppliers'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO } from '@/utils/date'
import { addDays } from 'date-fns'
import LineItemsEditor from '@/components/common/LineItemsEditor.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { PurchaseOrder, PurchaseOrderStatus, BillLine } from '@/types/purchases'

const billsStore = useBillsStore()
const suppliersStore = useSuppliersStore()
const orgStore = useOrganizationStore()

const purchaseOrders = computed(() => billsStore.purchaseOrders)
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const search = ref('')

const supplierOptions = computed(() =>
  suppliersStore.activeSuppliers.map((s) => ({ title: s.name, value: s.id }))
)

const headers = [
  { title: 'Number', key: 'number', width: 130 },
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Supplier', key: 'supplierName' },
  { title: 'Total', key: 'total', align: 'end' as const, width: 140 },
  { title: 'Status', key: 'status', width: 130 },
  { title: '', key: 'actions', sortable: false, width: 160, align: 'end' as const },
]

function statusColor(status: PurchaseOrderStatus): string {
  return {
    draft: 'grey',
    sent: 'blue',
    received: 'success',
    closed: 'grey',
    cancelled: 'error',
    converted: 'purple',
  }[status]
}

const dialog = ref(false)
const editing = ref<PurchaseOrder | null>(null)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref({
  supplierId: '',
  number: '',
  dateStr: formatDateISO(new Date()),
  notes: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }] as BillLine[],
})

function reset() {
  form.value = {
    supplierId: '',
    number: billsStore.nextPONumber(),
    dateStr: formatDateISO(new Date()),
    notes: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }],
  }
  error.value = ''
  editing.value = null
}

function openCreate() {
  reset()
  dialog.value = true
}

function openEdit(p: PurchaseOrder) {
  editing.value = p
  form.value = {
    supplierId: p.supplierId,
    number: p.number,
    dateStr: formatDateISO(p.date),
    notes: p.notes,
    lines: p.lines.map((l) => ({ ...l })),
  }
  error.value = ''
  dialog.value = true
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  const lines = form.value.lines.filter((l) => l.description || l.quantity > 0 || l.unitPrice > 0)
  if (lines.length === 0) {
    error.value = 'At least one line item is required'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const supplier = suppliersStore.getSupplier(form.value.supplierId)
    const data = {
      supplierId: form.value.supplierId,
      supplierName: supplier?.name,
      number: form.value.number,
      date: new Date(form.value.dateStr),
      lines,
      notes: form.value.notes,
    }
    if (editing.value) await billsStore.updatePO(editing.value.id, data)
    else await billsStore.createPO(data)
    dialog.value = false
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(id: string) {
  const ok = await confirmRef.value?.open()
  if (ok) await billsStore.deletePO(id)
}

// Convert
const convertDialog = ref(false)
const convertingPO = ref<PurchaseOrder | null>(null)
const converting = ref(false)
const convertError = ref('')
const convertForm = ref({
  billNumber: '',
  dueDateStr: formatDateISO(addDays(new Date(), 30)),
})

function openConvert(p: PurchaseOrder) {
  convertingPO.value = p
  convertForm.value = {
    billNumber: billsStore.nextBillNumber(),
    dueDateStr: formatDateISO(addDays(new Date(), 30)),
  }
  convertError.value = ''
  convertDialog.value = true
}

async function doConvert() {
  if (!convertingPO.value) return
  converting.value = true
  convertError.value = ''
  try {
    await billsStore.convertPOToBill(
      convertingPO.value.id,
      new Date(convertForm.value.dueDateStr),
      convertForm.value.billNumber
    )
    convertDialog.value = false
  } catch (e: any) {
    convertError.value = e.message
  } finally {
    converting.value = false
  }
}

onMounted(() => {
  if (orgStore.orgId) {
    billsStore.subscribe()
    suppliersStore.subscribe()
  }
})

watch(() => orgStore.orgId, (id) => {
  if (id) {
    billsStore.subscribe()
    suppliersStore.subscribe()
  }
})
</script>
