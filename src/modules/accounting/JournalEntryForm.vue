<template>
  <div>
    <div class="d-flex align-center mb-6">
      <v-btn icon="mdi-arrow-left" variant="text" :to="{ name: 'journal-entries' }" />
      <h1 class="text-h4 font-weight-bold ml-2">
        {{ editing ? 'Edit Journal Entry' : 'New Journal Entry' }}
      </h1>
    </div>

    <v-card elevation="1">
      <v-form ref="formRef" @submit.prevent="save('posted')">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="form.dateStr"
                label="Date"
                type="date"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field v-model="form.reference" label="Reference" placeholder="JE-001" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.memo" label="Memo / Description" />
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <div class="d-flex align-center mb-2">
            <h3 class="text-subtitle-1 font-weight-bold">Lines</h3>
            <v-spacer />
            <v-btn size="small" prepend-icon="mdi-plus" variant="tonal" @click="addLine">
              Add Line
            </v-btn>
          </div>

          <v-table density="comfortable">
            <thead>
              <tr>
                <th style="width: 35%">Account</th>
                <th>Description</th>
                <th class="text-end" style="width: 140px">Debit</th>
                <th class="text-end" style="width: 140px">Credit</th>
                <th style="width: 50px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(line, idx) in form.lines" :key="idx">
                <td>
                  <v-select
                    v-model="line.accountId"
                    :items="accountOptions"
                    item-title="title"
                    item-value="value"
                    density="compact"
                    variant="outlined"
                    hide-details
                    placeholder="Select account"
                  />
                </td>
                <td>
                  <v-text-field
                    v-model="line.description"
                    density="compact"
                    variant="outlined"
                    hide-details
                    placeholder="Description"
                  />
                </td>
                <td>
                  <v-text-field
                    v-model.number="line.debit"
                    type="number"
                    density="compact"
                    variant="outlined"
                    hide-details
                    min="0"
                    step="0.01"
                    class="text-end"
                    @update:model-value="onDebitChange(idx)"
                  />
                </td>
                <td>
                  <v-text-field
                    v-model.number="line.credit"
                    type="number"
                    density="compact"
                    variant="outlined"
                    hide-details
                    min="0"
                    step="0.01"
                    @update:model-value="onCreditChange(idx)"
                  />
                </td>
                <td class="text-center">
                  <v-btn
                    icon="mdi-close"
                    size="x-small"
                    variant="text"
                    :disabled="form.lines.length <= 2"
                    @click="removeLine(idx)"
                  />
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="font-weight-bold">
                <td colspan="2" class="text-end">Totals</td>
                <td class="text-end">{{ formatCurrency(totalDebitsValue, currency) }}</td>
                <td class="text-end">{{ formatCurrency(totalCreditsValue, currency) }}</td>
                <td></td>
              </tr>
              <tr v-if="!balanced">
                <td colspan="5">
                  <v-alert type="warning" variant="tonal" density="compact" class="mb-0">
                    Out of balance by {{ formatCurrency(Math.abs(totalDebitsValue - totalCreditsValue), currency) }}
                  </v-alert>
                </td>
              </tr>
            </tfoot>
          </v-table>

          <v-alert v-if="error" type="error" variant="tonal" class="mt-4">{{ error }}</v-alert>

          <AuditInfo
            v-if="loadedEntry"
            class="mt-4"
            :created-by="loadedEntry.createdBy"
            :created-at="loadedEntry.createdAt"
            :updated-at="loadedEntry.updatedAt"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" :to="{ name: 'journal-entries' }">Cancel</v-btn>
          <v-btn variant="outlined" :loading="saving" @click="save('draft')">Save as Draft</v-btn>
          <v-btn color="primary" :loading="saving" :disabled="!balanced" @click="save('posted')">
            Post Entry
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAccountsStore } from '@/stores/accounts'
import { useTransactionsStore } from '@/stores/transactions'
import { useOrganizationStore } from '@/stores/organization'
import { required } from '@/utils/validation'
import { formatCurrency } from '@/utils/currency'
import { totalDebits, totalCredits, isBalanced } from '@/utils/accounting'
import { formatDateISO } from '@/utils/date'
import AuditInfo from '@/components/common/AuditInfo.vue'
import type { JournalLine, JournalEntry } from '@/types/accounting'

const route = useRoute()
const router = useRouter()
const accountsStore = useAccountsStore()
const transactionsStore = useTransactionsStore()
const orgStore = useOrganizationStore()

const editing = computed(() => !!route.params.id)
const entryId = computed(() => route.params.id as string | undefined)

const formRef = ref()
const saving = ref(false)
const error = ref('')

const form = ref({
  dateStr: formatDateISO(new Date()),
  reference: '',
  memo: '',
  lines: [
    { accountId: '', description: '', debit: 0, credit: 0 },
    { accountId: '', description: '', debit: 0, credit: 0 },
  ] as JournalLine[],
})

const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')

const accountOptions = computed(() =>
  accountsStore.activeAccounts.map((a) => ({
    title: `${a.code} — ${a.name}`,
    value: a.id,
  }))
)

const totalDebitsValue = computed(() => totalDebits(form.value.lines))
const totalCreditsValue = computed(() => totalCredits(form.value.lines))
const balanced = computed(
  () => isBalanced(form.value.lines) && totalDebitsValue.value > 0
)

function addLine() {
  form.value.lines.push({ accountId: '', description: '', debit: 0, credit: 0 })
}

function removeLine(idx: number) {
  form.value.lines.splice(idx, 1)
}

function onDebitChange(idx: number) {
  if (form.value.lines[idx].debit > 0) {
    form.value.lines[idx].credit = 0
  }
}

function onCreditChange(idx: number) {
  if (form.value.lines[idx].credit > 0) {
    form.value.lines[idx].debit = 0
  }
}

async function save(status: 'draft' | 'posted') {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  // Filter out empty lines
  const lines = form.value.lines.filter(
    (l) => l.accountId && (l.debit > 0 || l.credit > 0)
  )

  if (lines.length < 2) {
    error.value = 'At least 2 lines with amounts are required'
    return
  }

  saving.value = true
  error.value = ''
  try {
    const data = {
      date: new Date(form.value.dateStr),
      reference: form.value.reference,
      memo: form.value.memo,
      lines,
      status,
    }
    if (editing.value && entryId.value) {
      await transactionsStore.updateEntry(entryId.value, data)
    } else {
      await transactionsStore.createEntry(data)
    }
    router.push({ name: 'journal-entries' })
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const loadedEntry = ref<JournalEntry | null>(null)

function loadEntry() {
  if (!entryId.value) return
  const entry = transactionsStore.entries.find((e) => e.id === entryId.value)
  if (!entry) return
  loadedEntry.value = entry
  form.value = {
    dateStr: formatDateISO(entry.date),
    reference: entry.reference,
    memo: entry.memo,
    lines: entry.lines.map((l) => ({ ...l })),
  }
}

onMounted(() => {
  if (orgStore.orgId) {
    accountsStore.subscribe()
    transactionsStore.subscribe()
  }
  if (editing.value) loadEntry()
})

watch(() => transactionsStore.entries, loadEntry)
</script>
