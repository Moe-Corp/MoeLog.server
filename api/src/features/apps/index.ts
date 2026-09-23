import { and, desc, eq, gt, isNotNull, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../../shared/db.ts'
import { alerts as alertTable, apps as appTable, events as eventTable, issues as issueTable } from '../../shared/schema/index.ts'
import { big, countWhere, hourBucket, int } from '../../shared/sql.ts'

/** READ side: one app and everything known about it. */
const errors = countWhere(sql`${eventTable.level} >= 50`)

export const apps = new Elysia({ prefix: '/v1/apps' })
  .get('/', () => db.select().from(appTable).orderBy(desc(appTable.last_seen)))

  .get(
    '/:name',
    async ({ params, set }) => {
      const [app] = await db.select().from(appTable).where(eq(appTable.name, params.name)).limit(1)
      if (!app) {
        set.status = 404
        return { error: 'not found' }
      }
      const since = Date.now() - 24 * 3600_000
      const name = params.name

      const [summary, releases, issues, alertRows, series] = await Promise.all([
        db
          .select({
            events: int(sql`count(*)`),
            errors,
            processes: int(sql`count(distinct ${eventTable.pid})`),
          })
          .from(eventTable)
          .where(eq(eventTable.app, name))
          .then((r) => r[0] ?? { events: 0, errors: 0, processes: 0 }),

        db
          .select({
            release: eventTable.release,
            events: int(sql`count(*)`),
            errors,
            first: big(sql`min(${eventTable.t})`),
            last: big(sql`max(${eventTable.t})`),
          })
          .from(eventTable)
          .where(and(eq(eventTable.app, name), isNotNull(eventTable.release)))
          .groupBy(eventTable.release)
          .orderBy(sql`max(${eventTable.t}) desc`)
          .limit(10),

        db
          .select({
            id: issueTable.id,
            fingerprint: issueTable.fingerprint,
            title: issueTable.title,
            level: issueTable.level,
            status: issueTable.status,
            count: issueTable.count,
            last_seen: issueTable.last_seen,
          })
          .from(issueTable)
          .where(and(eq(issueTable.app, name), eq(issueTable.status, 'open')))
          .orderBy(desc(issueTable.last_seen))
          .limit(10),

        db
          .select({
            id: alertTable.id,
            kind: alertTable.kind,
            pid: alertTable.pid,
            detail: alertTable.detail,
            t: alertTable.t,
          })
          .from(alertTable)
          .where(eq(alertTable.app, name))
          .orderBy(desc(alertTable.t))
          .limit(20),

        db
          .select({ hour: hourBucket(eventTable.t), errors, total: int(sql`count(*)`) })
          .from(eventTable)
          .where(and(eq(eventTable.app, name), gt(eventTable.t, since)))
          .groupBy(hourBucket(eventTable.t))
          .orderBy(hourBucket(eventTable.t)),
      ])

      return {
        app,
        summary,
        releases,
        issues,
        alerts: alertRows.map((a) => ({
          ...a,
          detail: typeof a.detail === 'string' ? JSON.parse(a.detail) : a.detail,
        })),
        series,
      }
    },
    { params: t.Object({ name: t.String() }) },
  )
