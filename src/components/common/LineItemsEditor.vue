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
            <th v-if="itemOptions" class="text-body-2 font-weight-medium" style="width: 190px">Item</th>
            <th class="text-body-2 font-weight-medium">Description</th>
            <th v-if="accountOptions" class="text-body-2 font-weight-medium" style="width: 200px">Account</th>
            <th class="text-body-2 font-weight-medium text-end" style="width: 80px">Qty</th>
            <th class="text-body-2 font-weight-medium text-end" style="width: 120px">Unit Price</th>
            <th
              class="text-body-2 font-weight-medium"
              :class="taxCodes ? '' : 'text-end'"
              :style="taxCodes ? 'width: 180px' : 'width: 80px'"
            >
              Tax
            </th>
            <th class="text-body-2 font-weight-medium text-end" style="width: 130px">Amount</th>
            <th style="width: 44px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, idx) in modelValue" :key="idx">
            <td v-if="itemOptions" class="py-2">
              <v-select
                :model-value="line.itemId"
                :items="itemOptions"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                placeholder="Select item"
                @update:model-value="(v: string | null) => onItemChange(line, v)"
              />
            </td>
            <td class="py-2">
              <v-text-field
                v-model="line.description"
                density="compact"
                variant="outlined"
                hide-details
                placeholder="Description"
                @update:model-value="emitUpdate"
              />
            </td>
            <td v-if="accountOptions" class="py-2">
              <v-select
                v-model="line.accountId"
                :items="accountOptions"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                placeholder="Account"
                @update:model-value="emitUpdate"
              />
            </td>
            <td class="py-2">
              <v-text-field
                v-model.number="line.quantity"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
                min="0"
                step="1"
                class="text-end-input no-spinner"
                @update:model-value="emitUpdate"
              />
            </td>
            <td class="py-2">
              <v-text-field
                v-model.number="line.unitPrice"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
                min="0"
                step="0.01"
                class="text-end-input no-spinner"
                @update:model-value="emitUpdate"
              />
            </td>
            <td class="py-2">
              <v-select
                v-if="taxCodes"
                v-model="line.taxCodeId"
                :items="taxCodes"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                placeholder="No tax"
                @update:model-value="(v: string | null) => onTaxCodeChange(line, v)"
              />
              <v-text-field
                v-else
                v-model.number="line.taxRate"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
                min="0"
                step="0.01"
                class="text-end-input no-spinner"
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
  accountId?: string
  taxCodeId?: string
  itemId?: string
}

interface AccountOption {
  title: string
  value: string
}

interface TaxCodeOption {
  title: string
  value: string
  rate: number
}

/** A catalog item resolved for the current context (sales vs purchase). */
interface ItemOption {
  title: string
  value: string          // itemId
  description?: string
  accountId?: string     // income (sales) or inventory/expense (purchase) account
  unitPrice?: number     // sales price or purchase cost
  taxCodeId?: string
  taxRate?: number
}

const props = defineProps<{
  modelValue: Line[]
  currency: string
  /** When provided, renders a per-line account picker with these options. */
  accountOptions?: AccountOption[]
  /** Account preselected for newly added lines. */
  defaultAccountId?: string
  /** When provided, replaces the raw "Tax %" field with a tax-code picker. */
  taxCodes?: TaxCodeOption[]
  /** Tax code preselected for newly added lines. */
  defaultTaxCodeId?: string
  /** When provided, renders a per-line item picker that pre-fills the line. */
  itemOptions?: ItemOption[]
}>()

// Picking an item pre-fills the line (description, account, price, tax) and records
// the itemId that drives inventory/COGS on the server. Clearing it just unlinks the
// item; the typed-in values stay so the line remains a valid free-form line.
function onItemChange(line: Line, itemId: string | null) {
  line.itemId = itemId || undefined
  const opt = itemId ? props.itemOptions?.find((o) => o.value === itemId) : undefined
  if (opt) {
    if (opt.description) line.description = opt.description
    if (opt.accountId) line.accountId = opt.accountId
    if (opt.unitPrice !== undefined) line.unitPrice = opt.unitPrice
    line.taxCodeId = opt.taxCodeId
    line.taxRate = opt.taxRate || 0
  }
  emitUpdate()
}

// Selecting a tax code sets the line's effective rate so the existing amount/total
// math (which is linear in the base) stays correct; the component breakdown for
// posting is derived at save time from the code.
function onTaxCodeChange(line: Line, codeId: string | null) {
  const code = codeId ? props.taxCodes?.find((c) => c.value === codeId) : undefined
  line.taxCodeId = codeId || undefined
  line.taxRate = code?.rate || 0
  emitUpdate()
}

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
  const defaultCode = props.defaultTaxCodeId
    ? props.taxCodes?.find((c) => c.value === props.defaultTaxCodeId)
    : undefined
  emit('update:modelValue', [
    ...props.modelValue,
    {
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: defaultCode?.rate || 0,
      amount: 0,
      accountId: props.defaultAccountId,
      taxCodeId: props.defaultTaxCodeId,
    },
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

:deep(.no-spinner input[type='number']) {
  -moz-appearance: textfield;
}
:deep(.no-spinner input[type='number']::-webkit-outer-spin-button),
:deep(.no-spinner input[type='number']::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
