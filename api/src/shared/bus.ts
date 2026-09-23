/**
 * Real-time bus.
 *
 * The dashboard does not poll: it subscribes over a WebSocket and the write
 * side publishes here whenever something arrives. A single topic ('live') is
 * enough for the alpha; once there are projects and permissions it will be one
 * topic per project.
 */
type Publisher = (topic: string, data: string) => void

let publish: Publisher | null = null

export const connectBus = (fn: Publisher): void => {
  publish = fn
}

export type LiveMessage =
  | { kind: 'event'; data: unknown }
  | { kind: 'alert'; data: unknown }
  | { kind: 'issue'; data: unknown }
  | { kind: 'hello'; data: unknown }

export function emit(m: LiveMessage): void {
  if (!publish) return
  try {
    publish('live', JSON.stringify(m))
  } catch {
    /* a broken client cannot take ingestion down */
  }
}
