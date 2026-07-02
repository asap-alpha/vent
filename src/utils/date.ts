import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export function formatDate(date: Date | string, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, fmt)
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Parse a 'YYYY-MM-DD' input as LOCAL midnight. `new Date('YYYY-MM-DD')` parses as
 * UTC midnight, which shifts the day for anyone behind UTC and drops boundary-day
 * entries from reports. Use this for point/stored dates.
 */
export function startOfLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** Local end-of-day for inclusive "as of" / "to" report boundaries. */
export function endOfLocalDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

export function getCurrentPeriod() {
  const now = new Date()
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  }
}

export function getPreviousPeriod(months = 1) {
  const now = new Date()
  const start = startOfMonth(subMonths(now, months))
  const end = endOfMonth(subMonths(now, 1))
  return { start, end }
}

export function getFiscalYear(fiscalYearStartMonth: number, year?: number) {
  const now = new Date()
  const currentYear = year || now.getFullYear()
  const start = new Date(currentYear, fiscalYearStartMonth - 1, 1)
  const end = endOfMonth(new Date(currentYear + (fiscalYearStartMonth === 1 ? 0 : 1), (fiscalYearStartMonth - 2 + 12) % 12, 1))
  return { start, end }
}

export function getAgingBuckets(dueDate: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'current'
  if (diff <= 30) return '1-30'
  if (diff <= 60) return '31-60'
  if (diff <= 90) return '61-90'
  return '90+'
}
