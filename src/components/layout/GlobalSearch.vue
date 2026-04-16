<template>
  <v-menu v-model="open" :close-on-content-click="false" location="bottom">
    <template #activator="{ props }">
      <v-text-field
        v-bind="props"
        v-model="query"
        placeholder="Search..."
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="solo-filled"
        flat
        hide-details
        single-line
        rounded="pill"
        bg-color="surface-variant"
        style="min-width: 220px; max-width: 360px"
        @focus="open = true"
      />
    </template>
    <v-card v-if="query.length >= 2" min-width="380" max-width="460" max-height="420" class="overflow-y-auto" rounded="lg">
      <v-list v-if="hasResults" density="compact">
        <template v-if="customerHits.length">
          <v-list-subheader class="text-uppercase text-caption font-weight-bold">Customers</v-list-subheader>
          <v-list-item
            v-for="c in customerHits"
            :key="`c-${c.id}`"
            prepend-icon="mdi-account-outline"
            :title="c.name"
            :subtitle="c.email"
            :to="{ name: 'customers' }"
            @click="open = false"
          />
        </template>
        <template v-if="supplierHits.length">
          <v-list-subheader class="text-uppercase text-caption font-weight-bold">Suppliers</v-list-subheader>
          <v-list-item
            v-for="s in supplierHits"
            :key="`s-${s.id}`"
            prepend-icon="mdi-truck-outline"
            :title="s.name"
            :subtitle="s.email"
            :to="{ name: 'suppliers' }"
            @click="open = false"
          />
        </template>
        <template v-if="invoiceHits.length">
          <v-list-subheader class="text-uppercase text-caption font-weight-bold">Invoices</v-list-subheader>
          <v-list-item
            v-for="i in invoiceHits"
            :key="`i-${i.id}`"
            prepend-icon="mdi-receipt-text-outline"
            :title="`${i.number} — ${i.customerName}`"
            :subtitle="`${formatCurrency(i.total, currency)} · ${i.status}`"
            :to="{ name: 'invoice-edit', params: { id: i.id } }"
            @click="open = false"
          />
        </template>
        <template v-if="billHits.length">
          <v-list-subheader class="text-uppercase text-caption font-weight-bold">Bills</v-list-subheader>
          <v-list-item
            v-for="b in billHits"
            :key="`b-${b.id}`"
            prepend-icon="mdi-file-document-outline"
            :title="`${b.number} — ${b.supplierName}`"
            :subtitle="`${formatCurrency(b.total, currency)} · ${b.status}`"
            :to="{ name: 'bill-edit', params: { id: b.id } }"
            @click="open = false"
          />
        </template>
        <template v-if="accountHits.length">
          <v-list-subheader class="text-uppercase text-caption font-weight-bold">Accounts</v-list-subheader>
          <v-list-item
            v-for="a in accountHits"
            :key="`a-${a.id}`"
            prepend-icon="mdi-file-tree-outline"
            :title="`${a.code} — ${a.name}`"
            :subtitle="a.type"
            :to="{ name: 'accounts' }"
            @click="open = false"
          />
        </template>
      </v-list>
      <div v-else class="text-center text-medium-emphasis pa-6">
        No results for "{{ query }}"
      </div>
    </v-card>
    <v-card v-else min-width="380" class="pa-4 text-center text-medium-emphasis" rounded="lg">
      Type at least 2 characters to search
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCustomersStore } from '@/stores/customers'
import { useSuppliersStore } from '@/stores/suppliers'
import { useInvoicesStore } from '@/stores/invoices'
import { useBillsStore } from '@/stores/bills'
import { useAccountsStore } from '@/stores/accounts'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'

const customersStore = useCustomersStore()
const suppliersStore = useSuppliersStore()
const invoicesStore = useInvoicesStore()
const billsStore = useBillsStore()
const accountsStore = useAccountsStore()
const orgStore = useOrganizationStore()

const open = ref(false)
const query = ref('')

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

function match(text: string, q: string): boolean {
  return text.toLowerCase().includes(q.toLowerCase())
}

const customerHits = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (q.length < 2) return []
  return customersStore.customers.filter((c) => match(c.name, q) || match(c.email, q) || match(c.phone, q)).slice(0, 5)
})

const supplierHits = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (q.length < 2) return []
  return suppliersStore.suppliers.filter((s) => match(s.name, q) || match(s.email, q) || match(s.phone, q)).slice(0, 5)
})

const invoiceHits = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (q.length < 2) return []
  return invoicesStore.invoices.filter((i) => match(i.number, q) || match(i.customerName || '', q) || match(i.notes, q)).slice(0, 5)
})

const billHits = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (q.length < 2) return []
  return billsStore.bills.filter((b) => match(b.number, q) || match(b.supplierName || '', q) || match(b.notes, q)).slice(0, 5)
})

const accountHits = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (q.length < 2) return []
  return accountsStore.accounts.filter((a) => match(a.name, q) || match(a.code, q)).slice(0, 5)
})

const hasResults = computed(() =>
  customerHits.value.length + supplierHits.value.length + invoiceHits.value.length + billHits.value.length + accountHits.value.length > 0
)
</script>
