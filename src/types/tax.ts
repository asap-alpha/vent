/**
 * A single tax within a tax code (e.g. "VAT", "NHIL"). A code can bundle several.
 *
 * `compound` controls the base a component is calculated on:
 *   - false → calculated on the line's tax-exclusive amount (the base)
 *   - true  → calculated on the base PLUS every component before it (the running total)
 *
 * Ghana's standard rate is the canonical example: NHIL/GETFund/COVID are levies on the
 * base (compound=false), and VAT is then charged on base+levies (compound=true).
 */
export interface TaxComponent {
  name: string
  rate: number       // percentage, e.g. 15 or 2.5
  accountId: string  // tax liability account this component posts to
  compound: boolean
}

export interface TaxCode {
  id: string
  name: string
  /** Effective total rate on the base (derived from components; cached for display/sorting). */
  rate: number
  components: TaxComponent[]
  isActive: boolean
  /** True for seeded system defaults (still editable, but marks provenance). */
  isSystem?: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Aggregated tax posted by a document, grouped by liability account. Stored on the
 * invoice/bill at save time so the posting engine can split tax across the right
 * accounts without re-resolving tax codes server-side.
 */
export interface TaxLine {
  accountId: string
  name: string
  amount: number
}
