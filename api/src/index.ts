import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { alerts } from './features/alerts/index.ts'
import { apps } from './features/apps/index.ts'
import { auth } from './features/auth/index.ts'
import { events } from './features/events/index.ts'
import { incidents } from './features/incidents/index.ts'
import { ingest } from './features/ingest/index.ts'
import { issues } from './features/issues/index.ts'
import { keys } from './features/keys/index.ts'
import { live } from './features/live/index.ts'
import { settings } from './features/settings/index.ts'
import { stats } from './features/stats/index.ts'
import { status } from './features/status/index.ts'
import { DEFAULT_ADMIN_USER, bootstrap, loadJwtSecret, usingDefaultPassword } from './shared/auth.ts'
import { connectBus } from './shared/bus.ts'
import { closeDatabase } from './shared/db.ts'
import { describeDatabase } from './shared/dialect.ts'
import { guard } from './shared/guard.ts'
import { preflight } from './shared/preflight.ts'

/**
 * MoeLog server — API.
 *
 * Explicit CQRS split: `ingest` is the write side (optimized to accept fast and
 * lose nothing), everything else is read (optimized for the dashboard's
 * queries). Each feature is a vertical slice with its routes and its SQL together.
 */
const PORT = Number(process.env['PORT'] ?? 3000)

export const app = new Elysia()
  .use(cors())
  .use(guard)
  .get('/health', () => ({ ok: true, t: Date.now() }))
  .use(auth)
  .use(ingest)
  .use(issues)
  .use(events)
  .use(alerts)
  .use(apps)
  .use(incidents)
  .use(keys)
  .use(settings)
  .use(stats)
  .use(status)
  .use(live)

/**
 * The boot order is not arbitrary.
 *
 * Migrations first, because everything below writes. Then the administrator and
 * the signing secret, because the guard verifies tokens with that secret and
 * runs before routing. Only then does the port open: a server that accepts a
 * request it cannot answer is worse than one that is not up yet.
 */
async function main(): Promise<void> {
  await preflight()

  const initial = await bootstrap()
  await loadJwtSecret()

  app.listen(PORT)
  connectBus((topic, data) => {
    app.server?.publish(topic, data)
  })

  console.log(`
  MoeLog server API   http://localhost:${PORT}
  ingest              POST /v1/ingest   (x-moelog-key header)
  real time           WS   /v1/live     (60 s ticket)
  public status       GET  /v1/status
  database            ${describeDatabase()}
`)

  if (initial) {
    // Printed ONCE, on the first boot. After that it only lives in the database.
    console.log('  -- first boot ' + '-'.repeat(44))
    if (initial.password) {
      console.log(`  user:     ${initial.username}`)
      console.log(`  password: ${initial.password}`)
    } else if (initial.username) {
      console.log(`  user:     ${initial.username}  (password from MOELOG_ADMIN_PASSWORD)`)
    }
    if (initial.key) console.log(`  ingest:   ${initial.key}`)
    console.log('  ' + '-'.repeat(58) + '\n')
  }

  if (await usingDefaultPassword()) {
    const user = process.env['MOELOG_ADMIN_USER'] ?? DEFAULT_ADMIN_USER
    console.warn(`  !! ${user} is using the default password, which is published in the README.`)
    console.warn('     Set MOELOG_ADMIN_PASSWORD before this server is reachable by anyone else.\n')
  }
}

/**
 * `./server --health` is the container health check.
 *
 * The final image is distroless: no shell, no curl, nothing to probe the port
 * with. The binary that serves the port answers for it instead, so the compose
 * health check stays a plain exec and the image stays at 158 MB.
 */
if (process.argv.includes('--health')) {
  const res = await fetch(`http://127.0.0.1:${PORT}/health`).catch(() => null)
  process.exit(res?.ok ? 0 : 1)
}

/** Closing the pool on the way out keeps Postgres from holding the connections. */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void closeDatabase().finally(() => process.exit(0))
  })
}

await main()
