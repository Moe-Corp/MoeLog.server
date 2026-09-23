import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from './db.ts'
import { api_keys, settings, users } from './schema/index.ts'

/**
 * Server authentication.
 *
 * Two deliberately separate paths, because they are two different things:
 *
 *  - **Ingest keys** (`mlk_pub_…`): write only. The sidecar carries them, they
 *    live on the disk of whoever deploys the app, and they grant no read access.
 *  - **Dashboard session** (JWT): read and administration only. Obtained with a
 *    username and password, stored in an httpOnly cookie.
 *
 * A leaked ingest key not being able to READ anyone's logs is the reason they
 * are separate.
 */

// ------------------------------------------------------------------- passwords

/** node's scrypt: no dependencies and the cost calibrated by the runtime. */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16)
  const dk = scryptSync(pw, salt, 64)
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, dkHex] = stored.split('$')
  if (alg !== 'scrypt' || !saltHex || !dkHex) return false
  const expected = Buffer.from(dkHex, 'hex')
  const actual = scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length)
  // timingSafeEqual: comparing hashes with === leaks information through timing.
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// -------------------------------------------------------------------- settings

export async function setting(k: string): Promise<string | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, k)).limit(1)
  return row?.value ?? null
}

export async function setSetting(k: string, v: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: k, value: v })
    .onConflictDoUpdate({ target: settings.key, set: { value: v } })
}

// ------------------------------------------------------------------ jwt secret

/**
 * Signing secret. Persisted in the database on purpose: regenerating it on every
 * boot would sign every open dashboard out on every restart.
 *
 * It is read once at startup and kept in memory because the guard verifies
 * tokens in `onRequest`, and a database round trip per request — which is what
 * reading it lazily would cost on Postgres — is not a price a boundary check
 * should pay.
 */
let secret: string | null = null

export async function loadJwtSecret(): Promise<void> {
  const fromEnv = process.env['MOELOG_JWT_SECRET']
  if (fromEnv) {
    secret = fromEnv
    return
  }
  const saved = await setting('jwt_secret')
  if (saved) {
    secret = saved
    return
  }
  const fresh = randomBytes(32).toString('hex')
  await setSetting('jwt_secret', fresh)
  secret = fresh
}

export function jwtSecret(): string {
  if (!secret) throw new Error('jwt secret read before loadJwtSecret() — the server booted out of order')
  return secret
}

// ------------------------------------------------------------------ ingest keys

export const newKey = (): string => `mlk_pub_${randomBytes(16).toString('hex')}`

export async function validKey(k: string | undefined): Promise<boolean> {
  if (!k) return false
  const [row] = await db.select({ revoked: api_keys.revoked }).from(api_keys).where(eq(api_keys.key, k)).limit(1)
  if (!row || row.revoked === 1) return false

  // The use counter is what lets the dashboard say "nobody is using this key",
  // and it is not worth a round trip on the ingest path. Nothing reads it
  // within the request, so it is left to settle on its own.
  void db
    .update(api_keys)
    .set({ last_used: Date.now(), uses: sql`${api_keys.uses} + 1` })
    .where(eq(api_keys.key, k))
    .catch(() => undefined)

  return true
}

// --------------------------------------------------------------------- bootstrap

export const DEFAULT_ADMIN_USER = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'moelog'

export interface Bootstrap {
  username: string
  /** The password, when it is one the operator still has to be told. */
  password: string | null
  key: string | null
  /** True when the account was created with the published default password. */
  weak: boolean
}

/**
 * First boot: creates the administrator and one ingest key.
 *
 * It runs on every start and does nothing when a user already exists, so
 * `docker compose up` behaves the same on a fresh volume and on an existing one.
 *
 * The default credentials are `admin` / `moelog` — published, and therefore
 * public. That is a deliberate trade for a self-hosted panel that has to be
 * reachable right after `docker compose up`, and it is why the banner nags about
 * it on every boot until `MOELOG_ADMIN_PASSWORD` is set.
 */
export async function bootstrap(): Promise<Bootstrap | null> {
  const [{ n: userCount } = { n: 0 }] = await db.select({ n: sql<number>`cast(count(*) as integer)` }).from(users)
  const [{ n: keyCount } = { n: 0 }] = await db.select({ n: sql<number>`cast(count(*) as integer)` }).from(api_keys)
  if (userCount > 0 && keyCount > 0) return null

  const result: Bootstrap = { username: '', password: null, key: null, weak: false }

  if (userCount === 0) {
    const username = process.env['MOELOG_ADMIN_USER'] ?? DEFAULT_ADMIN_USER
    const chosen = process.env['MOELOG_ADMIN_PASSWORD']
    const password = chosen ?? DEFAULT_ADMIN_PASSWORD
    await db.insert(users).values({ username, password: hashPassword(password), created: Date.now() })
    result.username = username
    result.password = chosen ? null : password
    result.weak = !chosen
  }

  if (keyCount === 0) {
    // Respects MOELOG_INGEST_KEY so anyone who already configured one is not broken.
    const key = process.env['MOELOG_INGEST_KEY'] ?? newKey()
    await db.insert(api_keys).values({ key, label: 'initial key', created: Date.now() })
    result.key = key
  }

  return result
}

/**
 * Whether the administrator is still on the default password.
 *
 * Checked on every boot rather than only on the first one, because the reason to
 * warn is that the password is weak today — not that it was created that way.
 */
export async function usingDefaultPassword(): Promise<boolean> {
  if (process.env['MOELOG_ADMIN_PASSWORD']) return false
  const username = process.env['MOELOG_ADMIN_USER'] ?? DEFAULT_ADMIN_USER
  const [row] = await db.select({ password: users.password }).from(users).where(eq(users.username, username)).limit(1)
  return row ? verifyPassword(DEFAULT_ADMIN_PASSWORD, row.password) : false
}
