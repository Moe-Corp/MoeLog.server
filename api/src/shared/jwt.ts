import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Minimal HS256 JWT on top of `node:crypto`.
 *
 * This is not "rolling your own crypto": it is standard-library HMAC-SHA256
 * used the way the RFC says. What does have to be done right are JWT's three
 * well-known traps, and all three are handled explicitly here:
 *
 *  1. **Algorithm confusion.** `alg: "HS256"` is required and anything else is
 *     rejected — in particular `alg: "none"`, the textbook attack against lazy
 *     verifiers.
 *  2. **Constant-time comparison.** The signature is compared with
 *     `timingSafeEqual`; a `===` leaks the secret byte by byte.
 *  3. **Expiry.** `exp` is mandatory and always checked.
 *
 * Verification is synchronous on purpose: the guard runs in `onRequest`, before
 * routing, so there is no need to drag async through the whole chain.
 */

const b64url = (b: Buffer): string => b.toString('base64url')
const fromB64url = (s: string): Buffer => Buffer.from(s, 'base64url')

export interface Payload {
  /** User id. */
  sub: number
  /** Username, so the database is not queried on every request. */
  usr: string
  /** 'panel' = dashboard session · 'ws' = short single-use ticket. */
  typ: 'panel' | 'ws'
  /** Epoch in seconds. */
  exp: number
  iat: number
}

const sig = (data: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(data).digest()

export function sign(
  payload: Omit<Payload, 'exp' | 'iat'>,
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000)
  const body: Payload = { ...payload, iat: now, exp: now + ttlSeconds }
  const header = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const data = `${header}.${b64url(Buffer.from(JSON.stringify(body)))}`
  return `${data}.${b64url(sig(data, secret))}`
}

export function verify(token: string | undefined, secret: string): Payload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, receivedSig] = parts as [string, string, string]

  try {
    const alg = (JSON.parse(fromB64url(header).toString()) as { alg?: string }).alg
    // Trap 1: HS256 only. `none` and every asymmetric algorithm are rejected here.
    if (alg !== 'HS256') return null

    const expected = sig(`${header}.${body}`, secret)
    const received = fromB64url(receivedSig)
    // Trap 2: constant-time comparison.
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null

    const payload = JSON.parse(fromB64url(body).toString()) as Payload
    // Trap 3: expiry is mandatory.
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Extracts the token from `Authorization: Bearer …`. */
export const bearer = (header: string | undefined | null): string | undefined =>
  header?.startsWith('Bearer ') ? header.slice(7) : undefined

export const PANEL_TTL = 7 * 24 * 3600
/** The WebSocket ticket travels in the URL, so it lives as briefly as possible. */
export const WS_TTL = 60
