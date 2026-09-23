import { defineConfig } from 'drizzle-kit'

/** Postgres migrations. Generated with `bun run db:generate`, applied at boot. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/schema/pg.ts',
  out: './drizzle/pg',
  dbCredentials: { url: process.env['MOELOG_DB_URL'] ?? 'postgres://moelog:moelog@localhost:5432/moelog' },
})
