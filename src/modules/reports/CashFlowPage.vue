<template>
  <div class="cash-flow-report">
    <PageHeader title="Cash Flow Statement">
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
          Movement in cash &amp; cash equivalents over the period, derived from the change in
          every other account (direct method). Inflows are positive; outflows are shown in
          parentheses.
        </p>

        <v-table density="comfortable">
          <tbody>
            <template v-for="group in groups" :key="group.key">
              <tr>
                <td class="text-subtitle-2 font-weight-bold pt-4">{{ group.label }}</td>
                <td></td>
              </tr>
              <tr v-for="row in group.rows" :key="row.accountId">
                <td class="ps-6">{{ row.code }} — {{ row.name }}</td>
                <td class="text-end">{{ formatCurrency(row.amount, currency) }}</td>
              </tr>
              <tr v-if="group.rows.length === 0">
                <td class="ps-6 text-grey">No activity</td>
                <td class="text-end text-grey">—</td>
              </tr>
              <tr class="font-weight-medium">
                <td class="ps-6">Net cash from {{ group.label.toLowerCase() }}</td>
                <td class="text-end">{{ formatCurrency(group.total, currency) }}</td>
              </tr>
            </template>

            <tr class="font-weight-bold">
              <td class="pt-4">Net increase (decrease) in cash</td>
              <td class="text-end pt-4">{{ formatCurrency(netChange, currency) }}</td>
            </tr>
            <tr>
              <td>Cash at the beginning of the period</td>
              <td class="text-end">{{ formatCurrency(openingCash, currency) }}</td>
            </tr>
            <tr class="font-weight-bold">
              <td>Cash at the end of the period</td>
              <td class="text-end">{{ formatCurrency(closingCash, currency) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-alert
          v-if="!reconciled"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-4"
        >
          Statement does not tie to the cash ledger by
          {{ formatCurrency(Math.abs(closingCash - actualClosingCash), currency) }}.
          This usually means a cash/bank account isn't tagged as cash — check that your
          bank accounts are linked to their GL accounts, or that the 'Bank Account' has
          its system tag.
        </v-alert>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useBankingStore } from '@/stores/banking'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'
import { round2 } from '@/utils/accounting'
import { formatDate } from '@/utils/date'
import { formatDateISO, startOfLocalDay, endOfLocalDay } from '@/utils/date'
import { startOfYear, startOfMonth, startOfQuarter } from 'date-fns'
import { exportStatementPDF, type StatementRow } from '@/utils/pdf'
import type { Account } from '@/types/accounting'
import PageHeader from '@/components/common/PageHeader.vue'

const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const bankingStore = useBankingStore()
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

const from = computed(() => startOfLocalDay(fromDate.value))
const to = computed(() => endOfLocalDay(toDate.value))
// Opening cash = balance of cash accounts on all entries BEFORE the period starts.
const openingAsOf = computed(() => new Date(from.value.getTime() - 1))

// GL accounts that banking has linked to a real bank account.
const bankGlAccountIds = computed(() => {
  const ids = new Set<string>()
  for (const a of bankingStore.accounts) if (a.glAccountId) ids.add(a.glAccountId)
  return ids
})

/**
 * Cash & cash equivalents: an asset account that is either tagged as the system
 * 'bank' account, linked from a bank account in the Banking module, or sits in the
 * reserved cash band (codes 1000–1099) of the seeded chart of accounts.
 */
function isCashAccount(account: Account): boolean {
  if (account.type !== 'asset') return false
  if (account.systemType === 'bank') return true
  if (bankGlAccountIds.value.has(account.id)) return true
  const code = parseInt(account.code, 10)
  if (!Number.isNaN(code) && code >= 1000 && code < 1100) return true
  return false
}

/** Classify a non-cash account into a cash-flow activity group. */
function groupOf(account: Account): 'operating' | 'investing' | 'financing' {
  if (account.type === 'revenue' || account.type === 'expense') return 'operating'
  if (account.type === 'equity') return 'financing'
  if (account.type === 'asset') {
    if (account.systemType === 'accounts_receivable') return 'operating'
    // In the seeded chart, non-current/fixed assets band from 1400 upward.
    const code = parseInt(account.code, 10)
    if (!Number.isNaN(code) && code >= 1400) return 'investing'
    return 'operating'
  }
  // Liabilities here (AP, tax, levies, accruals) are current/operating by default.
  return 'operating'
}

interface CashFlowRow {
  accountId: string
  code: string
  name: string
  amount: number
}

// Per-account cash effect within the period: credits − debits posted to the
// account. Summed across ALL non-cash accounts this equals the actual change in
// cash (the trial balance nets to zero), so the statement always ties out.
const rows = computed<CashFlowRow[]>(() => {
  const out: CashFlowRow[] = []
  for (const account of accountsStore.accounts) {
    if (isCashAccount(account)) continue
    let debits = 0
    let credits = 0
    for (const entry of transactionsStore.postedEntries) {
      if (entry.date < from.value || entry.date > to.value) continue
      for (const line of entry.lines) {
        if (line.accountId === account.id) {
          debits += line.debit || 0
          credits += line.credit || 0
        }
      }
    }
    const amount = round2(credits - debits)
    if (Math.abs(amount) < 0.005) continue
    out.push({ accountId: account.id, code: account.code, name: account.name, amount })
  }
  return out.sort((a, b) => a.code.localeCompare(b.code))
})

const GROUP_META = [
  { key: 'operating', label: 'Operating activities' },
  { key: 'investing', label: 'Investing activities' },
  { key: 'financing', label: 'Financing activities' },
] as const

const groups = computed(() =>
  GROUP_META.map((g) => {
    const groupRows = rows.value.filter((r) => {
      const acc = accountsStore.getAccount(r.accountId)
      return acc && groupOf(acc) === g.key
    })
    const total = round2(groupRows.reduce((s, r) => s + r.amount, 0))
    return { ...g, rows: groupRows, total }
  })
)

const netChange = computed(() => round2(groups.value.reduce((s, g) => s + g.total, 0)))

const cashAccounts = computed(() => accountsStore.accounts.filter(isCashAccount))

const openingCash = computed(() =>
  round2(
    cashAccounts.value.reduce(
      (s, a) => s + transactionsStore.getAccountBalance(a.id, openingAsOf.value),
      0
    )
  )
)

// Presented closing cash is opening + the movement shown above, so the statement
// is internally consistent by construction.
const closingCash = computed(() => round2(openingCash.value + netChange.value))

// Independently-computed closing cash straight from the ledger — used only to flag
// a misconfigured cash-account set.
const actualClosingCash = computed(() =>
  round2(
    cashAccounts.value.reduce(
      (s, a) => s + transactionsStore.getAccountBalance(a.id, to.value),
      0
    )
  )
)

const reconciled = computed(() => Math.abs(closingCash.value - actualClosingCash.value) < 0.005)

function downloadPdf() {
  const org = orgStore.currentOrg
  if (!org) return

  const statementRows: StatementRow[] = []
  for (const g of groups.value) {
    statementRows.push({ kind: 'heading', label: g.label })
    if (g.rows.length === 0) {
      statementRows.push({ kind: 'line', label: 'No activity', value: 0, indent: true })
    } else {
      for (const r of g.rows) {
        statementRows.push({ kind: 'line', label: `${r.code} — ${r.name}`, value: r.amount, indent: true })
      }
    }
    statementRows.push({ kind: 'subtotal', label: `Net cash from ${g.label.toLowerCase()}`, value: g.total })
    statementRows.push({ kind: 'spacer' })
  }
  statementRows.push({ kind: 'total', label: 'Net increase (decrease) in cash', value: netChange.value })
  statementRows.push({ kind: 'line', label: 'Cash at the beginning of the period', value: openingCash.value })
  statementRows.push({ kind: 'subtotal', label: 'Cash at the end of the period', value: closingCash.value })

  exportStatementPDF({
    org,
    currency: currency.value,
    title: 'Cash Flow Statement',
    periodLabel: `For the period ${formatDate(from.value)} – ${formatDate(to.value)}`,
    basisLabel: 'Direct method',
    rows: statementRows,
    filename: `Cash Flow Statement — ${fromDate.value} to ${toDate.value}.pdf`,
  })
}

function subscribeAll() {
  if (!orgStore.orgId) return
  accountsStore.subscribe()
  transactionsStore.subscribe()
  bankingStore.subscribe()
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
  .cash-flow-report {
    padding: 0;
  }
}
</style>
