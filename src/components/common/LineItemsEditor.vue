<template>
  <div>
    <div class="d-flex align-center mb-2">
      <h3 class="text-subtitle-1 font-weight-bold">Line Items</h3>
      <v-spacer />
      <v-btn size="small" prepend-icon="mdi-plus" variant="tonal" @click="addLine">
        Add Line
      </v-btn>
    </div>

    <v-table density="comfortable">
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-end" style="width: 90px">Qty</th>
          <th class="text-end" style="width: 130px">Unit Price</th>
          <th class="text-end" style="width: 90px">Tax %</th>
          <th class="text-end" style="width: 140px">Amount</th>
          <th style="width: 50px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(line, idx) in modelValue" :key="idx">
          <td>
            <v-text-field
              v-model="line.description"
              density="compact"
              variant="outlined"
              hide-details
              placeholder="Description"
              @update:model-value="emitUpdate"
            />
          </td>
          <td>
            <v-text-field
              v-model.number="line.quantity"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              min="0"
              step="1"
              @update:model-value="emitUpdate"
            />
          </td>
          <td>
            <v-text-field
              v-model.number="line.unitPrice"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              min="0"
              step="0.01"
              @update:model-value="emitUpdate"
            />
          </td>
          <td>
            <v-text-field
              v-model.number="line.taxRate"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              min="0"
              step="0.01"
              @update:model-value="emitUpdate"
            />
          </td>
          <td class="text-end">{{ formatCurrency(lineAmount(line), currency) }}</td>
          <td class="text-center">
            <v-btn
              icon="mdi-close"
              size="x-small"
              variant="text"
              :disabled="modelValue.length <= 1"
              @click="removeLine(idx)"
            />
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="text-end">Subtotal</td>
          <td class="text-end">{{ formatCurrency(totals.subtotal, currency) }}</td>
          <td></td>
        </tr>
        <tr>
          <td colspan="4" class="text-end">Tax</td>
          <td class="text-end">{{ formatCurrency(totals.taxTotal, currency) }}</td>
          <td></td>
        </tr>
        <tr class="font-weight-bold">
          <td colspan="4" class="text-end">Total</td>
          <td class="text-end">{{ formatCurrency(totals.total, currency) }}</td>
          <td></td>
        </tr>
      </tfoot>
    </v-table>
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
