import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const sql = postgres(url)
  return { sql, db: drizzle(sql, { schema }) }
}

export type Database = ReturnType<typeof createDb>["db"]

let connection: ReturnType<typeof createDb> | null = null

export function getDb(): Database {
  if (!connection) connection = createDb()
  return connection.db
}

export async function closeDb(): Promise<void> {
  if (!connection) return
  await connection.sql.end()
  connection = null
}
