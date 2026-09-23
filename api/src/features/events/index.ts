import { and, desc, eq, gte } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../../shared/db.ts'
import { events as eventTable } from '../../shared/schema/index.ts'
import { contains } from '../../shared/sql.ts'

/** READ side: the raw event stream, for the logs view. */
const columns = {
  id: eventTable.id,
  issue_id: eventTable.issue_id,
  app: eventTable.app,
  type: eventTable.type,
  level: eventTable.level,
  msg: eventTable.msg,
  ctx: eventTable.ctx,
  frames: eventTable.frames,
  release: eventTable.release,
  runtime: eventTable.runtime,
  pid: eventTable.pid,
  t: eventTable.t,
}

const json = (v: unknown): unknown => (typeof v === 'string' ? JSON.parse(v) : v)

export const events = new Elysia({ prefix: '/v1/events' }).get(
  '/',
  async ({ query }) => {
    const rows = await db
      .select(columns)
      .from(eventTable)
      .where(
        and(
          query.app ? eq(eventTable.app, query.app) : undefined,
          query.level === undefined ? undefined : gte(eventTable.level, Number(query.level)),
          query.q ? contains(eventTable.msg, query.q) : undefined,
        ),
      )
      .orderBy(desc(eventTable.t))
      .limit(Number(query.limit ?? 100))

    return rows.map((e) => ({ ...e, ctx: json(e.ctx), frames: json(e.frames) }))
  },
  {
    query: t.Object({
      app: t.Optional(t.String()),
      level: t.Optional(t.Numeric()),
      q: t.Optional(t.String()),
      limit: t.Optional(t.Numeric({ maximum: 500 })),
    }),
  },
)
