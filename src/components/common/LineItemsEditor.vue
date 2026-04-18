<template>
  <div>
    <div class="d-flex align-center mb-3">
      <div class="text-subtitle-2 font-weight-bold">Line Items</div>
      <v-spacer />
      <v-btn size="small" prepend-icon="mdi-plus" variant="tonal" color="primary" @click="addLine">
        Add Line
      </v-btn>
    </div>

    <div class="line-items-table">
      <v-table density="comfortable">
        <thead>
          <tr>
            <th class="text-body-2 font-weight-medium">Description</th>
            <th class="text-body-2 font-weight-medium text-end" style="width: 80px">Qty</th>
            <th class="text-body-2 font-weight-medium text-end" style="width: 120px">Unit Price</th>
            <th class="text-body-2 font-weight-medium text-end" style="width: 80px">Tax %</th>
            <th class="text-body-2 font-weight-medium text-end" style="width: 130px">Amount</th>
            <th style="width: 44px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, idx) in modelValue" :key="idx">
            <td class="py-2">
              <v-text-field
                v-model="line.description"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                placeholder="Description"
                @update:model-value="emitUpdate"
              />
            </td>
            <td class="py-2">
              <v-text-field
                v-model.number="line.quantity"
                type="number"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                min="0"
                step="1"
                class="text-end-input"
                @update:model-value="emitUpdate"
              />
            </td>
            <td class="py-2">
              <v-text-field
                v-model.number="line.unitPrice"
                type="number"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                min="0"
                step="0.01"
                class="text-end-input"
                @update:model-value="emitUpdate"
              />
            </td>
            <td class="py-2">
              <v-text-field
                v-model.number="line.taxRate"
                type="number"
                density="compact"
                variant="solo-filled"
                flat
                hide-details
                min="0"
                step="0.01"
                class="text-end-input"
                @update:model-value="emitUpdate"
              />
            </td>
            <td class="text-end py-2 text-body-2 font-weight-medium">
              {{ formatCurrency(lineAmount(line), currency) }}
            </td>
            <td class="py-2 text-center">
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                color="error"
                :disabled="modelValue.length <= 1"
                @click="removeLine(idx)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Totals -->
      <div class="totals-section">
        <div class="totals-row">
          <span class="text-body-2 text-medium-emphasis">Subtotal</span>
          <span class="text-body-2">{{ formatCurrency(totals.subtotal, currency) }}</span>
        </div>
        <div class="totals-row">
          <span class="text-body-2 text-medium-emphasis">Tax</span>
          <span class="text-body-2">{{ formatCurrency(totals.taxTotal, currency) }}</span>
        </div>
        <v-divider class="my-2" />
        <div class="totals-row">
          <span class="text-subtitle-2 font-weight-bold">Total</span>
          <span class="text-subtitle-1 font-weight-bold">{{ formatCurrency(totals.total, currency) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatCurrency } from '@/utils/currency'

interface Line {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  amount: number
}

const props = defineProps<{
  modelValue: Line[]
  currency: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Line[]]
}>()

function lineAmount(line: Line): number {
  const sub = (line.quantity || 0) * (line.unitPrice || 0)
  const tax = sub * ((line.taxRate || 0) / 100)
  return sub + tax
}

const totals = computed(() => {
  let subtotal = 0
  let taxTotal = 0
  for (const line of props.modelValue) {
    const sub = (line.quantity || 0) * (line.unitPrice || 0)
    const tax = sub * ((line.taxRate || 0) / 100)
    subtotal += sub
    taxTotal += tax
  }
  return { subtotal, taxTotal, total: subtotal + taxTotal }
})

function emitUpdate() {
  emit('update:modelValue', [...props.modelValue])
}

function addLine() {
  emit('update:modelValue', [
    ...props.modelValue,
    { description: '', quantity: 1, unitPrice: 0, taxRate: 0, amount: 0 },
  ])
}

function removeLine(idx: number) {
  const next = [...props.modelValue]
  next.splice(idx, 1)
  emit('update:modelValue', next)
}
</script>

<style scoped>
.line-items-table {
  border: 1px solid rgb(var(--v-theme-on-surface), 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.totals-section {
  background: rgb(var(--v-theme-surface-variant));
  padding: 16px 20px;
}

.totals-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 40px;
  padding: 2px 0;
}

.totals-row span:first-child {
  min-width: 80px;
  text-align: right;
}

:deep(.text-end-input input) {
  text-align: right;
}
</style>
