import { Database } from 'bun:sqlite'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { migrate as migrateSqlite } from 'drizzle-orm/bun-sqlite/migrator'
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { config, isPostgres } from './dialect.ts'
import * as pgSchema from './schema/pg.ts'
import * as sqliteSchema from './schema/sqlite.ts'

/**
 * The connection, and the one deliberate lie in this codebase.
 *
 * Drizzle types its query builder by dialect, so `db` cannot honestly be typed
 * as "either engine". It is typed as the Postgres one and may be running the
 * SQLite one. That holds because the two schemas are shaped identically and
 * every query stays inside the subset both dialects share — the exceptions live
 * in `./sql.ts`, named. The alternative was writing every repository twice.
 *
 * Postgres is the default. SQLite is what `bun run dev` uses, so trying the
 * project out installs nothing.
 */

export type Db = PostgresJsDatabase<typeof pgSchema>

/**
 * int8 as a JavaScript number.
 *
 * Postgres returns `bigint` columns and `count()` as int8, and postgres.js hands
 * them back as strings so that nothing is silently rounded. Every int8 in this
 * schema is either epoch milliseconds or a row id: both stay well inside
 * `Number.MAX_SAFE_INTEGER`, and a string where the dashboard expects a number
 * breaks arithmetic silently rather than loudly.
 */
const int8AsNumber = {
  to: 20,
  from: [20],
  serialize: (x: number) => String(x),
  parse: (x: string) => Number(x),
}

let client: ReturnType<typeof postgres> | null = null
let sqlite: Database | null = null
let handle: unknown

if (isPostgres) {
  client = postgres(config.target, {
    types: { bigint: int8AsNumber },
    max: Number(process.env['MOELOG_DB_POOL'] ?? 10),
    // The server logs what it decides to log. A driver writing to stderr on its
    // own initiative is noise in someone else's container logs.
    onnotice: () => {},
  })
  handle = drizzlePostgres(client, { schema: pgSchema })
} else {
  sqlite = new Database(config.target, { create: true })
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA busy_timeout = 5000')
  sqlite.exec('PRAGMA foreign_keys = ON')
  handle = drizzleSqlite(sqlite, { schema: sqliteSchema })
}

export const db = handle as Db

// --------------------------------------------------------------- transactions

/**
 * SQLite's queue.
 *
 * Postgres gives every transaction its own connection, so they cannot interfere.
 * `bun:sqlite` is a single connection, and an `await` inside a transaction body
 * yields the event loop: two concurrent batches would interleave their
 * `BEGIN`/`COMMIT` and each would commit the other's half-written work. They
 * queue instead. The write path is a single `INSERT` run per event, so the
 * queue is short — and this is the development engine.
 */
let queue: Promise<unknown> = Promise.resolve()

/**
 * Runs `fn` in a transaction on whichever engine is configured.
 *
 * All or nothing: a half-written envelope would be worse than a rejected one,
 * because the SDK already considers it delivered and will not retry.
 */
export function transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  if (isPostgres) return db.transaction((tx) => fn(tx as unknown as Db)) as Promise<T>

  const raw = sqlite as Database
  const run = queue.then(async () => {
    raw.exec('BEGIN IMMEDIATE')
    try {
      const out = await fn(db)
      raw.exec('COMMIT')
      return out
    } catch (e) {
      raw.exec('ROLLBACK')
      throw e
    }
  })
  // The chain has to survive a failed transaction, or one rejection would wedge
  // every write that comes after it.
  queue = run.catch(() => undefined)
  return run
}

// ---------------------------------------------------------------- migrations

/** Proves the connection works, and is the first thing the preflight asks. */
export async function ping(): Promise<void> {
  if (client) await client`select 1`
  else (sqlite as Database).query('select 1').get()
}

/**
 * The server's `server_version_num`, e.g. 170004 for Postgres 17.4.
 *
 * Null on SQLite, which ships inside Bun and cannot be the wrong version.
 */
export async function postgresVersionNum(): Promise<number | null> {
  if (!client) return null
  const rows = await client`select current_setting('server_version_num') as v`
  const n = Number(rows[0]?.['v'])
  return Number.isFinite(n) ? n : null
}

/**
 * Brings the schema up to date.
 *
 * Not `drizzle-kit push`: the deployed artefact is a single compiled binary in a
 * distroless image, where neither drizzle-kit nor a shell exists. What ships is
 * the generated SQL in `drizzle/<dialect>/`, which `migrate()` reads and applies
 * in order, recording what it already ran. Running it on every boot is what
 * makes `docker compose up` on a fresh volume and on an existing one the same
 * command.
 *
 * Behind a connection pooler, DDL goes through `DIRECT_DATABASE_URL` on a
 * connection of its own, which is closed again as soon as it is done.
 */
export async function migrateToLatest(): Promise<void> {
  const folder = process.env['MOELOG_MIGRATIONS'] ?? `drizzle/${isPostgres ? 'pg' : 'sqlite'}`

  if (!isPostgres) {
    migrateSqlite(db as never, { migrationsFolder: folder })
    return
  }

  if (config.direct === config.target) {
    await migratePostgres(db as never, { migrationsFolder: folder })
    return
  }

  const direct = postgres(config.direct, { types: { bigint: int8AsNumber }, max: 1, onnotice: () => {} })
  try {
    await migratePostgres(drizzlePostgres(direct, { schema: pgSchema }) as never, {
      migrationsFolder: folder,
    })
  } finally {
    await direct.end({ timeout: 5 })
  }
}

export async function closeDatabase(): Promise<void> {
  if (client) await client.end({ timeout: 5 })
  sqlite?.close()
}
