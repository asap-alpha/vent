import { reactive } from 'vue'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  timestamp: Date
  level: LogLevel
  scope: string
  message: string
  data?: any
}

// Reactive ring buffer — bounded to prevent memory leaks
const MAX_LOGS = 500
export const logs = reactive<{ entries: LogEntry[] }>({ entries: [] })
let nextId = 1

// Level thresholds
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function minLevel(): LogLevel {
  // Local override via localStorage (dev tools: localStorage.setItem('vent:logLevel', 'debug'))
  const override = typeof localStorage !== 'undefined' ? localStorage.getItem('vent:logLevel') : null
  if (override && override in LEVEL_ORDER) return override as LogLevel
  return import.meta.env.DEV ? 'debug' : 'info'
}

const SCOPE_COLORS: Record<string, string> = {
  auth: '#1976D2',
  org: '#7B1FA2',
  router: '#00796B',
  firebase: '#F57F17',
  accounts: '#388E3C',
  transactions: '#388E3C',
  customers: '#1565C0',
  invoices: '#1565C0',
  suppliers: '#C62828',
  bills: '#C62828',
  banking: '#F57C00',
  diagnostics: '#5D4037',
}

function consoleMethod(level: LogLevel): 'log' | 'info' | 'warn' | 'error' {
  if (level === 'debug') return 'log'
  return level
}

function emit(level: LogLevel, scope: string, message: string, data?: any) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return

  const entry: LogEntry = {
    id: nextId++,
    timestamp: new Date(),
    level,
    scope,
    message,
    data,
  }

  // Push to ring buffer
  logs.entries.push(entry)
  if (logs.entries.length > MAX_LOGS) {
    logs.entries.splice(0, logs.entries.length - MAX_LOGS)
  }

  // Console output with color-coded scope
  const color = SCOPE_COLORS[scope] || '#616161'
  const timestamp = entry.timestamp.toTimeString().slice(0, 8)
  const method = consoleMethod(level)
  // eslint-disable-next-line no-console
  console[method](
    `%c${timestamp}%c [${scope}]%c ${message}`,
    'color: #999; font-weight: normal',
    `color: ${color}; font-weight: bold`,
    'color: inherit',
    data !== undefined ? data : ''
  )
}

export interface ScopedLogger {
  debug(message: string, data?: any): void
  info(message: string, data?: any): void
  warn(message: string, data?: any): void
  error(message: string, data?: any): void
}

export function logger(scope: string): ScopedLogger {
  return {
    debug: (msg, data) => emit('debug', scope, msg, data),
    info: (msg, data) => emit('info', scope, msg, data),
    warn: (msg, data) => emit('warn', scope, msg, data),
    error: (msg, data) => emit('error', scope, msg, data),
  }
}

export function clearLogs() {
  logs.entries.splice(0, logs.entries.length)
}
