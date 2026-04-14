import type { BankTransactionType } from '@/types/banking'

export interface ParsedTransaction {
  date: Date
  type: BankTransactionType
  amount: number
  payee: string
  reference: string
  description: string
}

/**
 * Parse a bank statement CSV. Supports common formats:
 * - Header row: date, description, amount  (negative = withdrawal)
 * - Header row: date, description, debit, credit
 * - Header row: date, payee/payor, reference, amount
 * Auto-detects column mapping by inspecting headers.
 */
export function parseStatementCSV(text: string): ParsedTransaction[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length < 2) throw new Error('CSV must have a header and at least one data row')

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim())

  const dateIdx = findHeader(headers, ['date', 'transaction date', 'posting date'])
  const descIdx = findHeader(headers, ['description', 'narrative', 'details', 'memo'])
  const payeeIdx = findHeader(headers, ['payee', 'payor', 'merchant', 'name'])
  const refIdx = findHeader(headers, ['reference', 'ref', 'transaction id', 'id'])
  const amountIdx = findHeader(headers, ['amount'])
  const debitIdx = findHeader(headers, ['debit', 'withdrawal', 'out'])
  const creditIdx = findHeader(headers, ['credit', 'deposit', 'in'])

  if (dateIdx === -1) throw new Error('CSV must include a "date" column')
  if (amountIdx === -1 && (debitIdx === -1 || creditIdx === -1)) {
    throw new Error('CSV must include either an "amount" column or both "debit" and "credit" columns')
  }

  const rows: ParsedTransaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i])
    if (cells.length === 0) continue

    const dateStr = cells[dateIdx]
    const date = parseDate(dateStr)
    if (!date) continue

    let amount = 0
    let type: BankTransactionType = 'deposit'
    if (amountIdx !== -1) {
      const raw = cells[amountIdx] || '0'
      const num = parseAmount(raw)
      if (num >= 0) {
        amount = num
        type = 'deposit'
      } else {
        amount = Math.abs(num)
        type = 'withdrawal'
      }
    } else {
      const debit = parseAmount(cells[debitIdx] || '0')
      const credit = parseAmount(cells[creditIdx] || '0')
      if (credit > 0) {
        amount = credit
        type = 'deposit'
      } else if (debit > 0) {
        amount = debit
        type = 'withdrawal'
      }
    }

    if (amount === 0) continue

    rows.push({
      date,
      type,
      amount,
      payee: payeeIdx !== -1 ? (cells[payeeIdx] || '').trim() : '',
      reference: refIdx !== -1 ? (cells[refIdx] || '').trim() : '',
      description: descIdx !== -1 ? (cells[descIdx] || '').trim() : '',
    })
  }
  return rows
}

function findHeader(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c)
    if (idx !== -1) return idx
  }
  return -1
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += c
    }
  }
  result.push(current)
  return result
}

function parseDate(str: string): Date | null {
  const s = str.trim().replace(/['"]/g, '')
  if (!s) return null

  // ISO: YYYY-MM-DD
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))

  // DD/MM/YYYY or MM/DD/YYYY (assume DD/MM/YYYY for non-US locales)
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s)
  if (slash) {
    const a = parseInt(slash[1])
    const b = parseInt(slash[2])
    let year = parseInt(slash[3])
    if (year < 100) year += 2000
    // Heuristic: if first > 12 it's a day; otherwise assume DD/MM
    if (a > 12) return new Date(year, b - 1, a)
    return new Date(year, b - 1, a)
  }

  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function parseAmount(str: string): number {
  const cleaned = str.replace(/[^0-9.\-]/g, '')
  return parseFloat(cleaned) || 0
}
