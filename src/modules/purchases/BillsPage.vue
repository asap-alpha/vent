<template>
  <div>
    <PageHeader title="Bills">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" :to="{ name: 'bill-new' }">
          New Bill
        </v-btn>
      </template>
    </PageHeader>

    <v-card>
      <div class="d-flex align-center flex-wrap ga-2 pa-4 pb-0">
        <v-select
          v-model="statusFilter"
          label="Status"
          :items="statusOptions"
          hide-details
          density="compact"
          style="max-width: 180px"
        />
        <v-select
          v-model="supplierFilter"
          label="Supplier"
          :items="supplierOptions"
          item-title="title"
          item-value="value"
          hide-details
          clearable
          density="compact"
          style="max-width: 180px"
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
        :items="filteredBills"
        :loading="billsStore.loading"
        :items-per-page="25"
        :search="search"
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
          <v-chip :color="statusColor(item.status)" size="x-small" variant="tonal">
            {{ statusLabel(item.status) }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <v-btn
            v-if="item.amountDue > 0 && item.status !== 'draft' && item.status !== 'void'"
            icon="mdi-cash"
            size="x-small"
            variant="text"
            color="success"
            title="Record payment"
            @click.stop="openPayment(item)"
          />
          <v-btn icon="mdi-file-pdf-box" size="x-small" variant="text" title="Download PDF" @click.stop="downloadPDF(item)" />
          <v-btn icon="mdi-pencil" size="x-small" variant="text" @click.stop="editBill(item.id)" />
          <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="confirmDelete(item.id)" />
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-file-document-outline"
            title="No bills yet"
            description="Record your first bill to track supplier purchases and payments."
            action-label="New Bill"
            action-icon="mdi-plus"
            :action-to="{ name: 'bill-new' }"
          />
        </template>
      </v-data-table>
    </v-card>

    <v-dialog v-model="paymentDialog" max-width="500" persistent>
      <v-card v-if="paymentBill">
        <v-card-title>Record Payment</v-card-title>
        <v-card-subtitle>
          {{ paymentBill.number }} —
          Amount due: <strong>{{ formatCurrency(paymentBill.amountDue, currency) }}</strong>
        </v-card-subtitle>
        <v-card-text>
          <v-form ref="paymentFormRef" @submit.prevent="savePayment">
            <v-text-field v-model="paymentForm.dateStr" label="Date" type="date" :rules="[required]" class="mb-2" />
            <v-text-field
              v-model.number="paymentForm.amount"
              label="Amount"
              type="number"
              step="0.01"
              :rules="[required, positiveNumber]"
              class="mb-2"
            />
            <v-select v-model="paymentForm.method" label="Payment Method" :items="paymentMethods" class="mb-2" />
            <v-text-field v-model="paymentForm.reference" label="Reference / Cheque #" class="mb-2" />
            <v-textarea v-model="paymentForm.notes" label="Notes" rows="2" variant="outlined" density="comfortable" />
            <v-alert v-if="paymentError" type="error" variant="tonal" class="mt-2">{{ paymentError }}</v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="paymentDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="recording" @click="savePayment">Record</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog ref="confirmRef" title="Delete Bill" message="Delete this bill?" confirm-text="Delete" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBillsStore } from '@/stores/bills'
import { useSuppliersStore } from '@/stores/suppliers'
import { useOrganizationStore } from '@/stores/organization'
import { required, positiveNumber } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { formatDate, formatDateISO } from '@/utils/date'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { exportBillPDF } from '@/utils/pdf'
import type { PurchaseInvoice, BillStatus } from '@/types/purchases'

const router = useRouter()
const billsStore = useBillsStore()
const suppliersStore = useSuppliersStore()
const orgStore = useOrganizationStore()

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const search = ref('')

const statusFilter = ref<'all' | BillStatus>('all')
const supplierFilter = ref<string | null>(null)

const statusOptions = [
  { title: 'All', value: 'all' },
  { title: 'Draft', value: 'draft' },
  { title: 'Received', value: 'received' },
  { title: 'Partially Paid', value: 'partially_paid' },
  { title: 'Paid', value: 'paid' },
  { title: 'Overdue', value: 'overdue' },
  { title: 'Void', value: 'void' },
]

const supplierOptions = computed(() =>
  suppliersStore.suppliers.map((s) => ({ title: s.name, value: s.id }))
)

const filteredBills = computed(() =>
  billsStore.bills.filter((b) => {
    if (statusFilter.value !== 'all' && b.status !== statusFilter.value) return false
    if (supplierFilter.value && b.supplierId !== supplierFilter.value) return false
    return true
  })
)

const headers = [
  { title: 'Number', key: 'number', width: 130 },
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Supplier', key: 'supplierName' },
  { title: 'Due Date', key: 'dueDate', width: 130 },
  { title: 'Total', key: 'total', align: 'end' as const, width: 140 },
  { title: 'Due', key: 'amountDue', align: 'end' as const, width: 140 },
  { title: 'Status', key: 'status', width: 130 },
  { title: '', key: 'actions', sortable: false, width: 160, align: 'end' as const },
]

function isOverdue(b: PurchaseInvoice): boolean {
  return b.status !== 'paid' && b.status !== 'void' && b.dueDate < new Date()
}

function statusColor(status: BillStatus): string {
  return {
    draft: 'grey',
    received: 'blue',
    paid: 'success',
    partially_paid: 'orange',
    overdue: 'error',
    void: 'grey',
  }[status]
}

function statusLabel(s: BillStatus): string {
  return s.replace('_', ' ')
}

function onRowClick(_: any, row: { item: PurchaseInvoice }) {
  editBill(row.item.id)
}

function editBill(id: string) {
  router.push({ name: 'bill-edit', params: { id } })
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(id: string) {
  const ok = await confirmRef.value?.open()
  if (ok) await billsStore.deleteBill(id)
}

function downloadPDF(bill: PurchaseInvoice) {
  if (!orgStore.currentOrg) return
  const supplier = suppliersStore.getSupplier(bill.supplierId)
  exportBillPDF(bill, orgStore.currentOrg, {
    name: supplier?.name || bill.supplierName || '',
    email: supplier?.email || '',
    address: supplier?.address || '',
    taxId: supplier?.taxId || '',
  })
}

// Payment dialog
const paymentDialog = ref(false)
const paymentBill = ref<PurchaseInvoice | null>(null)
const paymentFormRef = ref()
const recording = ref(false)
const paymentError = ref('')
const paymentForm = ref({
  dateStr: formatDateISO(new Date()),
  amount: 0,
  method: 'Bank Transfer',
  reference: '',
  notes: '',
})
const paymentMethods = ['Cash', 'Bank Transfer', 'Mobile Money', 'Cheque', 'Card', 'Other']

function openPayment(b: PurchaseInvoice) {
  paymentBill.value = b
  paymentForm.value = {
    dateStr: formatDateISO(new Date()),
    amount: b.amountDue,
    method: 'Bank Transfer',
    reference: '',
    notes: '',
  }
  paymentError.value = ''
  paymentDialog.value = true
}

async function savePayment() {
  if (!paymentBill.value) return
  const { valid } = await paymentFormRef.value.validate()
  if (!valid) return
  recording.value = true
  paymentError.value = ''
  try {
    await billsStore.recordPayment({
      supplierId: paymentBill.value.supplierId,
      billId: paymentBill.value.id,
      date: new Date(paymentForm.value.dateStr),
      amount: paymentForm.value.amount,
      method: paymentForm.value.method,
      reference: paymentForm.value.reference,
      notes: paymentForm.value.notes,
    })
    paymentDialog.value = false
  } catch (e: any) {
    paymentError.value = e.message
  } finally {
    recording.value = false
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
