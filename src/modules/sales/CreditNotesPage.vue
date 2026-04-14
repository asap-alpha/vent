<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Credit Notes</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">New Credit Note</v-btn>
    </div>

    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="creditNotes"
        :loading="invoicesStore.loading"
        :items-per-page="25"
      >
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.invoiceNumber="{ item }">
          {{ getInvoiceNumber(item.invoiceId) }}
        </template>
        <template #item.total="{ item }">{{ formatCurrency(item.total, currency) }}</template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item.id)" />
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">No credit notes yet.</div>
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="dialog" max-width="900" persistent>
      <v-card>
        <v-card-title>New Credit Note</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="save">
            <v-row>
              <v-col cols="12" md="4">
                <v-select
                  v-model="form.customerId"
                  label="Customer"
                  :items="customerOptions"
                  item-title="title"
                  item-value="value"
                  :rules="[required]"
                  @update:model-value="form.invoiceId = ''"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="form.invoiceId"
                  label="Against Invoice"
                  :items="invoiceOptions"
                  item-title="title"
                  item-value="value"
                  :rules="[required]"
                  :disabled="!form.customerId"
                />
              </v-col>
              <v-col cols="6" md="2">
                <v-text-field v-model="form.number" label="CN #" :rules="[required]" />
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

    <ConfirmDialog ref="confirmRef" title="Delete Credit Note" message="Delete this credit note?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useInvoicesStore } from '@/stores/invoices'
import { useCustomersStore } from '@/stores/customers'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO } from '@/utils/date'
import LineItemsEditor from '@/components/common/LineItemsEditor.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { InvoiceLine } from '@/types/sales'

const invoicesStore = useInvoicesStore()
const customersStore = useCustomersStore()
const orgStore = useOrganizationStore()

const creditNotes = computed(() => invoicesStore.creditNotes)
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const customerOptions = computed(() =>
  customersStore.activeCustomers.map((c) => ({ title: c.name, value: c.id }))
)

const invoiceOptions = computed(() =>
  invoicesStore.invoices
    .filter((i) => i.customerId === form.value.customerId)
    .map((i) => ({ title: `${i.number} (${formatCurrency(i.total, currency.value)})`, value: i.id }))
)

const headers = [
  { title: 'Number', key: 'number', width: 130 },
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Customer', key: 'customerName' },
  { title: 'Invoice', key: 'invoiceNumber', width: 140 },
  { title: 'Total', key: 'total', align: 'end' as const, width: 140 },
  { title: '', key: 'actions', sortable: false, width: 80, align: 'end' as const },
]

function getInvoiceNumber(invoiceId: string): string {
  return invoicesStore.invoices.find((i) => i.id === invoiceId)?.number || '—'
}

const dialog = ref(false)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref({
  customerId: '',
  invoiceId: '',
  number: '',
  dateStr: formatDateISO(new Date()),
  notes: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }] as InvoiceLine[],
})

function reset() {
  form.value = {
    customerId: '',
    invoiceId: '',
    number: invoicesStore.nextCreditNoteNumber(),
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
    const customer = customersStore.getCustomer(form.value.customerId)
    await invoicesStore.createCreditNote({
      customerId: form.value.customerId,
      customerName: customer?.name,
      invoiceId: form.value.invoiceId,
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
  if (ok) await invoicesStore.deleteCreditNote(id)
}

onMounted(() => {
  if (orgStore.orgId) {
    invoicesStore.subscribe()
    customersStore.subscribe()
  }
})

watch(() => orgStore.orgId, (id) => {
  if (id) {
    invoicesStore.subscribe()
    customersStore.subscribe()
  }
})
</script>
