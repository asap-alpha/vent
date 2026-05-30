<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold">Billing & Plans</h1>
        <div class="text-body-2 text-medium-emphasis mt-1">
          Manage your subscription and billing cycle
        </div>
      </div>
    </div>

    <!-- Current plan summary -->
    <v-card class="mb-6" variant="flat" border>
      <v-card-text class="pa-6">
        <div class="d-flex flex-wrap align-center ga-4">
          <div class="flex-grow-1" style="min-width: 240px">
            <div class="text-overline text-medium-emphasis">Current plan</div>
            <div class="d-flex align-center ga-3 mt-1">
              <div class="text-h5 font-weight-bold">{{ currentPlan?.name || '—' }}</div>
              <v-chip
                :color="statusColor"
                size="small"
                variant="tonal"
                class="text-capitalize"
              >
                {{ statusLabel }}
              </v-chip>
            </div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              {{ currentPlan?.tagline }}
            </div>
          </div>

          <div v-if="subStore.isTrialing" class="text-end">
            <div class="text-overline text-medium-emphasis">Trial ends in</div>
            <div class="text-h5 font-weight-bold" :class="trialColor">
              {{ subStore.daysLeftInTrial }} day{{ subStore.daysLeftInTrial === 1 ? '' : 's' }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ formatDate(subStore.subscription?.trialEndsAt) }}
            </div>
          </div>

          <div v-else-if="subStore.isActive && subStore.subscription?.currentPeriodEnd" class="text-end">
            <div class="text-overline text-medium-emphasis">Next billing date</div>
            <div class="text-h6 font-weight-bold">
              {{ formatDate(subStore.subscription.currentPeriodEnd) }}
            </div>
            <div class="text-caption text-medium-emphasis text-capitalize">
              Billed {{ subStore.subscription.billingCycle }}
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Billing cycle toggle -->
    <div class="d-flex align-center justify-center mb-6">
      <v-btn-toggle
        v-model="selectedCycle"
        mandatory
        density="comfortable"
        color="primary"
        variant="outlined"
      >
        <v-btn value="monthly">Monthly</v-btn>
        <v-btn value="annual">
          Annual
          <v-chip color="success" size="x-small" class="ml-2">2 months free</v-chip>
        </v-btn>
      </v-btn-toggle>
    </div>

    <!-- Plans grid -->
    <v-row>
      <v-col
        v-for="plan in plans"
        :key="plan.id"
        cols="12"
        md="4"
      >
        <v-card
          :variant="plan.recommended ? 'elevated' : 'flat'"
          :elevation="plan.recommended ? 6 : 0"
          border
          class="h-100 d-flex flex-column"
          :class="{ 'border-primary border-2': plan.recommended }"
        >
          <v-card-text class="pa-6 flex-grow-1 d-flex flex-column">
            <div v-if="plan.recommended" class="mb-2">
              <v-chip color="primary" size="small" variant="flat">Recommended</v-chip>
            </div>
            <div class="text-h5 font-weight-bold">{{ plan.name }}</div>
            <div class="text-body-2 text-medium-emphasis mb-4">{{ plan.tagline }}</div>

            <div class="d-flex align-baseline mb-1">
              <span class="text-h3 font-weight-bold">
                GH₵{{ priceFor(plan).toLocaleString() }}
              </span>
              <span class="text-body-2 text-medium-emphasis ml-2">
                / {{ selectedCycle === 'annual' ? 'year' : 'month' }}
              </span>
            </div>
            <div v-if="selectedCycle === 'annual'" class="text-caption text-success mb-4">
              Save GH₵{{ (plan.monthlyPrice * 12 - plan.annualPrice).toLocaleString() }} / year
            </div>
            <div v-else class="mb-4" style="height: 16px" />

            <v-list density="compact" class="bg-transparent flex-grow-1">
              <v-list-item
                v-for="f in plan.features"
                :key="f"
                class="px-0"
                min-height="32"
              >
                <template #prepend>
                  <v-icon size="18" color="success">mdi-check-circle</v-icon>
                </template>
                <v-list-item-title class="text-body-2">{{ f }}</v-list-item-title>
              </v-list-item>
            </v-list>

            <v-btn
              :color="plan.recommended ? 'primary' : undefined"
              :variant="isCurrent(plan.id) ? 'tonal' : plan.recommended ? 'flat' : 'outlined'"
              size="large"
              block
              class="mt-4"
              :disabled="isCurrent(plan.id) || !canUpgrade(plan.id) || checkoutLoading"
              :loading="checkoutLoading && pendingPlan === plan.id"
              @click="onSelect(plan.id)"
            >
              {{ buttonLabel(plan.id) }}
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Cancel subscription -->
    <v-card v-if="subStore.isActive && !subStore.isTrialing" class="mt-6" variant="flat" border>
      <v-card-text class="pa-6 d-flex flex-wrap align-center ga-4">
        <div class="flex-grow-1">
          <div class="text-subtitle-1 font-weight-bold">Cancel subscription</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Your plan will remain active until the end of the current billing period.
          </div>
        </div>
        <v-btn color="error" variant="outlined" @click="onCancel">
          Cancel subscription
        </v-btn>
      </v-card-text>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3500">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'
import { useOrganizationStore } from '@/stores/organization'
import { usePayment } from '@/composables/usePayment'
import { PLANS, PLAN_ORDER } from '@/config/plans'
import type { BillingCycle, PlanId } from '@/types/subscription'

const subStore = useSubscriptionStore()
const orgStore = useOrganizationStore()
const { initiateCheckout } = usePayment()

const plans = computed(() => PLAN_ORDER.map((id) => PLANS[id]))
const currentPlan = computed(() => subStore.plan)

const selectedCycle = ref<BillingCycle>(subStore.subscription?.billingCycle || 'monthly')
watch(
  () => subStore.subscription?.billingCycle,
  (v) => {
    if (v) selectedCycle.value = v
  }
)

const checkoutLoading = ref(false)
const pendingPlan = ref<PlanId | null>(null)
const snackbar = ref({ show: false, message: '', color: 'success' })

const statusLabel = computed(() => {
  if (subStore.isTrialing) return 'Trial'
  return subStore.status.replace('_', ' ')
})

const statusColor = computed(() => {
  switch (subStore.status) {
    case 'active': return 'success'
    case 'trialing': return 'info'
    case 'past_due': return 'warning'
    case 'canceled':
    case 'expired': return 'error'
    default: return 'default'
  }
})

const trialColor = computed(() => {
  const d = subStore.daysLeftInTrial
  if (d <= 3) return 'text-error'
  if (d <= 7) return 'text-warning'
  return 'text-info'
})

function priceFor(plan: typeof PLANS.starter) {
  return selectedCycle.value === 'annual' ? plan.annualPrice : plan.monthlyPrice
}

function isCurrent(planId: PlanId): boolean {
  return (
    subStore.subscription?.plan === planId &&
    !subStore.isTrialing &&
    subStore.status === 'active' &&
    subStore.subscription?.billingCycle === selectedCycle.value
  )
}

function canUpgrade(planId: PlanId): boolean {
  if (subStore.isTrialing) return true
  return subStore.canUpgradeTo(planId) || subStore.subscription?.plan === planId
}

function buttonLabel(planId: PlanId): string {
  if (isCurrent(planId)) return 'Current plan'
  if (subStore.isTrialing) return `Subscribe to ${PLANS[planId].name}`
  if (subStore.canUpgradeTo(planId)) return 'Upgrade'
  if (subStore.subscription?.plan === planId) return 'Switch billing cycle'
  return 'Downgrade'
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

async function onSelect(planId: PlanId) {
  if (!orgStore.orgId) return
  checkoutLoading.value = true
  pendingPlan.value = planId
  try {
    const res = await initiateCheckout({
      orgId: orgStore.orgId,
      plan: planId,
      cycle: selectedCycle.value,
    })
    snackbar.value = res.ok
      ? { show: true, message: `Subscribed to ${PLANS[planId].name}`, color: 'success' }
      : { show: true, message: res.message || 'Checkout failed', color: 'error' }
  } catch (e: any) {
    snackbar.value = { show: true, message: e.message || 'Checkout failed', color: 'error' }
  } finally {
    checkoutLoading.value = false
    pendingPlan.value = null
  }
}

async function onCancel() {
  if (!orgStore.orgId) return
  if (!confirm('Cancel your subscription? Your plan stays active until the end of the current period.')) return
  await subStore.cancel(orgStore.orgId)
  snackbar.value = { show: true, message: 'Subscription canceled', color: 'info' }
}
</script>

<style scoped>
.border-primary {
  border-color: rgb(var(--v-theme-primary)) !important;
}
</style>
