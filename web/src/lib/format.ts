export const LEVEL: Record<number, string> = {
  10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal',
}

export const TYPE: Record<number, string> = { 0: 'log', 1: 'error', 2: 'event', 3: 'span' }

export const time = (t: number): string =>
  new Date(t).toLocaleTimeString('en-GB', { hour12: false }) +
  '.' + String(new Date(t).getMilliseconds()).padStart(3, '0')

export const datetime = (t: number): string => new Date(t).toLocaleString('en-GB', { hour12: false })

/** "4 min ago" — in an error panel, relative time says more than a clock. */
export function ago(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

/** Short path: the absolute prefix of a stack frame adds nothing when reading. */
export const shortFile = (f: string): string =>
  f.replace(/^file:\/\//, '').split('/').slice(-2).join('/')

/** Thousands separator. Always paired with `.tabular` so digits do not jump. */
export const num = (n: number): string => n.toLocaleString('en-GB')

/**
 * Change against the previous window. Returns null when there is nothing to
 * compare against: showing "+100%" because yesterday had no data is lying with
 * style.
 */
export function change(current: number, previous: number): { pct: number; up: boolean } | null {
  if (previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return null
  return { pct: Math.abs(pct), up: pct > 0 }
}

/** An app counts as live if it reported less than 30 s ago. */
export const isOnline = (lastSeen: number): boolean => Date.now() - lastSeen < 30_000

export const hourLabel = (t: number): string => String(new Date(t).getHours()).padStart(2, '0')

/**
 * A frame is "internal" when it is not the user's code: runtime, node_modules.
 * In a 40-frame stack, 35 usually are, and they are noise until they are not.
 */
export const isInternal = (file: string): boolean =>
  /^(node|bun|deno):|[\\/]node_modules[\\/]/.test(file)

/** Human duration. In incidents, milliseconds genuinely matter. */
export function duration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} min`
  return `${(ms / 3600_000).toFixed(1)} h`
}

/** Human wording for each alert kind. Used across several screens. */
export const ALERT: Record<string, { chip: string; title: string; explain: string }> = {
  'app.fatal': {
    chip: 'chip-fatal', title: 'Uncaught exception',
    explain: 'the app died with an error stack recorded by the sidecar.',
  },
  'app.crashed': {
    chip: 'chip-error', title: 'Abrupt death, no goodbye',
    explain: 'the process ended instantly: SIGKILL, kernel OOM or a runtime panic.',
  },
  'app.blocked': {
    chip: 'chip-warn', title: 'Stopped beating',
    explain: 'the event loop is blocked. The app is alive but not serving.',
  },
  'app.recovered': {
    chip: 'chip-ok', title: 'Beating again',
    explain: 'the event loop unblocked and the heartbeat resumed.',
  },
  'app.exited_error': {
    chip: 'chip-error', title: 'Exited with a non-zero code',
    explain: 'the exit was deliberate but it failed.',
  },
  'app.failed_to_start': {
    chip: 'chip-error', title: 'Never started',
    explain: 'the supervisor saw it die before the startup window closed.',
  },
}
