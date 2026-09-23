import { relations } from 'drizzle-orm'
import { bigint, bigserial, index, integer, pgTable, text, unique } from 'drizzle-orm/pg-core'

/**
 * Postgres schema. The default dialect, and the one a `docker compose up` gets.
 *
 * It mirrors `./sqlite.ts` field by field, and the property names are the column
 * names on purpose: a `select()` comes back already shaped like the JSON the
 * dashboard consumes, so there is no mapping layer to drift out of sync. See the
 * note at the top of `../db.ts` for how one query layer serves both dialects.
 *
 * Every instant is epoch milliseconds in a `bigint`, never a `timestamp`. The
 * SDK sends `Date.now()` and the dashboard does its own arithmetic: converting
 * to a timestamptz here and back to a number there would only add two places to
 * get the timezone wrong.
 */

/** Epoch milliseconds. `mode: 'number'` because they fit in a float64 until the year 287396. */
const ms = (name: string) => bigint(name, { mode: 'number' })

export const apps = pgTable('apps', {
  name: text('name').primaryKey(),
  runtime: text('runtime'),
  release: text('release'),
  env: text('env'),
  first_seen: ms('first_seen').notNull(),
  last_seen: ms('last_seen').notNull(),
})

/**
 * An issue is a group of events sharing a fingerprint: what the dashboard shows
 * as "one error", even if it happened ten thousand times.
 */
export const issues = pgTable(
  'issues',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    app: text('app').notNull(),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    level: integer('level').notNull(),
    status: text('status').notNull().default('open'),
    count: integer('count').notNull().default(0),
    release: text('release'),
    first_seen: ms('first_seen').notNull(),
    last_seen: ms('last_seen').notNull(),
  },
  (t) => [unique('issues_app_fingerprint').on(t.app, t.fingerprint), index('issues_last').on(t.status, t.last_seen)],
)

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    issue_id: bigint('issue_id', { mode: 'number' }).references(() => issues.id),
    app: text('app').notNull(),
    type: integer('type').notNull(),
    level: integer('level').notNull(),
    msg: text('msg').notNull(),
    ctx: text('ctx'),
    frames: text('frames'),
    fingerprint: text('fingerprint'),
    release: text('release'),
    env: text('env'),
    runtime: text('runtime'),
    pid: integer('pid'),
    sdk: text('sdk'),
    t: ms('t').notNull(),
    received: ms('received').notNull(),
  },
  (e) => [index('events_t').on(e.t), index('events_app').on(e.app, e.level, e.t), index('events_issue').on(e.issue_id, e.t)],
)

export const alerts = pgTable(
  'alerts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    kind: text('kind').notNull(),
    app: text('app'),
    pid: integer('pid'),
    detail: text('detail'),
    t: ms('t').notNull(),
    received: ms('received').notNull(),
  },
  (a) => [index('alerts_t').on(a.t), index('alerts_app').on(a.app, a.t)],
)

/** Who can get into the dashboard. Single tenant for now: no organizations. */
export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  created: ms('created').notNull(),
  last_login: ms('last_login'),
})

/**
 * Ingest keys. They are WRITE-only: they send events, never read them. That is
 * why they live apart from the dashboard session.
 */
export const api_keys = pgTable('api_keys', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  created: ms('created').notNull(),
  last_used: ms('last_used'),
  uses: integer('uses').notNull().default(0),
  revoked: integer('revoked').notNull().default(0),
})

/** Server settings. Key-value so the schema does not migrate on every option. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const eventsRelations = relations(events, ({ one }) => ({
  issue: one(issues, { fields: [events.issue_id], references: [issues.id] }),
}))
