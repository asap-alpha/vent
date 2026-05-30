import type { Plan, PlanId } from '@/types/subscription'

export const TRIAL_DAYS = 15
export const DEFAULT_TRIAL_PLAN: PlanId = 'standard'

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tagline: 'For sole traders & freelancers',
    monthlyPrice: 99,
    annualPrice: 990,
    currency: 'GHS',
    limits: {
      users: 1,
      organizations: 1,
      invoicesPerMonth: 1000,
      multiCurrency: false,
      advancedReports: false,
      auditLog: false,
      apiAccess: false,
      prioritySupport: false,
    },
    features: [
      '1 user',
      '1 organization',
      'Up to 1,000 invoices / month',
      'Customers & suppliers',
      'Basic P&L and Balance Sheet',
      'Email support',
    ],
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    tagline: 'For growing SMEs',
    monthlyPrice: 299,
    annualPrice: 2990,
    currency: 'GHS',
    recommended: true,
    limits: {
      users: 5,
      organizations: 1,
      invoicesPerMonth: 'unlimited',
      multiCurrency: true,
      advancedReports: true,
      auditLog: false,
      apiAccess: false,
      prioritySupport: false,
    },
    features: [
      'Up to 5 users',
      'Unlimited invoices, bills & quotes',
      'Multi-currency',
      'Bank reconciliation',
      'Full reports (P&L, Balance Sheet, Trial Balance, Aging)',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For established businesses & firms',
    monthlyPrice: 699,
    annualPrice: 6990,
    currency: 'GHS',
    limits: {
      users: 'unlimited',
      organizations: 'unlimited',
      invoicesPerMonth: 'unlimited',
      multiCurrency: true,
      advancedReports: true,
      auditLog: true,
      apiAccess: true,
      prioritySupport: true,
    },
    features: [
      'Unlimited users',
      'Unlimited organizations',
      'Audit log',
      'API access',
      'Priority support (WhatsApp + phone)',
      'Onboarding assistance',
    ],
  },
}

export const PLAN_ORDER: PlanId[] = ['starter', 'standard', 'pro']

export function getPlan(id: PlanId): Plan {
  return PLANS[id]
}

export function planRank(id: PlanId): number {
  return PLAN_ORDER.indexOf(id)
}
