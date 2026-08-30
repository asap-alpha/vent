import type { Account, AccountSubtype, AccountType } from '@/types/accounting'

/** Subtypes valid for each account type. Equity and revenue take none. */
export const SUBTYPES_BY_TYPE: Record<AccountType, AccountSubtype[]> = {
  asset: ['current_asset', 'fixed_asset'],
  liability: ['current_liability', 'long_term_liability'],
  equity: [],
  revenue: [],
  expense: ['cost_of_sales', 'operating_expense'],
}

export const SUBTYPE_LABELS: Record<AccountSubtype, string> = {
  current_asset: 'Current Asset',
  fixed_asset: 'Fixed Asset',
  current_liability: 'Current Liability',
  long_term_liability: 'Long-Term Liability',
  cost_of_sales: 'Cost of Sales',
  operating_expense: 'Operating Expense',
}

/** Section headings used on the statements (plural form of the labels above). */
export const SUBTYPE_SECTION_LABELS: Record<AccountSubtype, string> = {
  current_asset: 'Current Assets',
  fixed_asset: 'Fixed Assets',
  current_liability: 'Current Liabilities',
  long_term_liability: 'Long-Term Liabilities',
  cost_of_sales: 'Cost of Sales',
  operating_expense: 'Expenses',
}

/** The subtype a newly created account of this type starts on. */
export function defaultSubtype(type: AccountType): AccountSubtype | null {
  return SUBTYPES_BY_TYPE[type][0] ?? null
}

export function subtypeOptions(type: AccountType) {
  return SUBTYPES_BY_TYPE[type].map((value) => ({ title: SUBTYPE_LABELS[value], value }))
}

const FIXED_ASSET_HINT =
  /\b(fixed|non[- ]?current|land|building|premises|equipment|machinery|plant|vehicle|motor|furniture|fixture|fitting|leasehold|freehold|computer hardware|depreciation)\b/i
const LONG_TERM_HINT =
  /\b(long[- ]?term|non[- ]?current|mortgage|debenture|bond payable|hire purchase|finance lease)\b/i
const COST_OF_SALES_HINT =
  /(\bcos\b|\bcogs\b|cost of (sales|goods|revenue)|direct (cost|material|labou?r)|purchases? of (goods|materials)|freight[- ]in|carriage inwards|haulage)/i

/**
 * The account's effective subtype.
 *
 * Accounts saved since the subtype field was introduced carry an explicit value, which
 * always wins — a user who classifies a loan as long-term must not have that overridden
 * by its name. Only when the field is absent (accounts created before this feature, or
 * seeded by an older chart) do we infer one from the code band and name, so that legacy
 * charts still group and subtotal correctly without a data migration. `backfillSubtypes()`
 * in the accounts store persists these inferences.
 */
export function resolveSubtype(account: Pick<Account, 'type' | 'code' | 'name' | 'subtype' | 'systemType'>): AccountSubtype | null {
  if (account.subtype && SUBTYPES_BY_TYPE[account.type].includes(account.subtype)) {
    return account.subtype
  }
  return inferSubtype(account)
}

/** Best-guess classification from the code band and account name. */
export function inferSubtype(
  account: Pick<Account, 'type' | 'code' | 'name' | 'systemType'>
): AccountSubtype | null {
  const code = Number.parseInt(account.code, 10)
  const name = account.name || ''

  switch (account.type) {
    case 'asset':
      // 14xx is the classic fixed-asset band; otherwise fall back to the name.
      if ((Number.isFinite(code) && code >= 1400 && code < 1600) || FIXED_ASSET_HINT.test(name)) {
        return 'fixed_asset'
      }
      return 'current_asset'

    case 'liability':
      // 27xx+ is the conventional long-term band. Everything else — AP, accruals,
      // tax payable, short-term loans — is current.
      if ((Number.isFinite(code) && code >= 2700 && code < 3000) || LONG_TERM_HINT.test(name)) {
        return 'long_term_liability'
      }
      return 'current_liability'

    case 'expense':
      if (
        account.systemType === 'cogs' ||
        (Number.isFinite(code) && code >= 5000 && code < 6000) ||
        COST_OF_SALES_HINT.test(name)
      ) {
        return 'cost_of_sales'
      }
      return 'operating_expense'

    default:
      return null
  }
}

/** Accounts of `subtype`, code-sorted. Resolves legacy accounts on the way through. */
export function accountsInSubtype<T extends Pick<Account, 'type' | 'code' | 'name' | 'subtype' | 'systemType'>>(
  accounts: T[],
  subtype: AccountSubtype
): T[] {
  return accounts
    .filter((a) => resolveSubtype(a) === subtype)
    .sort((a, b) => a.code.localeCompare(b.code))
}
