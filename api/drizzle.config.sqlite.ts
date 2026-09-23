import { defineConfig } from 'drizzle-kit'

/** SQLite migrations. The same schema, generated for the development engine. */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/shared/schema/sqlite.ts',
  out: './drizzle/sqlite',
  dbCredentials: { url: process.env['MOELOG_DB'] ?? 'moelog.db' },
})
