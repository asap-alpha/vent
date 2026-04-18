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

export interface Organization {
  id: string
  name: string
  currency: string
  fiscalYearStart: number // month 1-12
  status: OrgStatus
  rejectionReason?: string
  createdBy: string
  createdAt: Date
  reviewedBy?: string
  reviewedAt?: Date
}
