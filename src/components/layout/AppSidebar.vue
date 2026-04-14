<template>
  <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
    <v-list-item
      :prepend-icon="rail ? 'mdi-cash-register' : undefined"
      class="pa-4"
    >
      <template v-if="!rail">
        <v-list-item-title class="text-h6 font-weight-bold">Vent</v-list-item-title>
        <v-list-item-subtitle>{{ orgName }}</v-list-item-subtitle>
      </template>
      <template #append>
        <v-btn variant="text" :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'" @click="rail = !rail" />
      </template>
    </v-list-item>

    <v-divider />

    <v-list density="compact" nav>
      <v-list-item
        prepend-icon="mdi-view-dashboard"
        title="Dashboard"
        :to="{ name: 'dashboard' }"
      />

      <v-list-subheader v-if="!rail">ACCOUNTING</v-list-subheader>
      <v-list-item prepend-icon="mdi-file-tree" title="Chart of Accounts" :to="{ name: 'accounts' }" />
      <v-list-item prepend-icon="mdi-book-open-variant" title="Journal Entries" :to="{ name: 'journal-entries' }" />
      <v-list-item prepend-icon="mdi-format-list-numbered" title="General Ledger" :to="{ name: 'general-ledger' }" />

      <v-list-subheader v-if="!rail">SALES</v-list-subheader>
      <v-list-item prepend-icon="mdi-account-group" title="Customers" :to="{ name: 'customers' }" />
      <v-list-item prepend-icon="mdi-receipt-text" title="Invoices" :to="{ name: 'invoices' }" />
      <v-list-item prepend-icon="mdi-file-document-edit" title="Quotes" :to="{ name: 'quotes' }" />
      <v-list-item prepend-icon="mdi-credit-card-refund" title="Credit Notes" :to="{ name: 'credit-notes' }" />

      <v-list-subheader v-if="!rail">PURCHASES</v-list-subheader>
      <v-list-item prepend-icon="mdi-truck" title="Suppliers" :to="{ name: 'suppliers' }" />
      <v-list-item prepend-icon="mdi-file-document" title="Bills" :to="{ name: 'bills' }" />
      <v-list-item prepend-icon="mdi-clipboard-list" title="Purchase Orders" :to="{ name: 'purchase-orders' }" />
      <v-list-item prepend-icon="mdi-file-undo" title="Debit Notes" :to="{ name: 'debit-notes' }" />

      <v-list-subheader v-if="!rail">BANKING</v-list-subheader>
      <v-list-item prepend-icon="mdi-bank" title="Bank Accounts" :to="{ name: 'bank-accounts' }" />
      <v-list-item prepend-icon="mdi-scale-balance" title="Reconciliation" :to="{ name: 'reconciliation' }" />

      <v-list-subheader v-if="!rail">REPORTS</v-list-subheader>
      <v-list-item prepend-icon="mdi-chart-line" title="Profit & Loss" :to="{ name: 'profit-loss' }" />
      <v-list-item prepend-icon="mdi-chart-bar" title="Balance Sheet" :to="{ name: 'balance-sheet' }" />
      <v-list-item prepend-icon="mdi-table" title="Trial Balance" :to="{ name: 'trial-balance' }" />
      <v-list-item prepend-icon="mdi-clock-alert" title="Aging Report" :to="{ name: 'aging' }" />

      <v-divider class="my-2" />

      <v-list-item prepend-icon="mdi-cog" title="Settings" :to="{ name: 'settings' }" />
      <v-list-item prepend-icon="mdi-account-multiple" title="Users" :to="{ name: 'users' }" />
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOrganizationStore } from '@/stores/organization'

const orgStore = useOrganizationStore()
const orgName = computed(() => orgStore.orgName)

const drawer = ref(true)
const rail = ref(false)
</script>
