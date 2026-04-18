import { logger, type ScopedLogger } from './logger'
import type { DocumentSnapshot, QuerySnapshot, FirestoreError } from 'firebase/firestore'

/**
 * Wraps Firestore onSnapshot callbacks with logging for snapshots and errors.
 */
export function wrapSnapshot<T extends DocumentSnapshot | QuerySnapshot>(
  scope: string,
  label: string,
  handler: (snap: T) => void
): { next: (snap: T) => void; error: (err: FirestoreError) => void } {
  const log = logger(scope)
  return {
    next: (snap) => {
      const size = (snap as any).size ?? ((snap as any).exists?.() ? 1 : 0)
      log.debug(`${label} snapshot`, { size })
      handler(snap)
    },
    error: (err) => {
      log.error(`${label} subscription error`, { code: err.code, message: err.message })
    },
  }
}

/**
 * Wraps a mutating operation (create/update/delete) with logging.
 * Returns the operation's result, throws on error.
 */
export async function logOp<T>(
  log: ScopedLogger,
  operation: string,
  detail: Record<string, any>,
  fn: () => Promise<T>
): Promise<T> {
  log.info(operation, detail)
  try {
    const result = await fn()
    log.debug(`${operation} succeeded`, detail)
    return result
  } catch (e: any) {
    log.error(`${operation} failed`, {
      ...detail,
      code: e.code,
      message: e.message,
    })
    throw e
  }
}
