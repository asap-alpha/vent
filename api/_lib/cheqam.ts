// Server-to-server client for Cheqam's Vent payment gateway. Cheqam routes our
// Hubtel calls because only its IP is whitelisted; we authenticate the machine
// with a shared secret (X-Vent-Api-Key), never a user token. Cheqam responds in
// camelCase, wrapping the result in an ApiResponse envelope ({ success, data }).
// The Cheqam*Data interfaces below are our PascalCase internal contract — the
// parsers normalise camelCase response fields into them.

const BASE = process.env.CHEQAM_API_BASE_URL
const KEY = process.env.CHEQAM_VENT_API_KEY

function assertConfig() {
  const missing: string[] = []
  if (!BASE) missing.push('CHEQAM_API_BASE_URL')
  if (!KEY) missing.push('CHEQAM_VENT_API_KEY')
  if (missing.length) throw new Error(`Cheqam gateway not configured. Missing: ${missing.join(', ')}`)
}

function url(path: string): string {
  return `${BASE!.replace(/\/$/, '')}${path}`
}

export interface CheqamInitiateBody {
  orgId: string
  planId: string
  billingCycle: string
  customerMsisdn: string
  channel: string
  customerName?: string
  customerEmail?: string
  description?: string
  clientReference?: string
}

// Cheqam's PaymentInitiateResponse (PascalCase), unwrapped from the envelope.
export interface CheqamInitiateData {
  Success: boolean
  TransactionId: string
  ClientReference: string
  HubtelTransactionId: string
  Status: string
  Message: string
  ErrorMessage: string
}

export async function cheqamInitiate(body: CheqamInitiateBody): Promise<CheqamInitiateData> {
  assertConfig()
  const res = await fetch(url('/api/vent/payments/initiate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Vent-Api-Key': KEY! },
    body: JSON.stringify(body),
  })
  // Read the raw body once so we can surface the real reason even when Cheqam
  // replies with a non-JSON error (HTML, 401/403/404, empty) instead of the envelope.
  const raw = await res.text()
  let envelope: any = {}
  try {
    envelope = raw ? JSON.parse(raw) : {}
  } catch {
    // non-JSON response — leave envelope empty, raw is logged below
  }
  // Cheqam's live API responds in camelCase: { success, data: { success, transactionId,
  // clientReference, hubtelTransactionId, status, message, errorMessage } }.
  const data = (envelope?.data ?? {}) as any
  if (!res.ok || data.success !== true) {
    // eslint-disable-next-line no-console
    console.error('[cheqam/initiate] gateway rejected', {
      url: url('/api/vent/payments/initiate'),
      httpStatus: res.status,
      body: raw.slice(0, 500),
    })
  }
  return {
    Success: data.success ?? false,
    TransactionId: data.transactionId ?? '',
    ClientReference: data.clientReference ?? '',
    HubtelTransactionId: data.hubtelTransactionId ?? '',
    Status: data.status ?? '',
    Message: data.message ?? envelope?.message ?? '',
    // Prefer Cheqam's own errorMessage; fall back to the HTTP status so the failure
    // is never a contentless "Payment initiation failed".
    ErrorMessage: data.errorMessage || (res.ok ? '' : `Cheqam gateway returned HTTP ${res.status}`),
  }
}


// Cheqam's PaymentStatusResponse (PascalCase), returned unwrapped.
export interface CheqamStatusData {
  ClientReference: string
  TransactionId: string
  Status: string
  Amount: number
  AmountAfterCharges: number
  Currency: string
  PaidAt: string | null
  Source: string
}

export interface CheqamStatusResult {
  httpOk: boolean
  httpStatus: number
  data: Partial<CheqamStatusData> & { error?: string }
}

export async function cheqamStatus(clientReference: string): Promise<CheqamStatusResult> {
  assertConfig()
  const ref = encodeURIComponent(clientReference)
  const res = await fetch(url(`/api/vent/payments/${ref}/status`), {
    method: 'GET',
    headers: { 'X-Vent-Api-Key': KEY! },
  })
  const envelope = await res.json().catch(() => ({} as any))
  // Same camelCase shape as initiate; unwrap the envelope and normalise to the
  // PascalCase contract the status route consumes.
  const d = (envelope?.data ?? envelope ?? {}) as any
  const data: Partial<CheqamStatusData> & { error?: string } = {
    ClientReference: d.clientReference,
    TransactionId: d.transactionId,
    Status: d.status,
    Amount: d.amount,
    AmountAfterCharges: d.amountAfterCharges,
    Currency: d.currency,
    PaidAt: d.paidAt ?? null,
    Source: d.source,
    error: d.errorMessage ?? envelope?.message,
  }
  return { httpOk: res.ok, httpStatus: res.status, data }
}
