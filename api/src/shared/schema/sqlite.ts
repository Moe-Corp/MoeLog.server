import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'

/**
 * SQLite schema — the mirror of `./pg.ts`, field by field and name by name.
 *
 * Postgres is the default and what a deployment runs. SQLite is here because
 * asking for a database server just to try the project locally is an absurd
 * barrier: `bun:sqlite` needs nothing installed, and `bun run dev` uses it.
 *
 * If you touch a column here, touch it there. The duplication is the price of
 * two dialects; keeping the two files identical in shape is what makes the one
 * shared query layer in `../db.ts` honest.
 */

/** Epoch milliseconds. SQLite stores 64-bit integers natively. */
const ms = (name: string) => integer(name)

export const apps = sqliteTable('apps', {
  name: text('name').primaryKey(),
  runtime: text('runtime'),
  release: text('release'),
  env: text('env'),
  first_seen: ms('first_seen').notNull(),
  last_seen: ms('last_seen').notNull(),
})

export const issues = sqliteTable(
  'issues',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
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

export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    issue_id: integer('issue_id').references(() => issues.id),
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

export const alerts = sqliteTable(
  'alerts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').notNull(),
    app: text('app'),
    pid: integer('pid'),
    detail: text('detail'),
    t: ms('t').notNull(),
    received: ms('received').notNull(),
  },
  (a) => [index('alerts_t').on(a.t), index('alerts_app').on(a.app, a.t)],
)

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  created: ms('created').notNull(),
  last_login: ms('last_login'),
})

export const api_keys = sqliteTable('api_keys', {
  key: text('key').primaryKey(),
  label: text('label').notNull(),
  created: ms('created').notNull(),
  last_used: ms('last_used'),
  uses: integer('uses').notNull().default(0),
  revoked: integer('revoked').notNull().default(0),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const eventsRelations = relations(events, ({ one }) => ({
  issue: one(issues, { fields: [events.issue_id], references: [issues.id] }),
}))
