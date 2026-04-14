<template>
  <div>
    <div class="d-flex align-center mb-6">
      <h1 class="text-h4 font-weight-bold">Aging Report</h1>
    </div>

    <v-card elevation="1" class="mb-4">
      <v-tabs v-model="mode" color="primary" grow>
        <v-tab value="receivables">
          <v-icon start>mdi-cash-plus</v-icon>
          Receivables
        </v-tab>
        <v-tab value="payables">
          <v-icon start>mdi-cash-minus</v-icon>
          Payables
        </v-tab>
      </v-tabs>
    </v-card>

    <v-row class="mb-2">
      <v-col cols="12" md="2">
        <v-card elevation="1" class="pa-3">
          <div class="text-caption text-grey">Current</div>
          <div class="text-h6 font-weight-bold">{{ formatCurrency(totals.current, currency) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="1" class="pa-3">
          <div class="text-caption text-grey">1-30 days</div>
          <div class="text-h6 font-weight-bold text-warning">{{ formatCurrency(totals.b30, currency) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="1" class="pa-3">
          <div class="text-caption text-grey">31-60 days</div>
          <div class="text-h6 font-weight-bold text-warning">{{ formatCurrency(totals.b60, currency) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="1" class="pa-3">
          <div class="text-caption text-grey">61-90 days</div>
          <div class="text-h6 font-weight-bold text-error">{{ formatCurrency(totals.b90, currency) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="1" class="pa-3">
          <div class="text-caption text-grey">90+ days</div>
          <div class="text-h6 font-weight-bold text-error">{{ formatCurrency(totals.b90plus, currency) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="1" class="pa-3" :color="mode === 'receivables' ? 'success' : 'error'">
          <div class="text-caption text-white">Total {{ mode === 'receivables' ? 'Owed' : 'Owing' }}</div>
          <div class="text-h6 font-weight-bold text-white">{{ formatCurrency(totals.total, currency) }}</div>
        </v-card>
      </v-col>
    </v-row>

    <v-card elevation="1">
      <v-data-table
        :headers="headers"
        :items="rows"
        :items-per-page="-1"
        hide-default-footer
      >
        <template #item.current="{ item }">{{ formatCurrency(item.current, currency) }}</template>
        <template #item.b30="{ item }">{{ formatCurrency(item.b30, currency) }}</template>
        <template #item.b60="{ item }">{{ formatCurrency(item.b60, currency) }}</template>
        <template #item.b90="{ item }">{{ formatCurrency(item.b90, currency) }}</template>
        <template #item.b90plus="{ item }">{{ formatCurrency(item.b90plus, currency) }}</template>
        <template #item.total="{ item }">
          <strong>{{ formatCurrency(item.total, currency) }}</strong>
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">
            No outstanding {{ mode === 'receivables' ? 'invoices' : 'bills' }}.
          </div>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useInvoicesStore } from '@/stores/invoices'
import { useBillsStore } from '@/stores/bills'
import { useCustomersStore } from '@/stores/customers'
import { useSuppliersStore } from '@/stores/suppliers'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'

const invoicesStore = useInvoicesStore()
const billsStore = useBillsStore()
const customersStore = useCustomersStore()
const suppliersStore = useSuppliersStore()
const orgStore = useOrganizationStore()

const mode = ref<'receivables' | 'payables'>('receivables')
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

interface AgingRow {
  partyId: string
  partyName: string
  current: number
  b30: number
  b60: number
  b90: number
  b90plus: number
  total: number
}

function bucketFor(dueDate: Date): keyof Omit<AgingRow, 'partyId' | 'partyName' | 'total'> {
  const now = new Date()
  const days = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'current'
  if (days <= 30) return 'b30'
  if (days <= 60) return 'b60'
  if (days <= 90) return 'b90'
  return 'b90plus'
}

const rows = computed<AgingRow[]>(() => {
  const map = new Map<string, AgingRow>()
  if (mode.value === 'receivables') {
    for (const inv of invoicesStore.invoices) {
      if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') continue
      if (inv.amountDue <= 0) continue
      const row = map.get(inv.customerId) || {
        partyId: inv.customerId,
        partyName: inv.customerName || customersStore.getCustomer(inv.customerId)?.name || '—',
        current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0,
      }
      const bucket = bucketFor(inv.dueDate)
      row[bucket] += inv.amountDue
      row.total += inv.amountDue
      map.set(inv.customerId, row)
    }
  } else {
    for (const bill of billsStore.bills) {
      if (bill.status === 'paid' || bill.status === 'void' || bill.status === 'draft') continue
      if (bill.amountDue <= 0) continue
      const row = map.get(bill.supplierId) || {
        partyId: bill.supplierId,
        partyName: bill.supplierName || suppliersStore.getSupplier(bill.supplierId)?.name || '—',
        current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0,
      }
      const bucket = bucketFor(bill.dueDate)
      row[bucket] += bill.amountDue
      row.total += bill.amountDue
      map.set(bill.supplierId, row)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
})

const totals = computed(() => {
  const t = { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0 }
  for (const row of rows.value) {
    t.current += row.current
    t.b30 += row.b30
    t.b60 += row.b60
    t.b90 += row.b90
    t.b90plus += row.b90plus
    t.total += row.total
  }
  return t
})

const headers = computed(() => [
  { title: mode.value === 'receivables' ? 'Customer' : 'Supplier', key: 'partyName' },
  { title: 'Current', key: 'current', align: 'end' as const, width: 120 },
  { title: '1-30', key: 'b30', align: 'end' as const, width: 120 },
  { title: '31-60', key: 'b60', align: 'end' as const, width: 120 },
  { title: '61-90', key: 'b90', align: 'end' as const, width: 120 },
  { title: '90+', key: 'b90plus', align: 'end' as const, width: 120 },
  { title: 'Total', key: 'total', align: 'end' as const, width: 140 },
])

onMounted(() => {
  if (orgStore.orgId) {
    invoicesStore.subscribe()
    billsStore.subscribe()
    customersStore.subscribe()
    suppliersStore.subscribe()
  }
})

watch(() => orgStore.orgId, (id) => {
  if (id) {
    invoicesStore.subscribe()
    billsStore.subscribe()
    customersStore.subscribe()
    suppliersStore.subscribe()
  }
})
</script>
