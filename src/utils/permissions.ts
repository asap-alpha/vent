import type { UserRole } from '@/types/auth'

export type Permission =
  | 'org:manage'        // edit org settings, delete org
  | 'users:manage'      // invite, change roles, remove members
  | 'accounts:write'    // CRUD chart of accounts
  | 'transactions:post' // create/post journal entries
  | 'sales:write'       // CRUD invoices, quotes, credit notes, receipts
  | 'purchases:write'   // CRUD bills, POs, debit notes, payments
  | 'banking:write'     // CRUD bank accounts, transactions, reconciliation
  | 'reports:view'      // view all reports

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'org:manage', 'users:manage',
    'accounts:write', 'transactions:post',
    'sales:write', 'purchases:write', 'banking:write',
    'reports:view',
  ],
  admin: [
    'users:manage',
    'accounts:write', 'transactions:post',
    'sales:write', 'purchases:write', 'banking:write',
    'reports:view',
  ],
  accountant: [
    'accounts:write', 'transactions:post',
    'sales:write', 'purchases:write', 'banking:write',
    'reports:view',
  ],
  clerk: [
    'sales:write', 'purchases:write',
    'reports:view',
  ],
  viewer: [
    'reports:view',
  ],
}

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function roleLabel(role: UserRole): string {
  return { owner: 'Owner', admin: 'Admin', accountant: 'Accountant', clerk: 'Clerk', viewer: 'Viewer' }[role]
}

export function roleColor(role: UserRole): string {
  return { owner: 'purple', admin: 'red', accountant: 'blue', clerk: 'green', viewer: 'grey' }[role]
}

export const ALL_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'owner', label: 'Owner', description: 'Full access; can manage org and users' },
  { value: 'admin', label: 'Admin', description: 'Full access except deleting org' },
  { value: 'accountant', label: 'Accountant', description: 'Full access to accounting modules' },
  { value: 'clerk', label: 'Clerk', description: 'Manage invoices and bills; view reports' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to reports' },
]
