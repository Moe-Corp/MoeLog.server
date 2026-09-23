/**
 * Which database is in use, resolved once from the environment.
 *
 * It lives apart from `db.ts` because the schema barrel needs to know the
 * dialect in order to pick a schema, and `db.ts` needs the schema in order to
 * open the connection. Keeping the decision in a leaf module breaks that cycle.
 *
 * The rules, in order:
 *
 *   MOELOG_DB_URL      postgres://… or file:… — the project-specific override
 *   DATABASE_URL       the same, under the name every self-hosted tool uses
 *   MOELOG_DB          a path: SQLite, kept so older setups still boot
 *   nothing            Postgres on localhost, which is what the bundled
 *                      docker compose provides
 *
 * `DATABASE_URL` is the documented one and what the compose file sets: it is
 * the name Umami, Plausible and most of the self-hosted world already use, and
 * the scheme in it decides the engine. `MOELOG_DB_URL` exists for the case
 * where something else in the same environment already owns `DATABASE_URL`.
 */

export const DEFAULT_POSTGRES_URL = 'postgres://moelog:moelog@localhost:5432/moelog'
export const DEFAULT_SQLITE_PATH = 'moelog.db'

/**
 * Postgres 9.5 introduced `ON CONFLICT … DO UPDATE`, which the ingest path is
 * built on. Below that the server would not fail at boot — it would fail on the
 * first error anyone reported, which is a far worse place to find out.
 */
export const MIN_POSTGRES_VERSION_NUM = 90500
export const MIN_POSTGRES_VERSION = '9.5'

export type Dialect = 'postgres' | 'sqlite'

interface Config {
  dialect: Dialect
  /** Connection URL for Postgres, file path for SQLite. */
  target: string
  /**
   * Where migrations connect. Behind a connection pooler (pgBouncer, Neon) DDL
   * has to go to the database directly, so `DIRECT_DATABASE_URL` points past it.
   * Identical to `target` when unset.
   */
  direct: string
}

function resolve(): Config {
  const url = process.env['MOELOG_DB_URL'] ?? process.env['DATABASE_URL'] ?? null

  if (url) {
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
      return { dialect: 'postgres', target: url, direct: process.env['DIRECT_DATABASE_URL'] ?? url }
    }
    if (url.startsWith('file:')) {
      const path = url.slice(5) || DEFAULT_SQLITE_PATH
      return { dialect: 'sqlite', target: path, direct: path }
    }
    if (url.startsWith('sqlite:')) {
      const path = url.slice(7) || DEFAULT_SQLITE_PATH
      return { dialect: 'sqlite', target: path, direct: path }
    }
    // Failing loudly beats silently falling back to a different database than
    // the one someone thought they had configured.
    throw new Error(
      `unsupported database URL scheme: ${url.split(':')[0]}:` +
        ` — expected postgres://, postgresql://, file: or sqlite:`,
    )
  }

  const legacy = process.env['MOELOG_DB']
  if (legacy) return { dialect: 'sqlite', target: legacy, direct: legacy }

  return {
    dialect: 'postgres',
    target: DEFAULT_POSTGRES_URL,
    direct: process.env['DIRECT_DATABASE_URL'] ?? DEFAULT_POSTGRES_URL,
  }
}

export const config: Config = resolve()
export const dialect: Dialect = config.dialect
export const isPostgres = dialect === 'postgres'

/** The connection as it is safe to print: Postgres URLs carry a password. */
export function describeDatabase(): string {
  if (!isPostgres) return `sqlite ${config.target}`
  try {
    const u = new URL(config.target)
    return `postgres ${u.host}${u.pathname}`
  } catch {
    return 'postgres (unparseable URL)'
  }
}
