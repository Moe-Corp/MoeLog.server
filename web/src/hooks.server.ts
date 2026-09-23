import { json, redirect, type Handle } from '@sveltejs/kit'
import { SESSION_COOKIE, PUBLIC_ROUTES } from '$lib/session.ts'

/**
 * The dashboard's front door.
 *
 * The token lives in an httpOnly cookie: the browser's JavaScript cannot read
 * it, so an XSS does not walk away with the session. Every API call leaves from
 * the SvelteKit server, which is what attaches the header.
 *
 * All that is checked here is that a cookie EXISTS. Validity is decided by the
 * API, the only side holding the secret; if it answers 401, the helper in
 * `lib/api.ts` sends the user to the login.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(SESSION_COOKIE) ?? null
  event.locals.token = token
  event.locals.user = null

  const isPublic = PUBLIC_ROUTES.some(
    (r) => event.url.pathname === r || event.url.pathname.startsWith(`${r}/`),
  )

  if (!token && !isPublic) {
    // Internal data routes answer 401, not a redirect: whoever calls them
    // expects JSON, and following a 303 would hand them the login HTML. That is
    // what used to break the WebSocket reconnection.
    if (event.url.pathname.startsWith('/api/')) {
      return json({ error: 'no session' }, { status: 401 })
    }
    const target = event.url.pathname + event.url.search
    redirect(303, `/login?next=${encodeURIComponent(target)}`)
  }

  return resolve(event)
}
