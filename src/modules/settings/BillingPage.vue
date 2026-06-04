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
              :disabled="isCurrent(plan.id) || checkoutLoading"
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

    <!-- Mobile money payment dialog -->
    <v-dialog v-model="payDialog" max-width="460">
      <v-card>
        <v-card-title class="text-h6 font-weight-bold">
          {{ payActionLabel }}
        </v-card-title>
        <v-card-text>
          <div class="d-flex align-baseline mb-4">
            <span class="text-h5 font-weight-bold">GH₵{{ selectedAmount.toLocaleString() }}</span>
            <span class="text-body-2 text-medium-emphasis ml-2">
              / {{ selectedCycle === 'annual' ? 'year' : 'month' }}
            </span>
          </div>

          <template v-if="payStep === 'form' || payStep === 'error'">
            <v-select
              v-model="channel"
              :items="networks"
              label="Mobile network"
              variant="outlined"
              density="comfortable"
              class="mb-2"
            />
            <v-text-field
              v-model="momo"
              label="Mobile money number"
              placeholder="0241234567"
              variant="outlined"
              density="comfortable"
              inputmode="tel"
            />
            <v-alert v-if="payError" type="error" variant="tonal" density="compact" class="mt-1">
              {{ payError }}
            </v-alert>
          </template>

          <template v-else-if="payStep === 'awaiting'">
            <div class="d-flex flex-column align-center text-center py-4">
              <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
              <div class="text-body-1">{{ awaitingMsg }}</div>
              <div class="text-caption text-medium-emphasis mt-2">
                You can close this window — your plan updates automatically once the payment is approved.
              </div>
            </div>
          </template>

          <template v-else-if="payStep === 'done'">
            <div class="d-flex flex-column align-center text-center py-4">
              <v-icon color="success" size="48" class="mb-3">mdi-check-circle</v-icon>
              <div class="text-body-1 font-weight-medium">Payment successful</div>
            </div>
          </template>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="payDialog = false">
            {{ payStep === 'done' ? 'Close' : 'Cancel' }}
          </v-btn>
          <v-btn
            v-if="payStep === 'form' || payStep === 'error'"
            color="primary"
            variant="flat"
            :loading="checkoutLoading"
            @click="confirmPay"
          >
            Pay GH₵{{ selectedAmount.toLocaleString() }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
const { initiateCheckout, waitForPayment } = usePayment()

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

// Mobile-money payment dialog state.
type PayStep = 'form' | 'awaiting' | 'done' | 'error'
const payDialog = ref(false)
const payStep = ref<PayStep>('form')
const momo = ref('')
const channel = ref<'mtn-gh' | 'vodafone-gh' | 'tigo-gh'>('mtn-gh')
const payError = ref('')
const awaitingMsg = ref('')

const networks = [
  { title: 'MTN Mobile Money', value: 'mtn-gh' },
  { title: 'Telecel Cash (Vodafone)', value: 'vodafone-gh' },
  { title: 'AirtelTigo Money', value: 'tigo-gh' },
]

// Mirrors the card's CTA so the dialog reads "Renew Standard" / "Subscribe to Pro" etc.
const payActionLabel = computed(() => (pendingPlan.value ? buttonLabel(pendingPlan.value) : 'Subscribe'))
const selectedAmount = computed(() => {
  if (!pendingPlan.value) return 0
  const p = PLANS[pendingPlan.value]
  return selectedCycle.value === 'annual' ? p.annualPrice : p.monthlyPrice
})

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

// Show the disabled "Current plan" pill only when this plan is genuinely active
// on the selected cycle. An expired/canceled sub is NOT current, so its card
// flips to a Renew CTA instead of locking the user out.
function isCurrent(planId: PlanId): boolean {
  return (
    subStore.subscription?.plan === planId &&
    subStore.status === 'active' &&
    subStore.subscription?.billingCycle === selectedCycle.value
  )
}

function buttonLabel(planId: PlanId): string {
  const name = PLANS[planId].name

  // During a trial nothing has been paid yet — every plan is a subscribe action.
  if (subStore.isTrialing) return `Subscribe to ${name}`

  const isMyPlan = subStore.subscription?.plan === planId
  if (isMyPlan) {
    if (subStore.status === 'active') return 'Switch billing cycle'
    // Lapsed: only call it a "Renew" if they actually paid before. New orgs are
    // seeded onto the Standard trial (plan='standard', no paid period), so a
    // first-time subscriber after the trial should read "Subscribe", not "Renew".
    return subStore.subscription?.currentPeriodEnd ? `Renew ${name}` : `Subscribe to ${name}`
  }

  // A different plan: upgrade/switch while active, otherwise a fresh subscribe.
  if (subStore.status === 'active') {
    return subStore.canUpgradeTo(planId) ? `Upgrade to ${name}` : `Switch to ${name}`
  }
  return `Subscribe to ${name}`
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

function onSelect(planId: PlanId) {
  if (!orgStore.orgId) return
  pendingPlan.value = planId
  payStep.value = 'form'
  payError.value = ''
  momo.value = ''
  payDialog.value = true
}

async function confirmPay() {
  if (!orgStore.orgId || !pendingPlan.value) return
  if (momo.value.replace(/\D/g, '').length < 9) {
    payError.value = 'Enter a valid mobile money number.'
    return
  }
  payError.value = ''
  checkoutLoading.value = true
  payStep.value = 'awaiting'
  awaitingMsg.value = 'Sending payment prompt to your phone…'

  try {
    const res = await initiateCheckout({
      orgId: orgStore.orgId,
      plan: pendingPlan.value,
      cycle: selectedCycle.value,
      customerMsisdn: momo.value.trim(),
      channel: channel.value,
    })

    if (!res.ok || !res.clientReference) {
      payStep.value = 'error'
      payError.value = res.error || res.message || 'Could not start payment.'
      return
    }

    awaitingMsg.value = 'Approve the prompt on your phone to complete payment…'
    const final = await waitForPayment(res.clientReference, {
      onTick: (s) => {
        if (s === 'Pending') awaitingMsg.value = 'Waiting for you to approve the prompt…'
      },
    })

    if (final.status === 'Paid') {
      payStep.value = 'done'
      snackbar.value = { show: true, message: `Subscribed to ${PLANS[pendingPlan.value].name}`, color: 'success' }
      setTimeout(() => { payDialog.value = false }, 1200)
    } else if (final.error === 'timeout') {
      payStep.value = 'error'
      payError.value = 'Payment is taking longer than expected. If you approved it, your plan will update automatically shortly.'
    } else if (final.status === 'AmountMismatch') {
      payStep.value = 'error'
      payError.value = 'The amount paid did not match the plan price. Your subscription was not activated.'
    } else {
      payStep.value = 'error'
      payError.value = 'Payment was not completed. Please try again.'
    }
  } catch (e: any) {
    payStep.value = 'error'
    payError.value = e.message || 'Checkout failed'
  } finally {
    checkoutLoading.value = false
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
