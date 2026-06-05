<template>
  <v-dialog :model-value="modelValue" max-width="480" @update:model-value="$emit('update:modelValue', $event)">
    <v-card v-if="org" class="pa-2">
      <!-- Header -->
      <div class="text-center pt-6 px-6">
        <v-icon size="40" color="primary" class="mb-2">mdi-timer-outline</v-icon>
        <div class="text-h5 font-weight-bold">Extend Trial</div>
        <div class="text-body-2 text-medium-emphasis mt-1">
          Grant additional time to {{ org.name }}.
        </div>
      </div>

      <v-card-text class="px-6">
        <!-- Current expiry -->
        <div class="info-row mb-2">
          <span class="text-medium-emphasis">Current expiry</span>
          <span class="font-weight-bold">
            {{ currentExpiry ? formatDate(currentExpiry) : '—' }}
            <span v-if="currentExpiry" class="text-medium-emphasis font-weight-regular">
              ({{ daysLeft }}d left)
            </span>
          </span>
        </div>

        <!-- First activated -->
        <div class="info-row mb-4" style="background: rgb(var(--v-theme-surface-variant))">
          <span class="text-medium-emphasis">First activated</span>
          <span class="font-weight-bold">{{ formatDate(org.createdAt) }}</span>
        </div>

        <!-- Add time -->
        <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase mb-2">Add time</div>
        <div class="d-flex flex-wrap ga-2 mb-2">
          <v-btn
            v-for="p in PRESETS"
            :key="p"
            :variant="!custom && selectedDays === p ? 'flat' : 'outlined'"
            :color="!custom && selectedDays === p ? 'primary' : undefined"
            size="small"
            @click="selectPreset(p)"
          >+{{ p }} days</v-btn>
          <v-btn
            :variant="custom ? 'flat' : 'outlined'"
            :color="custom ? 'primary' : undefined"
            size="small"
            @click="custom = true"
          >Custom</v-btn>
        </div>

        <v-text-field
          v-if="custom"
          v-model.number="customDays"
          type="number"
          min="1"
          max="3650"
          density="compact"
          label="Days to add"
          hide-details
          class="mb-3"
        />

        <!-- New expiry preview -->
        <div class="new-expiry mt-3">
          <span>New expiry</span>
          <span class="font-weight-bold">{{ newExpiry ? formatDate(newExpiry) : '—' }}</span>
        </div>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-btn variant="outlined" class="flex-grow-1" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          class="flex-grow-1"
          :loading="saving"
          :disabled="!effectiveDays || effectiveDays < 1"
          @click="doExtend"
        >Extend by {{ effectiveDays || 0 }} days</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAdminStore, type AdminOrg } from '@/stores/admin'
import { useToast } from '@/composables/useToast'
import { formatDate } from '@/utils/date'

const props = defineProps<{ modelValue: boolean; org: AdminOrg | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; extended: [Date] }>()

const adminStore = useAdminStore()
const toast = useToast()

const PRESETS = [7, 30, 60, 90]

const selectedDays = ref(30)
const custom = ref(false)
const customDays = ref<number | null>(null)
const saving = ref(false)

// Reset selection each time the dialog opens.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedDays.value = 30
      custom.value = false
      customDays.value = null
    }
  }
)

const effectiveDays = computed(() => (custom.value ? customDays.value || 0 : selectedDays.value))

const currentExpiry = computed(() => (props.org?.trialEndsAt ? new Date(props.org.trialEndsAt) : null))

const daysLeft = computed(() => {
  if (!currentExpiry.value) return 0
  const ms = currentExpiry.value.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
})

// Mirror the store's logic so the preview matches what will be saved: extend from
// the later of (current expiry, now).
const newExpiry = computed(() => {
  if (!effectiveDays.value || effectiveDays.value < 1) return null
  const now = Date.now()
  const base = currentExpiry.value && currentExpiry.value.getTime() > now ? new Date(currentExpiry.value) : new Date()
  base.setDate(base.getDate() + effectiveDays.value)
  return base
})

function selectPreset(p: number) {
  custom.value = false
  selectedDays.value = p
}

async function doExtend() {
  if (!props.org || !effectiveDays.value) return
  saving.value = true
  try {
    const result = await adminStore.extendExpiry(props.org.id, effectiveDays.value)
    toast.success(`${props.org.name} extended to ${formatDate(result)}`)
    emit('extended', result)
    emit('update:modelValue', false)
  } catch (e: any) {
    toast.error(e?.message || 'Failed to extend trial')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface-variant));
}
.new-expiry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: 10px;
  background: rgba(var(--v-theme-success), 0.12);
  color: rgb(var(--v-theme-success));
}
</style>
