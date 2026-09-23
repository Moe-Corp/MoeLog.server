import { isPostgres } from '../dialect.ts'
import * as pg from './pg.ts'
import * as sqlite from './sqlite.ts'

/**
 * The active schema.
 *
 * Drizzle types its tables by dialect, so there is no such thing as one table
 * definition that serves both. What there is — and what the two schema files
 * guarantee — is two definitions with identical table names, identical column
 * names and identical shapes.
 *
 * So the runtime picks one and the types describe the other. Every query in
 * this codebase is written against the Postgres types and executed against
 * whichever engine is configured, which works because the query layer stays
 * inside the subset both dialects share. The three places where they genuinely
 * differ are not papered over here: they live in `../sql.ts`, named and
 * explained.
 */
const active = (isPostgres ? pg : sqlite) as typeof pg

export const { apps, issues, events, alerts, users, api_keys, settings } = active
export const schema = active
