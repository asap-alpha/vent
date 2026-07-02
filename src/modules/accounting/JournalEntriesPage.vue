<template>
  <div>
    <PageHeader title="Journal Entries">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" size="small" :to="{ name: 'journal-entry-new' }">
          New Entry
        </v-btn>
      </template>
    </PageHeader>

    <v-card>
      <div class="d-flex align-center flex-wrap ga-2 pa-4 pb-0">
        <v-spacer />
        <v-text-field
          v-model="search"
          placeholder="Search..."
          prepend-inner-icon="mdi-magnify"
          hide-details
          density="compact"
          style="max-width: 240px"
        />
      </div>
      <v-data-table
        :headers="headers"
        :items="entries"
        :loading="transactionsStore.loading"
        :items-per-page="25"
        :search="search"
        @click:row="onRowClick"
      >
        <template #item.date="{ item }">
          {{ formatDate(item.date) }}
        </template>
        <template #item.totalDebits="{ item }">
          {{ formatCurrency(sumDebits(item.lines), currency) }}
        </template>
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" size="x-small" variant="tonal">
            {{ item.status }}
          </v-chip>
          <v-chip
            v-if="item.autoPosted"
            color="info"
            size="x-small"
            variant="tonal"
            class="ml-1"
            prepend-icon="mdi-cog"
          >
            Auto
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <!-- Auto-posted entries are system-owned: view only, edit the source doc. -->
          <v-tooltip v-if="item.autoPosted" text="Posted automatically from a source document" location="top">
            <template #activator="{ props }">
              <v-icon v-bind="props" size="small" color="grey" class="mr-1">mdi-lock</v-icon>
            </template>
          </v-tooltip>
          <template v-else>
            <v-btn
              v-if="item.status === 'draft'"
              icon="mdi-check"
              size="x-small"
              variant="text"
              color="success"
              @click.stop="postEntry(item.id)"
            />
            <v-btn
              icon="mdi-pencil"
              size="x-small"
              variant="text"
              @click.stop="editEntry(item.id)"
            />
            <v-btn
              icon="mdi-delete"
              size="x-small"
              variant="text"
              color="error"
              @click.stop="confirmDelete(item.id)"
            />
          </template>
        </template>
        <template #no-data>
          <EmptyState
            icon="mdi-book-edit-outline"
            title="No journal entries yet"
            description="Create a journal entry to record manual accounting adjustments."
            action-label="New Entry"
            action-icon="mdi-plus"
            :action-to="{ name: 'journal-entry-new' }"
          />
        </template>
      </v-data-table>
    </v-card>

    <ConfirmDialog
      ref="confirmRef"
      title="Delete Journal Entry"
      message="Are you sure you want to delete this entry? This cannot be undone."
      confirm-text="Delete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactionsStore } from '@/stores/transactions'
import { useAccountsStore } from '@/stores/accounts'
import { useOrganizationStore } from '@/stores/organization'
import { formatCurrency } from '@/utils/currency'
import { formatDate } from '@/utils/date'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { JournalEntry, JournalLine, JournalStatus } from '@/types/accounting'

const router = useRouter()
const transactionsStore = useTransactionsStore()
const accountsStore = useAccountsStore()
const orgStore = useOrganizationStore()

const entries = computed(() => transactionsStore.entries)
const currency = computed(() => orgStore.currentOrg?.currency || 'GHS')
const search = ref('')

const headers = [
  { title: 'Date', key: 'date', width: 130 },
  { title: 'Reference', key: 'reference', width: 130 },
  { title: 'Memo', key: 'memo' },
  { title: 'Amount', key: 'totalDebits', align: 'end' as const, width: 160 },
  { title: 'Status', key: 'status', width: 110 },
  { title: '', key: 'actions', sortable: false, width: 140, align: 'end' as const },
]

function sumDebits(lines: JournalLine[]): number {
  return lines.reduce((s, l) => s + (l.debit || 0), 0)
}

function statusColor(status: JournalStatus): string {
  return { draft: 'grey', posted: 'success', reversed: 'warning' }[status]
}

function onRowClick(_: any, row: { item: JournalEntry }) {
  // Auto-posted entries are read-only; don't open them in the editable form.
  if (row.item.autoPosted) return
  editEntry(row.item.id)
}

function editEntry(id: string) {
  router.push({ name: 'journal-entry-edit', params: { id } })
}

async function postEntry(id: string) {
  try {
    await transactionsStore.postEntry(id)
  } catch (e: any) {
    alert(e.message)
  }
}

const confirmRef = ref<InstanceType<typeof ConfirmDialog> | null>(null)
async function confirmDelete(id: string) {
  const ok = await confirmRef.value?.open()
  if (ok) await transactionsStore.deleteEntry(id)
}

onMounted(() => {
  if (orgStore.orgId) {
    transactionsStore.subscribe()
    accountsStore.subscribe()
  }
})

watch(
  () => orgStore.orgId,
  (id) => {
    if (id) {
      transactionsStore.subscribe()
      accountsStore.subscribe()
    }
  }
)
</script>
