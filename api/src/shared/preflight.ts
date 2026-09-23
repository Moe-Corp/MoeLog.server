import { migrateToLatest, ping, postgresVersionNum } from './db.ts'
import { MIN_POSTGRES_VERSION, MIN_POSTGRES_VERSION_NUM, config, describeDatabase, isPostgres } from './dialect.ts'

/**
 * Everything that must be true before the port opens.
 *
 * Modelled on what Umami does in `scripts/check-db.js`: a short sequence of
 * named checks, each one printing a tick or a cross, stopping at the first
 * failure. The value is not the ceremony — it is that "the server did not come
 * up" becomes "✗ Unable to connect to the database: …", which is the difference
 * between a support thread and a fixed typo.
 *
 * Umami runs it as a separate process before `node server.js`. This server does
 * it in-process instead, because the deployed artefact is one compiled binary in
 * an image with no shell to chain two commands together. The guarantee is the
 * same: nothing listens until every check below has passed.
 */

const plain = Boolean(process.env['NO_COLOR']) || !process.stdout.isTTY
const green = (s: string) => (plain ? s : `\x1b[32m${s}\x1b[0m`)
const red = (s: string) => (plain ? s : `\x1b[31m${s}\x1b[0m`)

const ok = (msg: string): void => console.log(green(`  ✓ ${msg}`))
const fail = (msg: string): void => console.error(red(`  ✗ ${msg}`))

async function checkEnv(): Promise<void> {
  if (process.env['MOELOG_DB_URL'] && process.env['DATABASE_URL']) {
    // Not fatal, but silently ignoring one of two conflicting settings is how
    // someone ends up writing to a database they thought they had replaced.
    console.warn('  ! MOELOG_DB_URL and DATABASE_URL are both set; MOELOG_DB_URL wins')
  }
  ok(`database configured: ${describeDatabase()}`)
}

async function checkConnection(): Promise<void> {
  try {
    await ping()
  } catch (e) {
    throw new Error(`unable to connect to the database: ${(e as Error).message}`)
  }
  ok('database connection successful')
}

/**
 * `server_version_num` as people write it.
 *
 * Postgres changed the encoding at version 10: 90624 is 9.6.24, where the minor
 * is the middle two digits, and 170006 is 17.6, where it is the last four.
 */
function formatVersion(num: number): string {
  const major = Math.floor(num / 10000)
  const rest = num % 10000
  return major >= 10 ? `${major}.${rest}` : `${major}.${Math.floor(rest / 100)}.${rest % 100}`
}

async function checkVersion(): Promise<void> {
  const num = await postgresVersionNum()
  if (num === null) {
    ok('sqlite needs no version check')
    return
  }
  if (num < MIN_POSTGRES_VERSION_NUM) {
    throw new Error(
      `Postgres ${formatVersion(num)} is too old; ${MIN_POSTGRES_VERSION} or greater is required`,
    )
  }
  ok(`database version check successful (Postgres ${formatVersion(num)})`)
}

async function applyMigration(): Promise<void> {
  if (process.env['SKIP_DB_MIGRATION']) {
    ok('migrations skipped (SKIP_DB_MIGRATION)')
    return
  }
  await migrateToLatest()
  ok(config.direct === config.target ? 'database is up to date' : 'database is up to date (migrated through DIRECT_DATABASE_URL)')
}

/** Runs the checks in order and exits the process on the first failure. */
export async function preflight(): Promise<void> {
  if (process.env['SKIP_DB_CHECK']) {
    console.log('  skipping database check (SKIP_DB_CHECK)')
    return
  }

  console.log('')
  for (const check of [checkEnv, checkConnection, checkVersion, applyMigration]) {
    try {
      await check()
    } catch (e) {
      fail((e as Error).message)
      if (isPostgres) {
        console.error('\n  Postgres is the default. For a local run with no database server:')
        console.error('    DATABASE_URL=file:moelog.db bun run start')
        console.error('  Or bring the bundled one up:  docker compose up -d db\n')
      }
      process.exit(1)
    }
  }
}
