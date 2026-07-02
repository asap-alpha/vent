import { round2 } from './accounting'
import type { TaxComponent, TaxCode } from '@/types/tax'

export interface ComputedTaxComponent {
  name: string
  accountId: string
  rate: number
  amount: number
}

export interface TaxBreakdown {
  components: ComputedTaxComponent[]
  total: number
}

/**
 * Compute the tax on a tax-exclusive `base` for an ordered list of components.
 *
 * Non-compound components are charged on the base; compound components are charged on
 * the base plus every component computed before them (the running taxable total). This
 * models stacked taxes like Ghana's VAT-on-levies. Components are processed in array
 * order, so put base-level levies first and compound taxes (VAT) after.
 */
export function computeTaxBreakdown(base: number, components: TaxComponent[]): TaxBreakdown {
  let runningTaxable = base
  let total = 0
  const out: ComputedTaxComponent[] = []
  for (const c of components) {
    const taxable = c.compound ? runningTaxable : base
    const amount = round2(taxable * ((c.rate || 0) / 100))
    out.push({ name: c.name, accountId: c.accountId, rate: c.rate, amount })
    runningTaxable = round2(runningTaxable + amount)
    total = round2(total + amount)
  }
  return { components: out, total }
}

/**
 * The effective total tax rate a code applies to a base amount (e.g. Ghana's standard
 * VAT + levies works out to 21.9%). Because every component is a linear function of the
 * base, this single rate reproduces the exact total — handy for line amount display —
 * while the component breakdown is still used for posting and tax reporting.
 */
export function effectiveTaxRate(components: TaxComponent[]): number {
  return round2(computeTaxBreakdown(100, components).total)
}

/** Convenience: total tax for a base using a whole tax code. */
export function taxCodeAmount(base: number, code: TaxCode | undefined): number {
  if (!code) return 0
  return computeTaxBreakdown(base, code.components).total
}
