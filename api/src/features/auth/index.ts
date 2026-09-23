import { eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../../shared/db.ts'
import { users } from '../../shared/schema/index.ts'
import { jwtSecret, verifyPassword } from '../../shared/auth.ts'
import { session } from '../../shared/guard.ts'
import { PANEL_TTL, WS_TTL, sign } from '../../shared/jwt.ts'

/**
 * Dashboard session.
 *
 * The token comes back in the response body and it is SvelteKit that stores it
 * in an httpOnly cookie: the browser's JavaScript never touches it.
 */
export const auth = new Elysia({ prefix: '/v1/auth' })
  .post(
    '/login',
    async ({ body, set }) => {
      const [u] = await db
        .select({ id: users.id, username: users.username, password: users.password })
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1)

      // Always verify, whether the user exists or not: verifying only when they
      // do would let response time reveal which usernames exist.
      const stored = u?.password ?? 'scrypt$00$00'
      const ok = verifyPassword(body.password, stored)

      if (!u || !ok) {
        // A small fixed delay so brute force is not an open invitation.
        await new Promise((r) => setTimeout(r, 300))
        set.status = 401
        return { error: 'wrong username or password' }
      }

      await db.update(users).set({ last_login: Date.now() }).where(eq(users.id, u.id))
      return {
        token: sign({ sub: u.id, usr: u.username, typ: 'panel' }, jwtSecret(), PANEL_TTL),
        expires_in: PANEL_TTL,
        user: { id: u.id, username: u.username },
      }
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 64 }),
        password: t.String({ minLength: 1, maxLength: 256 }),
      }),
    },
  )

  /** Who am I. The guard already rejected unauthenticated callers. */
  .get('/me', ({ headers }) => {
    const s = session(headers['authorization'])
    return { user: s ? { id: s.sub, username: s.usr } : null }
  })

  /**
   * WebSocket ticket.
   *
   * The browser cannot read the httpOnly cookie, so it cannot sign the
   * connection. The SvelteKit server requests the ticket and hands it over. It
   * lasts 60 seconds because it travels in the query string, which ends up in
   * logs and browser history.
   */
  .post('/ws-ticket', ({ headers, set }) => {
    const s = session(headers['authorization'])
    if (!s) {
      set.status = 401
      return { error: 'no session' }
    }
    return {
      ticket: sign({ sub: s.sub, usr: s.usr, typ: 'ws' }, jwtSecret(), WS_TTL),
      expires_in: WS_TTL,
    }
  })
