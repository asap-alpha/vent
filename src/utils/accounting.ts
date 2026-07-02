import type { JournalLine } from '@/types/accounting'

/**
 * Round a monetary amount to 2 decimal places (currency minor units). Use at every
 * aggregation boundary so accumulated float drift doesn't leak into totals/reports.
 * (Interim measure until money is stored as integer minor units — see roadmap.)
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function totalDebits(lines: JournalLine[]): number {
  return lines.reduce((sum, line) => sum + (line.debit || 0), 0)
}

export function totalCredits(lines: JournalLine[]): number {
  return lines.reduce((sum, line) => sum + (line.credit || 0), 0)
}

export function isBalanced(lines: JournalLine[]): boolean {
  return Math.abs(totalDebits(lines) - totalCredits(lines)) < 0.005
}

export function calculateLineTotal(qty: number, unitPrice: number, taxRate: number): number {
  const subtotal = qty * unitPrice
  const tax = subtotal * (taxRate / 100)
  return subtotal + tax
}

export function calculateSubtotal(qty: number, unitPrice: number): number {
  return qty * unitPrice
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100)
}
