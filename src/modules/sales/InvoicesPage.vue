<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Sales Invoices</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'invoice-new' }">
        New Invoice
      </v-btn>
    </div>

    <v-card elevation="1" class="pa-4 mb-4">
      <v-row align="center">
        <v-col cols="12" md="3">
          <v-select v-model="statusFilter" label="Status" :items="statusOptions" hide-details />
        </v-col>
        <v-col cols="12" md="3">
          <v-select v-model="customerFilter" label="Customer" :items="customerOptions" item-title="title" item-value="value" hide-details clearable />
        </v-col>
      </v-row>
    </v-card>

    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="filteredInvoices"
        :loading="invoicesStore.loading"
        :items-per-page="25"
        @click:row="onRowClick"
      >
        <template #item.date="{ item }">{{ formatDate(item.date) }}</template>
        <template #item.dueDate="{ item }">
          <span :class="isOverdue(item) ? 'text-error font-weight-bold' : ''">
            {{ formatDate(item.dueDate) }}
          </span>
        </template>
        <template #item.total="{ item }">{{ formatCurrency(item.total, currency) }}</template>
        <template #item.amountDue="{ item }">{{ formatCurrency(item.amountDue, currency) }}</template>
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" size="small" variant="tonal">
            {{ statusLabel(item.status) }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            v-if="item.amountDue > 0 && item.status !== 'draft' && item.status !== 'void'"
            icon="mdi-cash"
            size="small"
            variant="text"
            color="success"
            title="Record payment"
            @click.stop="openReceipt(item)"
          />
          <v-btn icon="mdi-file-pdf-box" size="small" variant="text" title="Download PDF" @click.stop="downloadPDF(item)" />
          <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="editInvoice(item.id)" />
          <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="confirmDelete(item.id)" />
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">
            No invoices yet. <router-link :to="{ name: 'invoice-new' }">Create one</router-link>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Receipt Dialog -->
    <v-dialog v-model="receiptDialog" max-width="500" persistent>
      <v-card v-if="receiptInvoice">
        <v-card-title>Record Payment</v-card-title>
        <v-card-subtitle>
          {{ receiptInvoice.number }} —
          Amount due: <strong>{{ formatCurrency(receiptInvoice.amountDue, currency) }}</strong>
        </v-card-subtitle>
        <v-card-text>
          <v-form ref="receiptFormRef" @submit.prevent="saveReceipt">
            <v-text-field v-model="receiptForm.dateStr" label="Date" type="date" :rules="[required]" class="mb-2" />
            <v-text-field
              v-model.number="receiptForm.amount"
              label="Amount"
              type="number"
              step="0.01"
              :rules="[required, positiveNumber]"
              class="mb-2"
            />
            <v-select v-model="receiptForm.method" label="Payment Method" :items="paymentMethods" class="mb-2" />
            <v-text-field v-model="receiptForm.reference" label="Reference / Receipt #" class="mb-2" />
            <v-textarea v-model="receiptForm.notes" label="Notes" rows="2" variant="outlined" density="comfortable" />
            <v-alert v-if="receiptError" type="error" variant="tonal" class="mt-2">{{ receiptError }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="receiptDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="recording" @click="saveReceipt">Record</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog ref="confirmRef" title="Delete Invoice" message="Delete this invoice?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useInvoicesStore } from '@/stores/invoices'
import { useCustomersStore } from '@/stores/customers'
import { useOrganizationStore } from '@/stores/organization'
import { required, positiveNumber } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO } from '@/utils/date'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { exportInvoicePDF } from '@/utils/pdf'
import type { SalesInvoice, InvoiceStatus } from '@/types/sales'

const router = useRouter()
const invoicesStore = useInvoicesStore()
const customersStore = useCustomersStore()
const orgStore = useOrganizationStore()

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const statusFilter = ref<'all' | InvoiceStatus>('all')
const customerFilter = ref<string | null>(null)

const statusOptions = [
  { title: 'All', value: 'all' },
  { title: 'Draft', value: 'draft' },
  { title: 'Sent', value: 'sent' },
  { title: 'Partially Paid', value: 'partially_paid' },
  { title: 'Paid', value: 'paid' },
  { title: 'Overdue', value: 'overdue' },
  { title: 'Void', value: 'void' },
]

const customerOptions = computed(() =>
  customersStore.customers.map((c) => ({ title: c.name, value: c.id }))
)

const filteredInvoices = computed(() =>
  invoicesStore.invoices.filter((i) => {
    if (statusFilter.value !== 'all' && i.status !== statusFilter.value) return false
    if (customerFilter.value && i.customerId !== customerFilter.value) return false
    return true
  })
)

const headers = [
  { title: 'Number', key: 'number', width: 130 },
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Customer', key: 'customerName' },
  { title: 'Due Date', key: 'dueDate', width: 130 },
  { title: 'Total', key: 'total', align: 'end' as const, width: 140 },
  { title: 'Due', key: 'amountDue', align: 'end' as const, width: 140 },
  { title: 'Status', key: 'status', width: 130 },
  { title: '', key: 'actions', sortable: false, width: 160, align: 'end' as const },
]

function isOverdue(inv: SalesInvoice): boolean {
  return inv.status !== 'paid' && inv.status !== 'void' && inv.dueDate < new Date()
}

function statusColor(status: InvoiceStatus): string {
  return {
    draft: 'grey',
    sent: 'blue',
    paid: 'success',
    partially_paid: 'orange',
    overdue: 'error',
    void: 'grey',
  }[status]
}

function statusLabel(status: InvoiceStatus): string {
  return status.replace('_', ' ')
}

function onRowClick(_: any, row: { item: SalesInvoice }) {
  editInvoice(row.item.id)
}

function editInvoice(id: string) {
  router.push({ name: 'invoice-edit', params: { id } })
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(id: string) {
  const ok = await confirmRef.value?.open()
  if (ok) await invoicesStore.deleteInvoice(id)
}

function downloadPDF(inv: SalesInvoice) {
  if (!orgStore.currentOrg) return
  const customer = customersStore.getCustomer(inv.customerId)
  exportInvoicePDF(inv, orgStore.currentOrg, {
    name: customer?.name || inv.customerName || '',
    email: customer?.email || '',
    address: customer?.address || '',
    taxId: customer?.taxId || '',
  })
}

// Receipt dialog
const receiptDialog = ref(false)
const receiptInvoice = ref<SalesInvoice | null>(null)
const receiptFormRef = ref()
const recording = ref(false)
const receiptError = ref('')
const receiptForm = ref({
  dateStr: formatDateISO(new Date()),
  amount: 0,
  method: 'Cash',
  reference: '',
  notes: '',
})
const paymentMethods = ['Cash', 'Bank Transfer', 'Mobile Money', 'Cheque', 'Card', 'Other']

function openReceipt(inv: SalesInvoice) {
  receiptInvoice.value = inv
  receiptForm.value = {
    dateStr: formatDateISO(new Date()),
    amount: inv.amountDue,
    method: 'Cash',
    reference: '',
    notes: '',
  }
  receiptError.value = ''
  receiptDialog.value = true
}

async function saveReceipt() {
  if (!receiptInvoice.value) return
  const { valid } = await receiptFormRef.value.validate()
  if (!valid) return
  recording.value = true
  receiptError.value = ''
  try {
    await invoicesStore.recordReceipt({
      customerId: receiptInvoice.value.customerId,
      invoiceId: receiptInvoice.value.id,
      date: new Date(receiptForm.value.dateStr),
      amount: receiptForm.value.amount,
      method: receiptForm.value.method,
      reference: receiptForm.value.reference,
      notes: receiptForm.value.notes,
    })
    receiptDialog.value = false
  } catch (e: any) {
    receiptError.value = e.message
  } finally {
    recording.value = false
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
