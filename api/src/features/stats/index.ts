import { and, asc, gt, inArray, lte, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { db } from '../../shared/db.ts'
import { alerts as alertTable, apps as appTable, events as eventTable, issues as issueTable } from '../../shared/schema/index.ts'
import { countWhere, hourBucket, int } from '../../shared/sql.ts'

/**
 * READ side: the numbers on the front page.
 *
 * Every field here shows up on a dashboard card. If a number cannot honestly
 * be computed, it is not invented: the card is removed instead.
 */
const SEVERE = ['app.fatal', 'app.crashed', 'app.failed_to_start', 'app.exited_error']

const errors = countWhere(sql`${eventTable.level} >= 50`)
const rows = int(sql`count(*)`)

const one = async (q: Promise<Array<{ n: number }>>): Promise<number> => (await q)[0]?.n ?? 0

export const stats = new Elysia({ prefix: '/v1' }).get('/stats', async () => {
  const now = Date.now()
  const since = now - 24 * 3600_000
  const previous = now - 48 * 3600_000

  const [series, levels, events_total, events_24h, events_prev_24h, open_issues, critical_issues, alerts_24h, severe_alerts_24h, apps] =
    await Promise.all([
      db
        .select({ hour: hourBucket(eventTable.t), errors, total: rows })
        .from(eventTable)
        .where(gt(eventTable.t, since))
        .groupBy(hourBucket(eventTable.t))
        .orderBy(hourBucket(eventTable.t)),

      db
        .select({ level: eventTable.level, n: rows })
        .from(eventTable)
        .where(gt(eventTable.t, since))
        .groupBy(eventTable.level)
        .orderBy(asc(eventTable.level)),

      one(db.select({ n: rows }).from(eventTable)),
      one(db.select({ n: rows }).from(eventTable).where(and(gt(eventTable.t, since), lte(eventTable.t, now)))),
      one(db.select({ n: rows }).from(eventTable).where(and(gt(eventTable.t, previous), lte(eventTable.t, since)))),
      one(db.select({ n: rows }).from(issueTable).where(sql`${issueTable.status} = 'open'`)),
      one(db.select({ n: rows }).from(issueTable).where(sql`${issueTable.status} = 'open' and ${issueTable.level} >= 60`)),
      one(db.select({ n: rows }).from(alertTable).where(gt(alertTable.t, since))),
      one(db.select({ n: rows }).from(alertTable).where(and(gt(alertTable.t, since), inArray(alertTable.kind, SEVERE)))),

      db
        .select({
          name: appTable.name,
          runtime: appTable.runtime,
          release: appTable.release,
          env: appTable.env,
          first_seen: appTable.first_seen,
          last_seen: appTable.last_seen,
        })
        .from(appTable)
        .orderBy(sql`${appTable.last_seen} desc`),
    ])

  return {
    since,
    now,
    by_level: levels,
    // All-time total and the 24 h window are different things, and the panel
    // shows both.
    events_total,
    events_24h,
    events_prev_24h,
    /** Busiest hour in the window. Zero when nothing happened. */
    peak_hour: series.length > 0 ? Math.max(...series.map((r) => r.total)) : 0,
    errors_24h: levels.filter((x) => x.level >= 50).reduce((a, x) => a + x.n, 0),
    open_issues,
    critical_issues,
    alerts_24h,
    severe_alerts_24h,
    apps,
    series,
  }
})
