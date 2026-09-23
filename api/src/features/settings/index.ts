import { Elysia, t } from 'elysia'
import { setSetting, setting } from '../../shared/auth.ts'
import { emit } from '../../shared/bus.ts'
import { db } from '../../shared/db.ts'
import { alerts } from '../../shared/schema/index.ts'

const KEYS = ['status_title', 'status_description', 'status_published'] as const

const readAll = async (): Promise<Record<string, string | null>> =>
  Object.fromEntries(await Promise.all(KEYS.map(async (k) => [k, await setting(k)] as const)))

export const settings = new Elysia({ prefix: '/v1/settings' })
  .get('/', () => readAll())

  .put(
    '/',
    async ({ body }) => {
      for (const k of KEYS) {
        const v = (body as Record<string, unknown>)[k]
        if (typeof v === 'string') await setSetting(k, v)
      }
      return readAll()
    },
    {
      body: t.Object({
        status_title: t.Optional(t.String({ maxLength: 120 })),
        status_description: t.Optional(t.String({ maxLength: 400 })),
        status_published: t.Optional(t.String()),
      }),
    },
  )

  /**
   * Test alert.
   *
   * Lets you check that the webhook and the dashboard react without killing a
   * real app. It is flagged with `simulated: true` and the dashboard renders it
   * differently: a monitoring system that cannot tell a drill from a real
   * outage is worse than no monitoring at all.
   */
  .post(
    '/simulate-alert',
    async ({ body }) => {
      const t0 = Date.now()
      const detail = {
        simulated: true,
        hint: 'test alert generated from the dashboard; it matches no real outage',
        silentMs: 3000,
      }
      const [row] = await db
        .insert(alerts)
        .values({ kind: body.kind, app: body.app, pid: 0, detail: JSON.stringify(detail), t: t0, received: t0 })
        .returning({ id: alerts.id })

      const rec = { id: row?.id ?? null, kind: body.kind, app: body.app, pid: 0, detail, t: t0 }
      emit({ kind: 'alert', data: rec })
      return rec
    },
    {
      body: t.Object({
        kind: t.Union([
          t.Literal('app.blocked'),
          t.Literal('app.crashed'),
          t.Literal('app.fatal'),
          t.Literal('app.failed_to_start'),
        ]),
        app: t.String({ maxLength: 128 }),
      }),
    },
  )
