import type { JournalLine } from '@/types/accounting'

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
