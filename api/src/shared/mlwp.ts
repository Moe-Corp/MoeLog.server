import { t } from 'elysia'

/**
 * MLWP v1 — the contract with the SDKs.
 *
 * This file is the trust boundary: everything arriving through it comes from
 * another process, potentially from another machine. It is validated in full,
 * and validated with TypeBox because that is what Elysia already compiles.
 *
 * Once MoeLog.spec exists, these schemas will be generated from the canonical
 * JSON Schema instead of written by hand.
 */

export const LEVEL_NAME: Record<number, string> = {
  10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal',
}
export const TYPE_NAME: Record<number, string> = {
  0: 'log', 1: 'error', 2: 'event', 3: 'span',
}

const Frame = t.Tuple([t.String(), t.Number(), t.Number(), t.String()])
const Ctx = t.Union([t.Record(t.String(), t.Any()), t.Null()])

/** [type, delta-t, level, message, ctx, fingerprint] and optionally frames. */
const Positional = [t.Number(), t.Number(), t.Number(), t.String(), Ctx, t.Union([t.String(), t.Null()])] as const

export const WireEvent = t.Union([
  t.Tuple([...Positional]),
  t.Tuple([...Positional, t.Array(Frame)]),
])

export const Envelope = t.Object(
  {
    v: t.Literal(1),
    sdk: t.String({ maxLength: 64 }),
    t: t.Number(),
    ctx: t.Object({ app: t.String({ maxLength: 128 }) }, { additionalProperties: true }),
    // Hard cap: the protocol allows 500 events per batch and 1 MB per envelope.
    e: t.Array(WireEvent, { maxItems: 500 }),
  },
  { additionalProperties: true },
)

export const AlertBody = t.Object(
  {
    kind: t.String({ maxLength: 64 }),
    t: t.Number(),
    app: t.Optional(t.String({ maxLength: 128 })),
    pid: t.Optional(t.Number()),
  },
  { additionalProperties: true },
)

export interface NormalizedEvent {
  type: number
  level: number
  msg: string
  ctx: Record<string, unknown> | null
  fingerprint: string | null
  frames: Array<[string, number, number, string]> | null
  t: number
}

/** Expands the positional format into something named, with absolute times. */
export function expand(env: { t: number; e: unknown[][] }): NormalizedEvent[] {
  return env.e.map((r) => ({
    type: r[0] as number,
    t: env.t + (r[1] as number),
    level: r[2] as number,
    msg: r[3] as string,
    ctx: (r[4] ?? null) as Record<string, unknown> | null,
    fingerprint: (r[5] ?? null) as string | null,
    frames: (r[6] ?? null) as Array<[string, number, number, string]> | null,
  }))
}
