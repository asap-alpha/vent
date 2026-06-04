// Server-to-server client for Cheqam's Vent payment gateway. Cheqam routes our
// Hubtel calls because only its IP is whitelisted; we authenticate the machine
// with a shared secret (X-Vent-Api-Key), never a user token. Cheqam responds in
// PascalCase, wrapping initiate in an ApiResponse envelope.

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
  if (!res.ok || envelope?.Data?.Success !== true) {
    // eslint-disable-next-line no-console
    console.error('[cheqam/initiate] gateway rejected', {
      url: url('/api/vent/payments/initiate'),
      httpStatus: res.status,
      body: raw.slice(0, 500),
    })
  }
  // Both success (200) and gateway failure (502) carry the envelope with Data.
  const data = (envelope?.Data ?? {}) as Partial<CheqamInitiateData>
  return {
    Success: data.Success ?? false,
    TransactionId: data.TransactionId ?? '',
    ClientReference: data.ClientReference ?? '',
    HubtelTransactionId: data.HubtelTransactionId ?? '',
    Status: data.Status ?? '',
    Message: data.Message ?? envelope?.Message ?? '',
    // When Cheqam returns no envelope (e.g. 401/403/404/HTML), expose the HTTP
    // status so the failure isn't a contentless "Payment initiation failed".
    ErrorMessage: data.ErrorMessage ?? (res.ok ? '' : `Cheqam gateway returned HTTP ${res.status}`),
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
  const data = await res.json().catch(() => ({} as any))
  return { httpOk: res.ok, httpStatus: res.status, data }
}
