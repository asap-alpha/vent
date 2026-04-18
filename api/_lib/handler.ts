import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuthToken } from './firebase'

export type ApiHandler<TBody = any> = (req: VercelRequest & { body: TBody; uid: string }, res: VercelResponse) => Promise<void>

/**
 * Wraps an API route with: POST-only, JSON body parsing, auth verification, standard error handling.
 * The handler receives `req.uid` (the authenticated user's uid) set by the wrapper.
 */
export function createHandler<TBody = any>(handler: ApiHandler<TBody>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // CORS (Vercel serves same-origin, but keep open for local dev)
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
      const decoded = await verifyAuthToken(req.headers.authorization)
      ;(req as any).uid = decoded.uid
      await handler(req as any, res)
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[API] Handler error:', err.message, err.code)
      if (err.message?.includes('Authorization') || err.code?.startsWith('auth/')) {
        res.status(401).json({ error: 'Unauthorized', message: err.message })
      } else {
        res.status(500).json({ error: 'Internal server error', message: err.message })
      }
    }
  }
}
