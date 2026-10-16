import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { schema } from './schema.js'

export type AppDatabase = DrizzleD1Database<typeof schema>

/** Create the typed query client for a Cloudflare D1 binding. */
export const createD1Database = (binding: D1Database): AppDatabase => drizzle(binding, { schema })
