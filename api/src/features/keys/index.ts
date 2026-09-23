import { desc, eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { newKey } from '../../shared/auth.ts'
import { db } from '../../shared/db.ts'
import { api_keys } from '../../shared/schema/index.ts'

/**
 * Ingest keys.
 *
 * They are write-only: they send events, never read them. That is why one can
 * be pasted into a `docker-compose` without granting dashboard access, and why
 * revoking one signs nobody out.
 */
export const keys = new Elysia({ prefix: '/v1/keys' })
  .get('/', () => db.select().from(api_keys).orderBy(desc(api_keys.created)))

  .post(
    '/',
    async ({ body, set }) => {
      set.status = 201
      // The full key is only returned here, at creation time.
      const [row] = await db
        .insert(api_keys)
        .values({ key: newKey(), label: body.label.trim() || 'unlabelled', created: Date.now() })
        .returning()
      return row
    },
    { body: t.Object({ label: t.String({ maxLength: 80 }) }) },
  )

  /** Revoking keeps the trail; deleting erases it. Revoking is almost always right. */
  .post('/:key/revoke', async ({ params, set }) => {
    const [row] = await db
      .update(api_keys)
      .set({ revoked: 1 })
      .where(eq(api_keys.key, params.key))
      .returning({ key: api_keys.key })
    if (!row) set.status = 404
    return row ?? { error: 'not found' }
  })

  .delete('/:key', async ({ params, set }) => {
    const [row] = await db
      .delete(api_keys)
      .where(eq(api_keys.key, params.key))
      .returning({ key: api_keys.key })
    if (!row) set.status = 404
    return row ?? { error: 'not found' }
  })
