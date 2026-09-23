import { Elysia } from 'elysia'
import { validKey, jwtSecret } from './auth.ts'
import { bearer, verify, type Payload } from './jwt.ts'

/**
 * The server's authentication boundary.
 *
 * It lives in `onRequest`, which runs BEFORE routing and before body or query
 * validation. In `beforeHandle`, an unauthenticated caller could probe the
 * schemas through 422 responses — exactly the problem ingestion had before it
 * was moved here.
 *
 * Session verification stays synchronous: the signing secret is loaded into
 * memory at boot precisely so this hook never has to wait on the database.
 * Ingest keys do have to be looked up, which is the one await on the path.
 *
 * Three kinds of access, three different keys:
 *
 *  - **Public**: `/health` and `/v1/status`. Nothing.
 *  - **Write**: `POST /v1/ingest` and `/v1/alerts`. An ingest key.
 *  - **Dashboard**: everything else. A session JWT.
 */

const PUBLIC = new Set(['/health', '/v1/status', '/v1/auth/login'])
const WRITE = new Set(['/v1/ingest', '/v1/alerts'])

export const session = (auth: string | null | undefined): Payload | null => {
  const p = verify(bearer(auth), jwtSecret())
  // A WebSocket ticket is not valid for calling the API: different scopes.
  return p?.typ === 'panel' ? p : null
}

export const wsTicket = (token: string | null | undefined): Payload | null => {
  const p = verify(token ?? undefined, jwtSecret())
  return p?.typ === 'ws' ? p : null
}

export const guard = new Elysia().onRequest(async ({ request, set }) => {
  const url = new URL(request.url)
  const route = url.pathname

  if (PUBLIC.has(route)) return undefined
  // The WebSocket authenticates during the handshake, with its own ticket.
  if (route === '/v1/live') return undefined

  if (WRITE.has(route) && request.method === 'POST') {
    if (await validKey(request.headers.get('x-moelog-key') ?? undefined)) return undefined
    set.status = 401
    return { error: 'invalid or revoked ingest key' }
  }

  if (session(request.headers.get('authorization'))) return undefined

  set.status = 401
  return { error: 'session required' }
})
