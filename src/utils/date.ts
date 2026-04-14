import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export function formatDate(date: Date | string, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, fmt)
}

export function formatDateISO(date: Date): string {
  return format(date, 'yyyy-MM-dd')
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
