<template>
  <div>
    <PageHeader title="Quotes">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
          New Quote
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
        :items="quotes"
        :loading="invoicesStore.loading"
        :items-per-page="25"
        :search="search"
      >
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.expiryDate="{ item }">{{ formatDate(item.expiryDate) }}</template>
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
            title="Convert to invoice"
            @click="openConvert(item)"
          />
          <v-btn icon="mdi-pencil" size="x-small" variant="text" @click="openEdit(item)" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="confirmDelete(item.id)" />
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-file-document-edit-outline"
            title="No quotes yet"
            description="Create a quote to send pricing proposals to your customers."
            action-label="New Quote"
            action-icon="mdi-plus"
            @action="openCreate"
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- Quote Form Dialog -->
    <v-dialog v-model="dialog" max-width="900" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Edit Quote' : 'New Quote' }}</v-card-title>
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
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-text-field v-model="form.number" label="Quote #" :rules="[required]" />
              </v-col>
              <v-col cols="6" md="2">
                <v-text-field v-model="form.dateStr" label="Date" type="date" :rules="[required]" />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="form.expiryDateStr" label="Expiry Date" type="date" :rules="[required]" />
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

    <!-- Convert Dialog -->
    <v-dialog v-model="convertDialog" max-width="450" persistent>
      <v-card v-if="convertingQuote">
        <v-card-title>Convert Quote to Invoice</v-card-title>
        <v-card-subtitle>{{ convertingQuote.number }} — {{ formatCurrency(convertingQuote.total, currency) }}</v-card-subtitle>
        <v-card-text>
          <v-text-field v-model="convertForm.invoiceNumber" label="Invoice #" :rules="[required]" class="mb-2" />
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

    <ConfirmDialog ref="confirmRef" title="Delete Quote" message="Delete this quote?" confirm-text="Delete" />
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
import { addDays } from 'date-fns'
import LineItemsEditor from '@/components/common/LineItemsEditor.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { Quote, QuoteStatus, InvoiceLine } from '@/types/sales'

const invoicesStore = useInvoicesStore()
const customersStore = useCustomersStore()
const orgStore = useOrganizationStore()

const quotes = computed(() => invoicesStore.quotes)
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const search = ref('')

const customerOptions = computed(() =>
  customersStore.activeCustomers.map((c) => ({ title: c.name, value: c.id }))
)

const headers = [
  { title: 'Number', key: 'number', width: 130 },
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Customer', key: 'customerName' },
  { title: 'Expires', key: 'expiryDate', width: 130 },
  { title: 'Total', key: 'total', align: 'end' as const, width: 140 },
  { title: 'Status', key: 'status', width: 130 },
  { title: '', key: 'actions', sortable: false, width: 160, align: 'end' as const },
]

function statusColor(status: QuoteStatus): string {
  return {
    draft: 'grey',
    sent: 'blue',
    accepted: 'success',
    declined: 'error',
    expired: 'warning',
    converted: 'purple',
  }[status]
}

const dialog = ref(false)
const editing = ref<Quote | null>(null)
const formRef = ref()
const saving = ref(false)
const error = ref('')
const form = ref({
  customerId: '',
  number: '',
  dateStr: formatDateISO(new Date()),
  expiryDateStr: formatDateISO(addDays(new Date(), 30)),
  notes: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }] as InvoiceLine[],
})

function reset() {
  form.value = {
    customerId: '',
    number: invoicesStore.nextQuoteNumber(),
    dateStr: formatDateISO(new Date()),
    expiryDateStr: formatDateISO(addDays(new Date(), 30)),
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

function openEdit(q: Quote) {
  editing.value = q
  form.value = {
    customerId: q.customerId,
    number: q.number,
    dateStr: formatDateISO(q.date),
    expiryDateStr: formatDateISO(q.expiryDate),
    notes: q.notes,
    lines: q.lines.map((l) => ({ ...l })),
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
    const customer = customersStore.getCustomer(form.value.customerId)
    const data = {
      customerId: form.value.customerId,
      customerName: customer?.name,
      number: form.value.number,
      date: new Date(form.value.dateStr),
      expiryDate: new Date(form.value.expiryDateStr),
      lines,
      notes: form.value.notes,
    }
    if (editing.value) await invoicesStore.updateQuote(editing.value.id, data)
    else await invoicesStore.createQuote(data)
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
  if (ok) await invoicesStore.deleteQuote(id)
}

// Convert
const convertDialog = ref(false)
const convertingQuote = ref<Quote | null>(null)
const converting = ref(false)
const convertError = ref('')
const convertForm = ref({
  invoiceNumber: '',
  dueDateStr: formatDateISO(addDays(new Date(), 30)),
})

function openConvert(q: Quote) {
  convertingQuote.value = q
  convertForm.value = {
    invoiceNumber: invoicesStore.nextInvoiceNumber(),
    dueDateStr: formatDateISO(addDays(new Date(), 30)),
  }
  convertError.value = ''
  convertDialog.value = true
}

async function doConvert() {
  if (!convertingQuote.value) return
  converting.value = true
  convertError.value = ''
  try {
    await invoicesStore.convertQuoteToInvoice(
      convertingQuote.value.id,
      new Date(convertForm.value.dueDateStr),
      convertForm.value.invoiceNumber
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
