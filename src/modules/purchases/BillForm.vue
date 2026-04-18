<template>
  <div>
    <PageHeader
      :title="editing ? 'Edit Bill' : 'New Bill'"
      :back-to="{ name: 'bills' }"
    />

    <v-card class="mb-4">
      <v-form ref="formRef" @submit.prevent="save('received')">
        <v-card-text class="pa-5">
          <div class="text-subtitle-2 font-weight-bold mb-3">Bill Details</div>
          <v-row>
            <v-col cols="12" md="4">
              <v-select
                v-model="form.supplierId"
                label="Supplier"
                :items="supplierOptions"
                item-title="title"
                item-value="value"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field v-model="form.number" label="Bill #" :rules="[required]" />
            </v-col>
            <v-col cols="6" md="2">
              <v-text-field v-model="form.dateStr" label="Date" type="date" :rules="[required]" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model="form.dueDateStr" label="Due Date" type="date" :rules="[required]" />
            </v-col>
          </v-row>
        </v-card-text>

        <v-divider />

        <v-card-text class="pa-5">
          <div class="text-subtitle-2 font-weight-bold mb-3">Line Items</div>
          <LineItemsEditor v-model="form.lines" :currency="currency" />
        </v-card-text>

        <v-divider />

        <v-card-text class="pa-5">
          <div class="text-subtitle-2 font-weight-bold mb-3">Additional Information</div>
          <v-textarea
            v-model="form.notes"
            label="Notes"
            rows="2"
          />

          <v-alert v-if="error" type="error" variant="tonal" class="mt-4">{{ error }}</v-alert>

          <AuditInfo
            v-if="loadedBill"
            class="mt-4"
            :created-by="loadedBill.createdBy"
            :created-at="loadedBill.createdAt"
            :updated-at="loadedBill.updatedAt"
          />
        </v-card-text>

        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="text" :to="{ name: 'bills' }">Cancel</v-btn>
          <v-btn variant="outlined" :loading="saving" @click="save('draft')">Save Draft</v-btn>
          <v-btn color="primary" :loading="saving" @click="save('received')">Save as Received</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuppliersStore } from '@/stores/suppliers'
import { useBillsStore } from '@/stores/bills'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatDateISO } from '@/utils/date'
import { addDays } from 'date-fns'
import PageHeader from '@/components/common/PageHeader.vue'
import LineItemsEditor from '@/components/common/LineItemsEditor.vue'
import AuditInfo from '@/components/common/AuditInfo.vue'
import type { BillLine, BillStatus, PurchaseInvoice } from '@/types/purchases'

const route = useRoute()
const router = useRouter()
const suppliersStore = useSuppliersStore()
const billsStore = useBillsStore()
const orgStore = useOrganizationStore()

const editing = computed(() => !!route.params.id)
const billId = computed(() => route.params.id as string | undefined)

const formRef = ref()
const saving = ref(false)
const error = ref('')

const form = ref({
  supplierId: '',
  number: '',
  dateStr: formatDateISO(new Date()),
  dueDateStr: formatDateISO(addDays(new Date(), 30)),
  notes: '',
  lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 }] as BillLine[],
})

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const supplierOptions = computed(() =>
  suppliersStore.activeSuppliers.map((s) => ({ title: s.name, value: s.id }))
)

async function save(status: BillStatus) {
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
      dueDate: new Date(form.value.dueDateStr),
      lines,
      notes: form.value.notes,
      status,
    }
    if (editing.value && billId.value) {
      await billsStore.updateBill(billId.value, data)
    } else {
      await billsStore.createBill(data)
    }
    router.push({ name: 'bills' })
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const loadedBill = ref<PurchaseInvoice | null>(null)

function load() {
  if (!billId.value) return
  const bill = billsStore.getBill(billId.value)
  if (!bill) return
  loadedBill.value = bill
  form.value = {
    supplierId: bill.supplierId,
    number: bill.number,
    dateStr: formatDateISO(bill.date),
    dueDateStr: formatDateISO(bill.dueDate),
    notes: bill.notes,
    lines: bill.lines.map((l) => ({ ...l })),
  }
}

onMounted(() => {
  if (orgStore.orgId) {
    suppliersStore.subscribe()
    billsStore.subscribe()
  }
  if (editing.value) {
    load()
  } else {
    setTimeout(() => {
      if (!form.value.number) form.value.number = billsStore.nextBillNumber()
    }, 200)
  }
})

watch(() => billsStore.bills, () => {
  if (editing.value) load()
  else if (!form.value.number) form.value.number = billsStore.nextBillNumber()
})
</script>
