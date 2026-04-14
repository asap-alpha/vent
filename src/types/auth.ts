export type UserRole = 'owner' | 'admin' | 'accountant' | 'clerk' | 'viewer'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  organizations: string[]
  defaultOrgId: string | null
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

export interface Organization {
  id: string
  name: string
  currency: string
  fiscalYearStart: number // month 1-12
  createdBy: string
  createdAt: Date
}
