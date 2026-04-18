<template>
  <v-navigation-drawer
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :permanent="mdAndUp"
    :temporary="!mdAndUp"
    width="260"
    class="sidebar"
  >
    <!-- Logo header -->
    <div class="sidebar-header">
      <div class="d-flex align-center pa-4">
        <img src="/favicon.svg" alt="Vent" width="32" height="32" class="mr-3" />
        <div>
          <div class="text-subtitle-1 font-weight-bold">Vent</div>
          <div class="text-caption text-medium-emphasis" style="line-height: 1.2">{{ orgName }}</div>
        </div>
      </div>
    </div>

    <v-divider />

    <v-list density="compact" nav class="px-2 py-2">
      <!-- Dashboard -->
      <v-list-item
        prepend-icon="mdi-view-dashboard-outline"
        title="Dashboard"
        :to="{ name: 'dashboard' }"
        class="mb-1"
        active-class="sidebar-active"
      />

      <!-- Accounting -->
      <v-list-group value="accounting">
        <template #activator="{ props }">
          <v-list-item v-bind="props" prepend-icon="mdi-book-open-page-variant-outline" title="Accounting" active-class="sidebar-active" />
        </template>
        <v-list-item title="Chart of Accounts" :to="{ name: 'accounts' }" active-class="sidebar-active" />
        <v-list-item title="Journal Entries" :to="{ name: 'journal-entries' }" active-class="sidebar-active" />
        <v-list-item title="General Ledger" :to="{ name: 'general-ledger' }" active-class="sidebar-active" />
      </v-list-group>

      <!-- Sales -->
      <v-list-group value="sales">
        <template #activator="{ props }">
          <v-list-item v-bind="props" prepend-icon="mdi-receipt-text-outline" title="Sales" active-class="sidebar-active" />
        </template>
        <v-list-item title="Customers" :to="{ name: 'customers' }" active-class="sidebar-active" />
        <v-list-item title="Invoices" :to="{ name: 'invoices' }" active-class="sidebar-active" />
        <v-list-item title="Quotes" :to="{ name: 'quotes' }" active-class="sidebar-active" />
        <v-list-item title="Credit Notes" :to="{ name: 'credit-notes' }" active-class="sidebar-active" />
      </v-list-group>

      <!-- Purchases -->
      <v-list-group value="purchases">
        <template #activator="{ props }">
          <v-list-item v-bind="props" prepend-icon="mdi-cart-outline" title="Purchases" active-class="sidebar-active" />
        </template>
        <v-list-item title="Suppliers" :to="{ name: 'suppliers' }" active-class="sidebar-active" />
        <v-list-item title="Bills" :to="{ name: 'bills' }" active-class="sidebar-active" />
        <v-list-item title="Purchase Orders" :to="{ name: 'purchase-orders' }" active-class="sidebar-active" />
        <v-list-item title="Debit Notes" :to="{ name: 'debit-notes' }" active-class="sidebar-active" />
      </v-list-group>

      <!-- Banking -->
      <v-list-group value="banking">
        <template #activator="{ props }">
          <v-list-item v-bind="props" prepend-icon="mdi-bank-outline" title="Banking" active-class="sidebar-active" />
        </template>
        <v-list-item title="Bank Accounts" :to="{ name: 'bank-accounts' }" active-class="sidebar-active" />
        <v-list-item title="Reconciliation" :to="{ name: 'reconciliation' }" active-class="sidebar-active" />
      </v-list-group>

      <!-- Reports -->
      <v-list-group value="reports">
        <template #activator="{ props }">
          <v-list-item v-bind="props" prepend-icon="mdi-chart-box-outline" title="Reports" active-class="sidebar-active" />
        </template>
        <v-list-item title="Profit & Loss" :to="{ name: 'profit-loss' }" active-class="sidebar-active" />
        <v-list-item title="Balance Sheet" :to="{ name: 'balance-sheet' }" active-class="sidebar-active" />
        <v-list-item title="Trial Balance" :to="{ name: 'trial-balance' }" active-class="sidebar-active" />
        <v-list-item title="Aging Report" :to="{ name: 'aging' }" active-class="sidebar-active" />
      </v-list-group>
    </v-list>

    <template #append>
      <v-divider />
      <v-list density="compact" nav class="px-2 py-2">
        <v-list-item
          prepend-icon="mdi-cog-outline"
          title="Settings"
          :to="{ name: 'settings' }"
          active-class="sidebar-active"
        />
        <v-list-item
          prepend-icon="mdi-account-group-outline"
          title="Users"
          :to="{ name: 'users' }"
          active-class="sidebar-active"
        />
        <v-list-item
          v-if="isOwnerOrAdmin"
          prepend-icon="mdi-stethoscope"
          title="Diagnostics"
          :to="{ name: 'diagnostics' }"
          active-class="sidebar-active"
        />
        <v-list-item
          v-if="isSuperAdmin"
          prepend-icon="mdi-shield-crown-outline"
          title="Super Admin"
          :to="{ name: 'admin' }"
          active-class="sidebar-active"
          class="text-error"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useOrganizationStore } from '@/stores/organization'
import { useAuthStore } from '@/stores/auth'

defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { mdAndUp } = useDisplay()
const orgStore = useOrganizationStore()
const authStore = useAuthStore()
const orgName = computed(() => orgStore.orgName || 'No organization')
const isOwnerOrAdmin = computed(() => orgStore.myRole === 'owner' || orgStore.myRole === 'admin')
const isSuperAdmin = computed(() => authStore.isSuperAdmin)
</script>

<style scoped>
.sidebar {
  border-right: 1px solid rgb(var(--v-theme-on-surface), 0.08) !important;
}

.sidebar-header {
  min-height: 64px;
  display: flex;
  align-items: center;
}

:deep(.sidebar-active) {
  background: rgb(var(--v-theme-primary), 0.08) !important;
  color: rgb(var(--v-theme-primary)) !important;
  border-left: 3px solid rgb(var(--v-theme-primary));
}

:deep(.v-list-group__items .v-list-item) {
  padding-inline-start: 56px !important;
  min-height: 36px;
}
</style>
