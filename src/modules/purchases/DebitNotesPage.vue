<template>
  <div>
    <PageHeader title="Debit Notes">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
          New Debit Note
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
        :items="debitNotes"
        :loading="billsStore.loading"
        :items-per-page="25"
        :search="search"
      >
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.billNumber="{ item }">
          {{ getBillNumber(item.billId) }}
        </template>
        <template #item.total="{ item }">{{ formatCurrency(item.total, currency) }}</template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="confirmDelete(item.id)" />
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-file-undo-outline"
            title="No debit notes yet"
            description="Issue a debit note to adjust or request a refund on a bill."
            action-label="New Debit Note"
            action-icon="mdi-plus"
            @action="openCreate"
          />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="900" persistent>
      <v-card>
        <v-card-title>New Debit Note</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="save">
            <v-row>
              <v-col cols="12" md="4">
                <v-select
                  v-model="form.supplierId"
                  label="Supplier"
                  :items="supplierOptions"
                  item-title="title"
                  item-value="value"
                  :rules="[required]"
                  @update:model-value="form.billId = ''"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="form.billId"
                  label="Against Bill"
                  :items="billOptions"
                  item-title="title"
                  item-value="value"
                  :rules="[required]"
                  :disabled="!form.supplierId"
                />
              </v-col>
              <v-col cols="6" md="2">
                <v-text-field v-model="form.number" label="DN #" :rules="[required]" />
              </v-col>
              <v-col cols="6" md="2">
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

    <ConfirmDialog ref="confirmRef" title="Delete Debit Note" message="Delete this debit note?" confirm-text="Delete" />
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
import LineItemsEditor from '@/components/common/LineItemsEditor.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { BillLine } from '@/types/purchases'

const billsStore = useBillsStore()
const suppliersStore = useSuppliersStore()
const orgStore = useOrganizationStore()

const debitNotes = computed(() => billsStore.debitNotes)
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const search = ref('')

const supplierOptions = computed(() =>
  suppliersStore.activeSuppliers.map((s) => ({ title: s.name, value: s.id }))
)

const billOptions = computed(() =>
  billsStore.bills
    .filter((b) => b.supplierId === form.value.supplierId)
    .map((b) => ({ title: `${b.number} (${formatCurrency(b.total, currency.value)})`, value: b.id }))
)

const headers = [
  { title: 'Number', key: 'number', width: 130 },
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Supplier', key: 'supplierName' },
  { title: 'Bill', key: 'billNumber', width: 140 },
  { title: 'Total', key: 'total', align: 'end' as const, width: 140 },
  { title: '', key: 'actions', sortable: false, width: 80, align: 'end' as const },
]

function getBillNumber(billId: string): string {
  return billsStore.bills.find((b) => b.id === billId)?.number || '—'
}

const dialog = ref(false)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref({
  supplierId: '',
  billId: '',
  number: '',
  dateStr: formatDateISO(new Date()),
  notes: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }] as BillLine[],
})

function reset() {
  form.value = {
    supplierId: '',
    billId: '',
    number: billsStore.nextDebitNoteNumber(),
    dateStr: formatDateISO(new Date()),
    notes: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }],
  }
  error.value = ''
}

function openCreate() {
  reset()
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
    await billsStore.createDebitNote({
      supplierId: form.value.supplierId,
      supplierName: supplier?.name,
      billId: form.value.billId,
      number: form.value.number,
      date: new Date(form.value.dateStr),
      lines,
      notes: form.value.notes,
    })
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
  if (ok) await billsStore.deleteDebitNote(id)
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
