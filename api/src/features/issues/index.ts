import { and, desc, eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../../shared/db.ts'
import { events as eventTable, issues as issueTable } from '../../shared/schema/index.ts'

/**
 * READ side: issues (errors grouped by fingerprint).
 *
 * A different access pattern, different queries, different indexes. That is why
 * it lives apart from ingestion even though it touches the same tables: when
 * volume forces the read path onto rollups or another database, this file is
 * the only one that changes.
 */
const summary = {
  id: issueTable.id,
  app: issueTable.app,
  fingerprint: issueTable.fingerprint,
  title: issueTable.title,
  level: issueTable.level,
  status: issueTable.status,
  count: issueTable.count,
  release: issueTable.release,
  first_seen: issueTable.first_seen,
  last_seen: issueTable.last_seen,
}

const occurrence = {
  id: eventTable.id,
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

export const issues = new Elysia({ prefix: '/v1/issues' })
  .get(
    '/',
    ({ query }) =>
      db
        .select(summary)
        .from(issueTable)
        .where(
          and(
            query.app ? eq(issueTable.app, query.app) : undefined,
            query.status ? eq(issueTable.status, query.status) : undefined,
          ),
        )
        .orderBy(desc(issueTable.last_seen))
        .limit(Number(query.limit ?? 50)),
    {
      query: t.Object({
        app: t.Optional(t.String()),
        status: t.Optional(t.Union([t.Literal('open'), t.Literal('resolved'), t.Literal('ignored')])),
        limit: t.Optional(t.Numeric({ maximum: 200 })),
      }),
    },
  )

  .get(
    '/:id',
    async ({ params, query, set }) => {
      const [issue] = await db.select().from(issueTable).where(eq(issueTable.id, params.id)).limit(1)
      if (!issue) {
        set.status = 404
        return { error: 'not found' }
      }
      const rows = await db
        .select(occurrence)
        .from(eventTable)
        .where(eq(eventTable.issue_id, params.id))
        .orderBy(desc(eventTable.t))
        .limit(Number(query.limit ?? 25))

      return { issue, events: rows.map((e) => ({ ...e, ctx: json(e.ctx), frames: json(e.frames) })) }
    },
    { params: t.Object({ id: t.Numeric() }), query: t.Object({ limit: t.Optional(t.Numeric()) }) },
  )

  .patch(
    '/:id',
    async ({ params, body, set }) => {
      const [row] = await db
        .update(issueTable)
        .set({ status: body.status })
        .where(eq(issueTable.id, params.id))
        .returning()
      if (!row) {
        set.status = 404
        return { error: 'not found' }
      }
      return row
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        status: t.Union([t.Literal('open'), t.Literal('resolved'), t.Literal('ignored')]),
      }),
    },
  )
