import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { setting } from '../../shared/auth.ts'
import { db } from '../../shared/db.ts'
import { alerts as alertTable, apps as appTable } from '../../shared/schema/index.ts'
import { int } from '../../shared/sql.ts'

/**
 * PUBLIC status page. The only read route without a session.
 *
 * It exposes the minimum: which apps exist, whether they are reporting, and how
 * many incidents they had. **Never** error messages, stacks, file paths or
 * context — that is exactly what must not leave the internal network.
 */

/**
 * Same kinds everywhere on this page, on purpose: if a block spends a clean hour
 * but does not count as an incident, the two numbers contradict each other on
 * screen and the reader cannot tell which to believe. A blocked event loop is
 * an incident: the app was not serving.
 */
const INCIDENT = ['app.fatal', 'app.crashed', 'app.failed_to_start', 'app.exited_error', 'app.blocked']
/** A crash is worth naming; a block that recovered is not "the last incident". */
const FATAL = ['app.fatal', 'app.crashed', 'app.failed_to_start', 'app.exited_error']

const since = (app: string, from: number) =>
  and(eq(alertTable.app, app), gt(alertTable.t, from), inArray(alertTable.kind, INCIDENT))

/**
 * Clean hours, not "uptime".
 *
 * MoeLog does not measure availability: it measures whether the process emitted
 * failure signals. Calling this "99.99% uptime" would be inventing a
 * measurement nobody took. The name says exactly what the number is.
 */
const hoursWithIncident = async (app: string, from: number): Promise<number> => {
  const [row] = await db
    .select({ n: int(sql`count(distinct (${alertTable.t} / 3600000))`) })
    .from(alertTable)
    .where(since(app, from))
  return row?.n ?? 0
}

const incidentsSince = async (app: string, from: number): Promise<number> => {
  const [row] = await db.select({ n: int(sql`count(*)`) }).from(alertTable).where(since(app, from))
  return row?.n ?? 0
}

const lastIncident = async (app: string) => {
  const [row] = await db
    .select({ kind: alertTable.kind, t: alertTable.t })
    .from(alertTable)
    .where(and(eq(alertTable.app, app), inArray(alertTable.kind, FATAL)))
    .orderBy(desc(alertTable.t))
    .limit(1)
  return row ?? null
}

export const status = new Elysia().get('/v1/status', async () => {
  const now = Date.now()
  const day = now - 24 * 3600_000
  const week = now - 7 * 24 * 3600_000

  const list = await db
    .select({ name: appTable.name, last_seen: appTable.last_seen })
    .from(appTable)
    .orderBy(asc(appTable.name))

  const services = await Promise.all(
    list.map(async (a) => {
      const [withIncident24, withIncident7d, incidents24, incidents7d, last] = await Promise.all([
        hoursWithIncident(a.name, day),
        hoursWithIncident(a.name, week),
        incidentsSince(a.name, day),
        incidentsSince(a.name, week),
        lastIncident(a.name),
      ])
      const alive = now - a.last_seen < 60_000

      return {
        name: a.name,
        // Three states, not two: each service's chip has to agree with the banner
        // above it or the page contradicts itself.
        state: !alive ? 'no signal' : incidents24 > 0 ? 'degraded' : 'operational',
        last_seen: a.last_seen,
        incidents_24h: incidents24,
        incidents_7d: incidents7d,
        clean_hours_24h: Math.max(0, 24 - withIncident24),
        clean_hours_7d: Math.max(0, 168 - withIncident7d),
        last_incident: last,
      }
    }),
  )

  const degraded = services.filter((s) => s.state !== 'operational')
  const [title, description, published] = await Promise.all([
    setting('status_title'),
    setting('status_description'),
    setting('status_published'),
  ])

  return {
    title: title ?? 'Service status',
    description: description ?? '',
    published: published !== '0',
    generated: now,
    global: degraded.length === 0 ? 'operational' : 'degraded',
    services,
  }
})
