import { getFunctions, httpsCallable } from 'firebase/functions'
import app from '@/plugins/firebase'
import { logger } from '@/utils/logger'

const log = logger('email')
const functions = getFunctions(app)

interface SendResult {
  success: boolean
  sentTo: string
}

/**
 * Send an invoice to the customer's email via Cloud Functions + nodemailer.
 */
export async function sendInvoiceByEmail(orgId: string, invoiceId: string): Promise<SendResult> {
  log.info('Sending invoice email', { orgId, invoiceId })
  try {
    const fn = httpsCallable<{ orgId: string; invoiceId: string }, SendResult>(functions, 'sendInvoiceEmail')
    const result = await fn({ orgId, invoiceId })
    log.info('Invoice email sent', { sentTo: result.data.sentTo })
    return result.data
  } catch (e: any) {
    log.error('Send invoice email failed', { code: e.code, message: e.message })
    throw e
  }
}

/**
 * Send a bill notification to a specified email address.
 */
export async function sendBillNotificationByEmail(
  orgId: string,
  billId: string,
  recipientEmail: string
): Promise<SendResult> {
  log.info('Sending bill notification', { orgId, billId, recipientEmail })
  try {
    const fn = httpsCallable<{ orgId: string; billId: string; recipientEmail: string }, SendResult>(
      functions,
      'sendBillNotification'
    )
    const result = await fn({ orgId, billId, recipientEmail })
    log.info('Bill notification sent', { sentTo: result.data.sentTo })
    return result.data
  } catch (e: any) {
    log.error('Send bill notification failed', { code: e.code, message: e.message })
    throw e
  }
}
