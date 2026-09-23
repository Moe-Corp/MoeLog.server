import { and, between, desc, eq } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../../shared/db.ts'
import { alerts as alertTable, events as eventTable } from '../../shared/schema/index.ts'

/**
 * Incidents: alerts grouped by occurrence.
 *
 * An `app.blocked` followed by its `app.recovered` is ONE incident that lasted
 * N milliseconds, not two things that happened. Grouping it on the server — and
 * not in each screen — keeps the dashboard and the future alerting API from
 * counting differently.
 */
const columns = {
  id: alertTable.id,
  kind: alertTable.kind,
  app: alertTable.app,
  pid: alertTable.pid,
  detail: alertTable.detail,
  t: alertTable.t,
}

const latest = (limit: number) =>
  db.select(columns).from(alertTable).orderBy(desc(alertTable.t)).limit(limit)

/** Events from the same app around the incident: the autopsy's context. */
const around = (app: string, from: number, to: number) =>
  db
    .select({
      id: eventTable.id,
      issue_id: eventTable.issue_id,
      type: eventTable.type,
      level: eventTable.level,
      msg: eventTable.msg,
      ctx: eventTable.ctx,
      frames: eventTable.frames,
      runtime: eventTable.runtime,
      pid: eventTable.pid,
      t: eventTable.t,
    })
    .from(eventTable)
    .where(and(eq(eventTable.app, app), between(eventTable.t, from, to)))
    .orderBy(desc(eventTable.t))
    .limit(40)

interface Row {
  id: number
  kind: string
  app: string | null
  pid: number | null
  detail: string | null
  t: number
}

const json = (v: unknown): Record<string, unknown> =>
  typeof v === 'string' ? (JSON.parse(v) as Record<string, unknown>) : ((v ?? {}) as Record<string, unknown>)

export interface Incident {
  id: number
  kind: string
  app: string | null
  pid: number | null
  opened: number
  closed: number | null
  duration_ms: number | null
  resolved: boolean
  detail: Record<string, unknown>
  closing: Record<string, unknown> | null
}

function group(rows: Row[]): Incident[] {
  const out: Incident[] = []
  const recoveries = new Map<string, Row>()

  // Walked newest to oldest: the recovery is seen before the block that caused
  // it, so it is held until its counterpart shows up.
  for (const r of rows) {
    const key = `${r.app}:${r.pid}`
    if (r.kind === 'app.recovered') {
      recoveries.set(key, r)
      continue
    }

    const closing = r.kind === 'app.blocked' ? recoveries.get(key) : undefined
    if (closing) recoveries.delete(key)

    out.push({
      id: r.id,
      kind: r.kind,
      app: r.app,
      pid: r.pid,
      opened: r.t,
      closed: closing?.t ?? null,
      duration_ms: closing ? closing.t - r.t : null,
      resolved: Boolean(closing),
      detail: json(r.detail),
      closing: closing ? json(closing.detail) : null,
    })
  }

  // A recovery with no visible block (it fell outside the limit) is still
  // shown: hiding it would suggest the app never recovered.
  for (const r of recoveries.values()) {
    out.push({
      id: r.id, kind: r.kind, app: r.app, pid: r.pid, opened: r.t,
      closed: null, duration_ms: null, resolved: true, detail: json(r.detail), closing: null,
    })
  }

  return out.sort((a, b) => b.opened - a.opened)
}

export const incidents = new Elysia({ prefix: '/v1/incidents' })
  .get(
    '/',
    async ({ query }) => group(await latest(Number(query.limit ?? 150))),
    { query: t.Object({ limit: t.Optional(t.Numeric({ maximum: 500 })) }) },
  )

  /** Autopsy: the incident plus the context of what was going on around it. */
  .get(
    '/:id',
    async ({ params, set }) => {
      const [r] = await db.select(columns).from(alertTable).where(eq(alertTable.id, params.id)).limit(1)
      if (!r) {
        set.status = 404
        return { error: 'not found' }
      }
      const rest = (await latest(150)).filter((x) => x.id !== r.id)
      const [incident] = group([r, ...rest])
      const window = 5 * 60_000

      // An alert with no app cannot have surrounding context: there is nothing
      // to look it up by.
      const rows = r.app ? await around(r.app, r.t - window, r.t + window) : []
      const context = rows.map((e) => ({
        ...e,
        ctx: e.ctx ? JSON.parse(e.ctx) : null,
        frames: e.frames ? JSON.parse(e.frames) : null,
      }))

      return { incident, context, window_ms: window }
    },
    { params: t.Object({ id: t.Numeric() }) },
  )
