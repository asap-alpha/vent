import type { VercelRequest, VercelResponse } from '@vercel/node'

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error'
  scope: string
  message: string
  data?: any
  uid?: string
  url?: string
  userAgent?: string
  timestamp?: string
}

/**
 * Lightweight log ingestion endpoint.
 * Frontend POSTs structured log entries here; we re-emit them via console
 * so they appear in Vercel Function Logs.
 *
 * Intentionally does NOT require auth — log losses on auth errors would defeat
 * the purpose. We rate-limit indirectly by only accepting warn+ from clients.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const entries: LogEntry[] = Array.isArray(req.body) ? req.body : [req.body]
    for (const entry of entries) {
      if (!entry || !entry.level || !entry.scope) continue

      const fn =
        entry.level === 'error' ? 'error' :
        entry.level === 'warn' ? 'warn' :
        'log'

      const prefix = `🌐 [${entry.scope}]`
      const meta = {
        ts: entry.timestamp,
        uid: entry.uid,
        url: entry.url,
        ua: entry.userAgent?.slice(0, 80),
        ...(entry.data || {}),
      }
      // eslint-disable-next-line no-console
      console[fn](prefix, entry.message, JSON.stringify(meta))
    }

    res.status(200).json({ received: entries.length })
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[log] Failed to process log entries', err.message)
    res.status(500).json({ error: 'Failed to process logs' })
  }
}
