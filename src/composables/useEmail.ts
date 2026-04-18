import { auth } from '@/plugins/firebase'
import { logger } from '@/utils/logger'

const log = logger('email')

interface SendResult {
  success: boolean
  sentTo?: string
  error?: string
}

/**
 * Get the current user's Firebase ID token to authenticate the API request.
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return await user.getIdToken()
}

/**
 * POST to a Vercel API route with Firebase auth.
 */
async function callApi<T extends SendResult>(endpoint: string, body: Record<string, any>): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || data.message || `API request failed: ${res.status}`)
  }
  return data as T
}

/**
 * Send invitation email. Typically called automatically from inviteMember.
 */
export async function sendInvitationByEmail(invitationId: string): Promise<SendResult> {
  log.info('Sending invitation email', { invitationId })
  try {
    const result = await callApi<SendResult>('/api/send-invitation', { invitationId })
    log.info('Invitation email sent', { sentTo: result.sentTo })
    return result
  } catch (e: any) {
    log.error('Send invitation email failed', { message: e.message })
    throw e
  }
}

/**
 * Send welcome email after registration.
 */
export async function sendWelcomeByEmail(): Promise<SendResult> {
  log.info('Sending welcome email')
  try {
    const result = await callApi<SendResult>('/api/send-welcome', {})
    log.info('Welcome email sent', { sentTo: result.sentTo })
    return result
  } catch (e: any) {
    log.error('Send welcome email failed', { message: e.message })
    throw e
  }
}

/**
 * Send an invoice to the customer's email.
 */
export async function sendInvoiceByEmail(orgId: string, invoiceId: string): Promise<SendResult> {
  log.info('Sending invoice email', { orgId, invoiceId })
  try {
    const result = await callApi<SendResult>('/api/send-invoice', { orgId, invoiceId })
    log.info('Invoice email sent', { sentTo: result.sentTo })
    return result
  } catch (e: any) {
    log.error('Send invoice email failed', { message: e.message })
    throw e
  }
}

/**
 * Send payment receipt to customer. Typically called automatically after recordReceipt.
 */
export async function sendPaymentReceiptByEmail(orgId: string, receiptId: string): Promise<SendResult> {
  log.info('Sending payment receipt email', { orgId, receiptId })
  try {
    const result = await callApi<SendResult>('/api/send-payment-receipt', { orgId, receiptId })
    log.info('Payment receipt email sent', { sentTo: result.sentTo })
    return result
  } catch (e: any) {
    log.error('Send payment receipt email failed', { message: e.message })
    throw e
  }
}

/**
 * Send bill notification to a specified email address.
 */
export async function sendBillNotificationByEmail(
  orgId: string,
  billId: string,
  recipientEmail: string
): Promise<SendResult> {
  log.info('Sending bill notification', { orgId, billId, recipientEmail })
  try {
    const result = await callApi<SendResult>('/api/send-bill-notification', { orgId, billId, recipientEmail })
    log.info('Bill notification sent', { sentTo: result.sentTo })
    return result
  } catch (e: any) {
    log.error('Send bill notification failed', { message: e.message })
    throw e
  }
}
