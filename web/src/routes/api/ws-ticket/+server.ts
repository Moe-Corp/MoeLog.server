import { json } from '@sveltejs/kit'
import { API } from '$lib/server/config.ts'
import type { RequestHandler } from './$types'

/**
 * Ticket for opening the WebSocket.
 *
 * The client cannot sign the connection because the cookie is httpOnly, so it
 * asks here. The ticket lasts 60 seconds and is renewed on every reconnection:
 * if it lasted as long as the session, a URL copied out of the proxy logs would
 * be enough to listen to the stream for a week.
 */
export const GET: RequestHandler = async ({ locals, fetch }) => {
  if (!locals.token) return json({ error: 'no session' }, { status: 401 })

  const r = await fetch(`${API}/v1/auth/ws-ticket`, {
    method: 'POST',
    headers: { authorization: `Bearer ${locals.token}` },
  })
  if (!r.ok) return json({ error: 'could not issue the ticket' }, { status: r.status })
  return json(await r.json())
}
