<template>
  <div>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-left" variant="text" :to="{ name: 'invoices' }" />
      <h1 class="text-h4 font-weight-bold ml-2">
        {{ editing ? 'Edit Invoice' : 'New Invoice' }}
      </h1>
    </div>

    <v-card elevation="1">
      <v-form ref="formRef" @submit.prevent="save('sent')">
        <v-card-text>
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
              <v-text-field v-model="form.number" label="Invoice #" :rules="[required]" />
            </v-col>
            <v-col cols="6" md="2">
              <v-text-field v-model="form.dateStr" label="Date" type="date" :rules="[required]" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model="form.dueDateStr" label="Due Date" type="date" :rules="[required]" />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <LineItemsEditor v-model="form.lines" :currency="currency" />

          <v-textarea
            v-model="form.notes"
            label="Notes"
            rows="2"
            variant="outlined"
            density="comfortable"
            class="mt-4"
          />

          <v-alert v-if="error" type="error" variant="tonal" class="mt-4">{{ error }}</v-alert>

          <AuditInfo
            v-if="loadedInvoice"
            class="mt-4"
            :created-by="loadedInvoice.createdBy"
            :created-at="loadedInvoice.createdAt"
            :updated-at="loadedInvoice.updatedAt"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" :to="{ name: 'invoices' }">Cancel</v-btn>
          <v-btn variant="outlined" :loading="saving" @click="save('draft')">Save as Draft</v-btn>
          <v-btn color="primary" :loading="saving" @click="save('sent')">Save &amp; Send</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCustomersStore } from '@/stores/customers'
import { useInvoicesStore } from '@/stores/invoices'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatDateISO } from '@/utils/date'
import { addDays } from 'date-fns'
import LineItemsEditor from '@/components/common/LineItemsEditor.vue'
import AuditInfo from '@/components/common/AuditInfo.vue'
import type { InvoiceLine, InvoiceStatus, SalesInvoice } from '@/types/sales'

const route = useRoute()
const router = useRouter()
const customersStore = useCustomersStore()
const invoicesStore = useInvoicesStore()
const orgStore = useOrganizationStore()

const editing = computed(() => !!route.params.id)
const invoiceId = computed(() => route.params.id as string | undefined)

const formRef = ref()
const saving = ref(false)
const error = ref('')

const form = ref({
  customerId: '',
  number: '',
  dateStr: formatDateISO(new Date()),
  dueDateStr: formatDateISO(addDays(new Date(), 30)),
  notes: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }] as InvoiceLine[],
})

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const customerOptions = computed(() =>
  customersStore.activeCustomers.map((c) => ({ title: c.name, value: c.id }))
)

async function save(status: InvoiceStatus) {
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
      dueDate: new Date(form.value.dueDateStr),
      lines,
      notes: form.value.notes,
      status,
    }
    if (editing.value && invoiceId.value) {
      await invoicesStore.updateInvoice(invoiceId.value, data)
    } else {
      await invoicesStore.createInvoice(data)
    }
    router.push({ name: 'invoices' })
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const loadedInvoice = ref<SalesInvoice | null>(null)

function load() {
  if (!invoiceId.value) return
  const inv = invoicesStore.getInvoice(invoiceId.value)
  if (!inv) return
  loadedInvoice.value = inv
  form.value = {
    customerId: inv.customerId,
    number: inv.number,
    dateStr: formatDateISO(inv.date),
    dueDateStr: formatDateISO(inv.dueDate),
    notes: inv.notes,
    lines: inv.lines.map((l) => ({ ...l })),
  }
}

onMounted(() => {
  if (orgStore.orgId) {
    customersStore.subscribe()
    invoicesStore.subscribe()
  }
  if (editing.value) {
    load()
  } else {
    // Auto-generate invoice number
    setTimeout(() => {
      if (!form.value.number) form.value.number = invoicesStore.nextInvoiceNumber()
    }, 200)
  }
})

watch(() => invoicesStore.invoices, () => {
  if (editing.value) load()
  else if (!form.value.number) form.value.number = invoicesStore.nextInvoiceNumber()
})
</script>
