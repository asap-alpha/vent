export type UserRole = 'owner' | 'admin' | 'accountant' | 'clerk' | 'viewer'

/** Platform-level role — stored on /users/{uid}.platformRole, set only via backend */
export type PlatformRole = 'super_admin' | 'user'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  organizations: string[]
  defaultOrgId: string | null
  platformRole?: PlatformRole
  createdAt: Date
}

export interface OrgMember {
  userId: string
  role: UserRole
  email: string
  displayName: string
  invitedBy: string
  joinedAt: Date
}

export interface Invitation {
  id: string
  orgId: string
  orgName: string
  email: string
  role: UserRole
  invitedBy: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Date
}

export type OrgStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

/** Payment instructions printed at the foot of every invoice / bill PDF. */
export interface BankDetails {
  bankName: string
  branch: string
  bankCode: string
  accountName: string
  accountNumber: string
  swift: string
}

export interface Organization {
  id: string
  name: string
  currency: string
  fiscalYearStart: number // month 1-12
  status: OrgStatus
  rejectionReason?: string
  createdBy: string
  createdAt: Date
  // ---- Business profile / document branding (see SettingsPage.vue) ----
  /** Logo as a resized data URL (PNG/JPEG). Stored inline — no Storage bucket yet. */
  logo?: string
  /** Business location, printed in the document header beside the invoice details. */
  address?: string
  email?: string
  phone?: string
  taxId?: string
  vatNumber?: string
  bankDetails?: BankDetails
  reviewedBy?: string
  reviewedAt?: Date
  // Subscription fields (see src/stores/subscription.ts)
  plan?: 'starter' | 'standard' | 'pro'
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  billingCycle?: 'monthly' | 'annual'
  trialEndsAt?: Date | null
  currentPeriodStart?: Date | null
  currentPeriodEnd?: Date | null
  canceledAt?: Date | null
}
