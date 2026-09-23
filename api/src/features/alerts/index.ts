import { desc, eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../../shared/db.ts'
import { alerts as alertTable } from '../../shared/schema/index.ts'

/** READ side: crashes, blocks and failed startups. */
export const alerts = new Elysia({ prefix: '/v1/alerts' }).get(
  '/',
  async ({ query }) => {
    const rows = await db
      .select({
        id: alertTable.id,
        kind: alertTable.kind,
        app: alertTable.app,
        pid: alertTable.pid,
        detail: alertTable.detail,
        t: alertTable.t,
      })
      .from(alertTable)
      .where(query.app ? eq(alertTable.app, query.app) : undefined)
      .orderBy(desc(alertTable.t))
      .limit(Number(query.limit ?? 50))

    return rows.map((a) => ({ ...a, detail: typeof a.detail === 'string' ? JSON.parse(a.detail) : a.detail }))
  },
  { query: t.Object({ app: t.Optional(t.String()), limit: t.Optional(t.Numeric({ maximum: 200 })) }) },
)
