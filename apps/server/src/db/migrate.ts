import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { Database } from "./client.js"

const here = dirname(fileURLToPath(import.meta.url))
const drizzleDir = resolve(here, "../../drizzle")

/**
 * Apply POC SQL migrations idempotently (IF NOT EXISTS).
 */
export async function ensureSchema(client: Database["client"]): Promise<void> {
  const migrations = ["0000_worlds.sql", "0001_loot_persistence.sql"]
  for (const file of migrations) {
    const sql = await readFile(resolve(drizzleDir, file), "utf8")
    await client.unsafe(sql)
  }
}
