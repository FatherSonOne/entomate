// Bridge request signing (EAI-08). Web Crypto only, so Node can run its tests.
//
// A signed request carries:
//   X-Ecosystem-Event-Id   the event id (also the idempotency key)
//   X-Ecosystem-Timestamp  unix seconds when it was sent
//   X-Ecosystem-Signature  v1=<hex HMAC-SHA256(secret, `${timestamp}.${eventId}.${rawBody}`)>
// The secret is the sender's shared token (our inbound_token for that app).

export const SIGNATURE_WINDOW_SECONDS = 300

const enc = new TextEncoder()

export async function signBridgeRequest(secret: string, timestamp: string, eventId: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${eventId}.${rawBody}`))
  return 'v1=' + Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('')
}

// Constant-time for equal lengths; a length mismatch is not a secret.
function equalText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type SignatureCheck =
  | { ok: true; signed: boolean }
  | { ok: false; status: 401; error: string }

export async function checkBridgeSignature(opts: {
  secret: string
  rawBody: string
  eventId: string | null
  timestamp: string | null
  signature: string | null
  requireSignature: boolean
  nowSeconds?: number
}): Promise<SignatureCheck> {
  const { secret, rawBody, eventId, timestamp, signature, requireSignature } = opts
  if (!signature) {
    // shortcut: unsigned stays allowed per sender until it signs; set
    // ecosystem_config.features.require_signature = true to refuse it.
    return requireSignature
      ? { ok: false, status: 401, error: 'Signature required' }
      : { ok: true, signed: false }
  }
  if (!eventId || !timestamp || !/^\d{1,12}$/.test(timestamp)) {
    return { ok: false, status: 401, error: 'A signed request needs X-Ecosystem-Event-Id and X-Ecosystem-Timestamp' }
  }
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > SIGNATURE_WINDOW_SECONDS) {
    return { ok: false, status: 401, error: 'Request timestamp is outside the allowed window' }
  }
  const expected = await signBridgeRequest(secret, timestamp, eventId, rawBody)
  if (!equalText(signature, expected)) {
    return { ok: false, status: 401, error: 'Invalid signature' }
  }
  return { ok: true, signed: true }
}
