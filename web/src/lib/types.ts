export interface MoeEvent {
  id: number
  issue_id: number | null
  app: string
  type: number
  level: number
  msg: string
  ctx: Record<string, unknown> | null
  frames: Array<[string, number, number, string]> | null
  release: string | null
  runtime: string | null
  pid: number | null
  t: number
}

export interface Issue {
  id: number
  app: string
  fingerprint: string
  title: string
  level: number
  status: 'open' | 'resolved' | 'ignored'
  count: number
  release: string | null
  first_seen: number
  last_seen: number
}

export interface Alert {
  id: number
  kind: string
  app: string | null
  pid: number | null
  detail: Record<string, unknown>
  t: number
}

export interface App {
  name: string
  runtime: string | null
  release: string | null
  env: string | null
  first_seen: number
  last_seen: number
}

export interface Stats {
  since: number
  now: number
  by_level: Array<{ level: number; n: number }>
  events_total: number
  events_24h: number
  events_prev_24h: number
  peak_hour: number
  errors_24h: number
  open_issues: number
  critical_issues: number
  alerts_24h: number
  severe_alerts_24h: number
  apps: App[]
  series: Array<{ hour: number; errors: number; total: number }>
}

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

export interface Service {
  name: string
  state: string
  last_seen: number
  incidents_24h: number
  incidents_7d: number
  clean_hours_24h: number
  clean_hours_7d: number
  last_incident: { kind: string; t: number } | null
}
