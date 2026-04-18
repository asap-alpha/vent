import admin from 'firebase-admin'

let app: admin.app.App | null = null

function getServiceAccount(): admin.ServiceAccount {
  // Firebase Admin credentials come from env vars (set in Vercel dashboard)
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    const missing: string[] = []
    if (!projectId) missing.push('FIREBASE_PROJECT_ID')
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL')
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY')
    throw new Error(`Firebase Admin not configured. Missing: ${missing.join(', ')}`)
  }

  return { projectId, clientEmail, privateKey }
}

export function getFirebaseAdmin(): admin.app.App {
  if (!app) {
    if (admin.apps.length > 0) {
      app = admin.apps[0] as admin.app.App
    } else {
      app = admin.initializeApp({
        credential: admin.credential.cert(getServiceAccount()),
      })
    }
  }
  return app
}

export function getDb() {
  return getFirebaseAdmin().firestore()
}

export async function verifyAuthToken(authHeader: string | undefined): Promise<admin.auth.DecodedIdToken> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = authHeader.slice('Bearer '.length)
  const decoded = await getFirebaseAdmin().auth().verifyIdToken(token)
  return decoded
}
