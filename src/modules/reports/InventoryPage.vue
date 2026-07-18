<template>
  <div class="inventory-report">
    <PageHeader title="Inventory">
      <template #actions>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-refresh"
          :loading="recalculating"
          class="me-2"
          @click="recalculate"
        >
          Recalculate stock
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          prepend-icon="mdi-file-pdf-box"
          @click="downloadPdf"
        >
          Download PDF
        </v-btn>
      </template>
    </PageHeader>

    <v-row class="mb-2">
      <v-col cols="12" md="4">
        <v-card class="pa-4">
          <div class="text-caption text-grey">Items in stock</div>
          <div class="text-h5 font-weight-bold">{{ itemsInStock }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4">
          <div class="text-caption text-grey">Total units</div>
          <div class="text-h5 font-weight-bold">{{ formatNumber(totalUnits, 0) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4" color="primary">
          <div class="text-caption text-white">Total stock value</div>
          <div class="text-h5 font-weight-bold text-white">{{ formatCurrency(totalValue, currency) }}</div>
        </v-card>
      </v-col>
    </v-row>

    <v-card>
      <v-data-table
        :headers="headers"
        :items="rows"
        :items-per-page="-1"
        hide-default-footer
      >
        <template #item.qtyOnHand="{ item }">{{ formatNumber(item.qtyOnHand, 2) }}</template>
        <template #item.avgCost="{ item }">{{ formatCurrency(item.avgCost, currency) }}</template>
        <template #item.stockValue="{ item }">{{ formatCurrency(item.stockValue, currency) }}</template>
        <template #body.append>
          <tr class="font-weight-bold bg-grey-lighten-4">
            <td colspan="3">Total</td>
            <td class="text-end">{{ formatCurrency(totalValue, currency) }}</td>
          </tr>
        </template>
        <template #no-data>
          <div class="text-center pa-8 text-grey">
            No inventory items yet. Add an item of type "Inventory" under Products &amp; Services.
          </div>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/plugins/firebase'
import { useItemsStore } from '@/stores/items'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency, formatNumber } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import { exportTableReportPDF, reportAmount } from '@/utils/pdf'
import { useToast } from '@/composables/useToast'
import PageHeader from '@/components/common/PageHeader.vue'

const itemsStore = useItemsStore()
const orgStore = useOrganizationStore()
const toast = useToast()

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const rows = computed(() =>
  itemsStore.inventoryItems
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
)

const itemsInStock = computed(() => rows.value.filter((r) => (r.qtyOnHand || 0) > 0).length)
const totalUnits = computed(() => rows.value.reduce((s, r) => s + (r.qtyOnHand || 0), 0))
const totalValue = computed(() => rows.value.reduce((s, r) => s + (r.stockValue || 0), 0))

const headers = [
  { title: 'SKU', key: 'sku', width: 120 },
  { title: 'Item', key: 'name' },
  { title: 'On Hand', key: 'qtyOnHand', align: 'end' as const, width: 120 },
  { title: 'Avg Cost', key: 'avgCost', align: 'end' as const, width: 140 },
  { title: 'Stock Value', key: 'stockValue', align: 'end' as const, width: 160 },
]

const recalculating = ref(false)
async function recalculate() {
  if (!orgStore.orgId) return
  recalculating.value = true
  try {
    await httpsCallable(functions, 'recalcInventory')({ orgId: orgStore.orgId })
    toast.success('Stock recalculated')
  } catch (e: any) {
    toast.error(e.message || 'Failed to recalculate stock')
  } finally {
    recalculating.value = false
  }
}

function downloadPdf() {
  const org = orgStore.currentOrg
  if (!org) return
  exportTableReportPDF({
    org,
    currency: currency.value,
    title: 'Inventory',
    periodLabel: `As at ${formatDate(new Date())}`,
    head: [['SKU', 'Item', 'On Hand', 'Avg Cost', 'Stock Value']],
    body: rows.value.map((r) => [
      r.sku || '',
      r.name,
      formatNumber(r.qtyOnHand || 0, 2),
      reportAmount(r.avgCost || 0),
      reportAmount(r.stockValue || 0),
    ]),
    foot: [['', 'Total', '', '', reportAmount(totalValue.value)]],
    aligns: ['left', 'left', 'right', 'right', 'right'],
    filename: `Inventory — ${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`,
  })
}

function subscribeAll() {
  if (!orgStore.orgId) return
  itemsStore.subscribe()
}

onMounted(subscribeAll)
watch(() => orgStore.orgId, (id) => id && subscribeAll())
</script>

<style scoped>
@media print {
  .v-navigation-drawer,
  .v-app-bar {
    display: none !important;
  }
  .inventory-report {
    padding: 0;
  }
}
</style>
