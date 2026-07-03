<template>
  <div class="tax-summary-report">
    <PageHeader title="Tax Summary">
      <template #actions>
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

    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <v-btn-toggle v-model="period" mandatory density="compact" rounded="lg" variant="outlined">
        <v-btn value="month" size="small">This Month</v-btn>
        <v-btn value="quarter" size="small">Quarter</v-btn>
        <v-btn value="year" size="small">YTD</v-btn>
        <v-btn value="custom" size="small">Custom</v-btn>
      </v-btn-toggle>
      <template v-if="period === 'custom'">
        <v-text-field v-model="fromDate" type="date" label="From" density="compact" hide-details style="max-width: 160px" />
        <v-text-field v-model="toDate" type="date" label="To" density="compact" hide-details style="max-width: 160px" />
      </template>
    </div>

    <v-card class="mb-4">
      <v-card-text class="pa-5">
        <p class="text-body-2 text-medium-emphasis mb-4">
          Tax collected on sales (output) less tax paid on purchases (input), by tax account, for the selected period.
          A positive net is payable to the revenue authority.
        </p>
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Tax Account</th>
              <th class="text-end">Collected (Output)</th>
              <th class="text-end">Paid (Input)</th>
              <th class="text-end">Net Payable</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.accountId">
              <td>{{ row.code }} — {{ row.name }}</td>
              <td class="text-end">{{ formatCurrency(row.collected, currency) }}</td>
              <td class="text-end">{{ formatCurrency(row.paid, currency) }}</td>
              <td class="text-end font-weight-medium">{{ formatCurrency(row.net, currency) }}</td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="4" class="text-center text-grey py-6">No tax activity in this period.</td>
            </tr>
          </tbody>
          <tfoot v-if="rows.length > 0">
            <tr class="font-weight-bold">
              <td>Total</td>
              <td class="text-end">{{ formatCurrency(totalCollected, currency) }}</td>
              <td class="text-end">{{ formatCurrency(totalPaid, currency) }}</td>
              <td class="text-end">{{ formatCurrency(totalNet, currency) }}</td>
            </tr>
          </tfoot>
        </v-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useTaxStore } from '@/stores/tax'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'
import { round2 } from '@/utils/accounting'
import { formatDate, formatDateISO, startOfLocalDay, endOfLocalDay } from '@/utils/date'
import { startOfYear, startOfMonth, startOfQuarter } from 'date-fns'
import { exportTableReportPDF, reportAmount } from '@/utils/pdf'
import PageHeader from '@/components/common/PageHeader.vue'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const taxStore = useTaxStore()
const orgStore = useOrganizationStore()

const period = ref('year')
const fromDate = ref(formatDateISO(startOfYear(new Date())))
const toDate = ref(formatDateISO(new Date()))

watch(period, (val) => {
  const now = new Date()
  if (val === 'month') {
    fromDate.value = formatDateISO(startOfMonth(now))
    toDate.value = formatDateISO(now)
  } else if (val === 'quarter') {
    fromDate.value = formatDateISO(startOfQuarter(now))
    toDate.value = formatDateISO(now)
  } else if (val === 'year') {
    fromDate.value = formatDateISO(startOfYear(now))
    toDate.value = formatDateISO(now)
  }
})

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

// The set of tax liability accounts: everything referenced by a tax code, plus the
// tagged VAT/Tax Payable control account.
const taxAccountIds = computed(() => {
  const ids = new Set<string>()
  for (const code of taxStore.taxCodes) {
    for (const c of code.components) if (c.accountId) ids.add(c.accountId)
  }
  const vat = accountsStore.getSystemAccount('tax_payable')?.id
  if (vat) ids.add(vat)
  return ids
})

interface Row {
  accountId: string
  code: string
  name: string
  collected: number
  paid: number
  net: number
}

const rows = computed<Row[]>(() => {
  const from = startOfLocalDay(fromDate.value)
  const to = endOfLocalDay(toDate.value)
  const out: Row[] = []
  for (const accountId of taxAccountIds.value) {
    const account = accountsStore.getAccount(accountId)
    if (!account) continue
    let credits = 0
    let debits = 0
    for (const entry of transactionsStore.postedEntries) {
      if (entry.date < from || entry.date > to) continue
      for (const line of entry.lines) {
        if (line.accountId === accountId) {
          credits += line.credit || 0
          debits += line.debit || 0
        }
      }
    }
    const collected = round2(credits)
    const paid = round2(debits)
    if (collected === 0 && paid === 0) continue
    out.push({
      accountId,
      code: account.code,
      name: account.name,
      collected,
      paid,
      net: round2(collected - paid),
    })
  }
  return out.sort((a, b) => a.code.localeCompare(b.code))
})

const totalCollected = computed(() => round2(rows.value.reduce((s, r) => s + r.collected, 0)))
const totalPaid = computed(() => round2(rows.value.reduce((s, r) => s + r.paid, 0)))
const totalNet = computed(() => round2(rows.value.reduce((s, r) => s + r.net, 0)))

function downloadPdf() {
  const org = orgStore.currentOrg
  if (!org) return
  exportTableReportPDF({
    org,
    currency: currency.value,
    title: 'Tax Summary',
    periodLabel: `For the period ${formatDate(startOfLocalDay(fromDate.value))} – ${formatDate(startOfLocalDay(toDate.value))}`,
    head: [['Tax Account', 'Collected (Output)', 'Paid (Input)', 'Net Payable']],
    body: rows.value.map((r) => [
      `${r.code} — ${r.name}`,
      reportAmount(r.collected),
      reportAmount(r.paid),
      reportAmount(r.net),
    ]),
    foot: [['Total', reportAmount(totalCollected.value), reportAmount(totalPaid.value), reportAmount(totalNet.value)]],
    aligns: ['left', 'right', 'right', 'right'],
    filename: `Tax Summary — ${fromDate.value} to ${toDate.value}.pdf`,
  })
}

function subscribeAll() {
  if (!orgStore.orgId) return
  accountsStore.subscribe()
  transactionsStore.subscribe()
  taxStore.subscribe()
}

onMounted(subscribeAll)
watch(() => orgStore.orgId, (id) => id && subscribeAll())
</script>

<style scoped>
@media print {
  .v-navigation-drawer,
  .v-app-bar,
  .v-btn-toggle {
    display: none !important;
  }
  .tax-summary-report {
    padding: 0;
  }
}
</style>
