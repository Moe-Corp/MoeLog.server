import { Elysia } from 'elysia'
import { wsTicket } from '../../shared/guard.ts'

/**
 * The dashboard's real-time channel.
 *
 * The dashboard does not poll: it subscribes here and the write side publishes
 * to the 'live' topic whenever something arrives. With this, an error happening
 * in the user's app shows up on screen without a reload.
 */
export const live = new Elysia().ws('/v1/live', {
  open(ws) {
    // The browser cannot read the httpOnly cookie, so it cannot sign the
    // connection. The SvelteKit server hands it a 60-second ticket, and that is
    // what travels in the query string.
    const ticket = new URL(ws.data.request.url).searchParams.get('t')
    const s = wsTicket(ticket)
    if (!s) {
      ws.send(JSON.stringify({ kind: 'error', data: { reason: 'invalid or expired ticket' } }))
      ws.close()
      return
    }
    ws.subscribe('live')
    ws.send(JSON.stringify({ kind: 'hello', data: { t: Date.now(), user: s.usr } }))
  },
  close(ws) {
    ws.unsubscribe('live')
  },
  message() {
    // The channel is one-way: the client sends nothing. Ignore rather than trust.
  },
})
