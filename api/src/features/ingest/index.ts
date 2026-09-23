import { Elysia } from 'elysia'
import { emit } from '../../shared/bus.ts'
import { AlertBody, Envelope, expand } from '../../shared/mlwp.ts'
import { saveAlert, saveBatch, type BatchContext } from './repo.ts'

/**
 * WRITE side of the CQRS split.
 *
 * Optimized for exactly one thing: accept fast and lose nothing. It answers
 * `202` and does not negotiate — the SDK cannot wait, and the sidecar on the
 * other end already has its own queue if anything goes wrong.
 *
 * Ingest-key authentication is handled by the global guard (shared/guard.ts),
 * before routing.
 */
export const ingest = new Elysia({ prefix: '/v1' })
  .post(
    '/ingest',
    async ({ body, set }) => {
      // The envelope declares `app` and allows anything else through, so the
      // rest of the batch context is read off the open part of the object.
      const meta = body.ctx as Record<string, unknown>
      const ctx: BatchContext = {
        app: body.ctx.app,
        release: (meta['rel'] as string | undefined) ?? null,
        env: (meta['env'] as string | undefined) ?? null,
        runtime: (meta['rt'] as string | undefined) ?? null,
        pid: (meta['pid'] as number | undefined) ?? null,
        sdk: body.sdk,
      }

      const saved = await saveBatch(expand(body as never), ctx, Date.now())

      for (const s of saved) {
        emit({ kind: 'event', data: s.event })
        if (s.issue) emit({ kind: 'issue', data: s.issue })
      }

      set.status = 202
      return { ok: true, n: saved.length }
    },
    { body: Envelope },
  )

  .post(
    '/alerts',
    async ({ body, set }) => {
      const saved = await saveAlert(body as Record<string, unknown>, Date.now())
      emit({ kind: 'alert', data: saved })
      set.status = 202
      return { ok: true }
    },
    { body: AlertBody },
  )
