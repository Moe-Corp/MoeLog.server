import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import { isPostgres } from './dialect.ts'

/**
 * The three places where SQLite and Postgres genuinely disagree.
 *
 * Everything else in this codebase is written once against the shared subset of
 * both dialects (see `./schema/index.ts`). These are the exceptions, collected
 * here so that "which engine am I on?" is asked in one file instead of twelve.
 */

/** SQLite spells the two-argument maximum `MAX(a, b)`; Postgres spells it `GREATEST(a, b)`. */
export const greatest = (a: SQLWrapper, b: SQLWrapper): SQL<number> =>
  isPostgres ? sql`greatest(${a}, ${b})` : sql`max(${a}, ${b})`

/**
 * Case-insensitive substring search, for the logs filter.
 *
 * SQLite's `LIKE` already ignores case for ASCII; Postgres's does not, and a
 * search for "timeout" that misses "Timeout" is a search box that looks broken.
 */
export const contains = (column: SQLWrapper, needle: string): SQL =>
  isPostgres ? sql`${column} ilike ${`%${needle}%`}` : sql`${column} like ${`%${needle}%`}`

/**
 * A counter or a sum, as a JavaScript number.
 *
 * Postgres returns `count()` as int8 and `sum()` as numeric, and node drivers
 * hand both back as strings rather than lose precision. Everything wrapped here
 * is a count of rows, which fits in an int4 with room to spare.
 */
export const int = (expr: SQL): SQL<number> =>
  (isPostgres ? sql`cast(${expr} as integer)` : expr) as SQL<number>

/**
 * An epoch-millisecond expression, as a JavaScript number.
 *
 * Same problem as `int`, different ceiling: milliseconds overflow an int4, so
 * these stay int8 and rely on the driver's int8 parser configured in `./db.ts`.
 */
export const big = (expr: SQL): SQL<number> =>
  (isPostgres ? sql`cast(${expr} as bigint)` : expr) as SQL<number>

/** Truncates an epoch-millisecond column to the hour it falls in. */
export const hourBucket = (column: SQLWrapper): SQL<number> => big(sql`(${column} / 3600000) * 3600000`)

/** `SUM(CASE WHEN <cond> THEN 1 ELSE 0 END)`, which both engines spell the same way. */
export const countWhere = (condition: SQL): SQL<number> =>
  int(sql`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`)
