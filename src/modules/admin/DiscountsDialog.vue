<template>
  <v-dialog :model-value="modelValue" max-width="640" @update:model-value="$emit('update:modelValue', $event)">
    <v-card v-if="org">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2" color="primary">mdi-sale</v-icon>
        Discount codes
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('update:modelValue', false)" />
      </v-card-title>
      <v-card-subtitle class="pb-0">{{ org.name }}</v-card-subtitle>

      <v-card-text>
        <!-- Create -->
        <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase mb-2">Issue a new code</div>
        <v-row dense class="align-center">
          <v-col cols="6" sm="3">
            <v-text-field
              v-model.number="percent"
              type="number"
              min="1"
              max="100"
              label="Discount %"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model.number="expiresInDays"
              type="number"
              min="1"
              max="3650"
              label="Expires (days)"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field v-model="notes" label="Notes (optional)" density="compact" hide-details />
          </v-col>
          <v-col cols="12" sm="2">
            <v-btn
              color="primary"
              variant="flat"
              block
              :loading="creating"
              :disabled="!percent || percent < 1 || percent > 100"
              @click="create"
            >Create</v-btn>
          </v-col>
        </v-row>

        <v-divider class="my-4" />

        <!-- Existing -->
        <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase mb-2">Issued codes</div>
        <div v-if="discountStore.loading" class="text-center py-6">
          <v-progress-circular indeterminate color="primary" size="28" />
        </div>
        <div v-else-if="!discountStore.discounts.length" class="text-medium-emphasis text-center py-6">
          No discount codes for this business yet.
        </div>
        <v-table v-else density="compact">
          <thead>
            <tr>
              <th>Code</th>
              <th class="text-end">%</th>
              <th>Status</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in discountStore.discounts" :key="d.id">
              <td>
                <span class="font-weight-bold" style="font-family: monospace; letter-spacing: 1px">{{ d.code }}</span>
                <v-btn icon="mdi-content-copy" size="x-small" variant="text" class="ml-1" @click="copy(d.code)" />
              </td>
              <td class="text-end">{{ d.discountPercent }}%</td>
              <td><v-chip :color="statusColor(d)" size="x-small">{{ statusLabel(d) }}</v-chip></td>
              <td>{{ d.expiresAt ? formatDate(d.expiresAt) : '—' }}</td>
              <td class="text-end">
                <v-btn
                  v-if="d.status === 'active'"
                  icon="mdi-cancel"
                  size="x-small"
                  variant="text"
                  color="error"
                  title="Revoke"
                  @click="revoke(d.id)"
                />
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDiscountStore } from '@/stores/discount'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/date'
import type { AdminOrg } from '@/stores/admin'
import type { Discount } from '@/types/discount'

const props = defineProps<{ modelValue: boolean; org: AdminOrg | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const discountStore = useDiscountStore()
const toast = useToast()

const percent = ref<number | null>(20)
const expiresInDays = ref<number>(30)
const notes = ref('')
const creating = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.org) {
      percent.value = 20
      expiresInDays.value = 30
      notes.value = ''
      discountStore.listForOrg(props.org.id).catch((e) => toast.error(e?.message || 'Failed to load codes'))
    }
  }
)

function isExpired(d: Discount): boolean {
  return d.status === 'active' && !!d.expiresAt && d.expiresAt.getTime() < Date.now()
}

function statusLabel(d: Discount): string {
  if (isExpired(d)) return 'expired'
  return d.status
}

function statusColor(d: Discount): string {
  if (isExpired(d)) return 'grey'
  return { active: 'success', used: 'info', revoked: 'error' }[d.status] || 'grey'
}

async function create() {
  if (!props.org || !percent.value) return
  creating.value = true
  try {
    const created = await discountStore.createDiscount({
      orgId: props.org.id,
      discountPercent: percent.value,
      expiresInDays: expiresInDays.value,
      notes: notes.value,
    })
    toast.success(`Code ${created.code} created (${created.discountPercent}% off)`)
    notes.value = ''
  } catch (e: any) {
    toast.error(e?.message || 'Failed to create code')
  } finally {
    creating.value = false
  }
}

async function revoke(id: string) {
  try {
    await discountStore.revokeDiscount(id)
    toast.success('Code revoked')
  } catch (e: any) {
    toast.error(e?.message || 'Failed to revoke')
  }
}

async function copy(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.success(`Copied ${code}`)
  } catch {
    toast.error('Could not copy')
  }
}
</script>
