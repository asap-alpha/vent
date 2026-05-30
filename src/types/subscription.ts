export type PlanId = 'starter' | 'standard' | 'pro'

export type BillingCycle = 'monthly' | 'annual'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'

export interface PlanFeature {
  label: string
  included: boolean
}

export interface PlanLimits {
  users: number | 'unlimited'
  organizations: number | 'unlimited'
  invoicesPerMonth: number | 'unlimited'
  multiCurrency: boolean
  advancedReports: boolean
  auditLog: boolean
  apiAccess: boolean
  prioritySupport: boolean
}

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  monthlyPrice: number
  annualPrice: number
  currency: 'GHS'
  limits: PlanLimits
  features: string[]
  recommended?: boolean
}

export interface OrgSubscription {
  plan: PlanId
  status: SubscriptionStatus
  billingCycle: BillingCycle
  trialEndsAt: Date | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  canceledAt?: Date | null
}

export interface BillingInvoice {
  id: string
  orgId: string
  plan: PlanId
  billingCycle: BillingCycle
  amount: number
  currency: 'GHS'
  status: 'pending' | 'paid' | 'failed'
  paymentRef?: string
  createdAt: Date
  paidAt?: Date | null
}
