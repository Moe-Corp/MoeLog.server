import { sql } from 'drizzle-orm'
import { transaction } from '../../shared/db.ts'
import { alerts, apps, events, issues } from '../../shared/schema/index.ts'
import { greatest } from '../../shared/sql.ts'
import { db } from '../../shared/db.ts'
import type { NormalizedEvent } from '../../shared/mlwp.ts'

export interface BatchContext {
  app: string
  release: string | null
  env: string | null
  runtime: string | null
  pid: number | null
  sdk: string
}

export interface Saved {
  event: Record<string, unknown>
  issue: Record<string, unknown> | null
}

/** Readable issue title: "TypeError: x is not a function". */
function title(e: NormalizedEvent): string {
  const name = typeof e.ctx?.['name'] === 'string' ? (e.ctx['name'] as string) : null
  if (!name || e.msg.startsWith(name)) return e.msg.slice(0, 300)
  return `${name}: ${e.msg}`.slice(0, 300)
}

/**
 * Writes a whole batch in one transaction.
 *
 * All or nothing: a half-written envelope would be worse than a rejected one,
 * because the SDK already considers it delivered and will not retry. See
 * `shared/db.ts` for how the transaction is held on each engine.
 */
export function saveBatch(
  batch: NormalizedEvent[],
  ctx: BatchContext,
  received: number,
): Promise<Saved[]> {
  return transaction(async (tx) => {
    await tx
      .insert(apps)
      .values({
        name: ctx.app,
        runtime: ctx.runtime,
        release: ctx.release,
        env: ctx.env,
        first_seen: received,
        last_seen: received,
      })
      .onConflictDoUpdate({
        target: apps.name,
        set: {
          runtime: sql`excluded.runtime`,
          release: sql`excluded.release`,
          env: sql`excluded.env`,
          last_seen: sql`excluded.last_seen`,
        },
      })

    const out: Saved[] = []
    for (const e of batch) {
      let issue: Record<string, unknown> | null = null

      // Only errors get grouped into issues. An info log is not an "issue".
      if (e.type === 1 && e.fingerprint) {
        const [row] = await tx
          .insert(issues)
          .values({
            app: ctx.app,
            fingerprint: e.fingerprint,
            title: title(e),
            level: e.level,
            release: ctx.release,
            count: 1,
            first_seen: e.t,
            last_seen: e.t,
          })
          .onConflictDoUpdate({
            target: [issues.app, issues.fingerprint],
            set: {
              count: sql`${issues.count} + 1`,
              last_seen: sql`excluded.last_seen`,
              level: greatest(issues.level, sql`excluded.level`),
              // A resolved issue that happens again reopens: that is information, not noise.
              status: sql`case when ${issues.status} = 'resolved' then 'open' else ${issues.status} end`,
            },
          })
          .returning({
            id: issues.id,
            count: issues.count,
            status: issues.status,
            first_seen: issues.first_seen,
          })
        issue = row ?? null
      }

      const [row] = await tx
        .insert(events)
        .values({
          issue_id: (issue?.['id'] as number | undefined) ?? null,
          app: ctx.app,
          type: e.type,
          level: e.level,
          msg: e.msg,
          ctx: e.ctx ? JSON.stringify(e.ctx) : null,
          frames: e.frames ? JSON.stringify(e.frames) : null,
          fingerprint: e.fingerprint,
          release: ctx.release,
          env: ctx.env,
          runtime: ctx.runtime,
          pid: ctx.pid,
          sdk: ctx.sdk,
          t: e.t,
          received,
        })
        .returning({ id: events.id })

      out.push({
        event: {
          id: row?.id ?? null,
          issue_id: (issue?.['id'] as number | undefined) ?? null,
          app: ctx.app,
          type: e.type,
          level: e.level,
          msg: e.msg,
          ctx: e.ctx,
          frames: e.frames,
          fingerprint: e.fingerprint,
          release: ctx.release,
          runtime: ctx.runtime,
          t: e.t,
        },
        issue: issue
          ? { ...issue, app: ctx.app, title: title(e), fingerprint: e.fingerprint }
          : null,
      })
    }
    return out
  })
}

export async function saveAlert(
  a: Record<string, unknown>,
  received: number,
): Promise<Record<string, unknown>> {
  const { kind, t, app, pid, ...rest } = a
  const at = Number(t) || received
  const [row] = await db
    .insert(alerts)
    .values({
      kind: String(kind),
      app: (app as string | undefined) ?? null,
      pid: (pid as number | undefined) ?? null,
      detail: JSON.stringify(rest),
      t: at,
      received,
    })
    .returning({ id: alerts.id })

  return { id: row?.id ?? null, kind, app: app ?? null, pid: pid ?? null, t: at, detail: rest }
}
