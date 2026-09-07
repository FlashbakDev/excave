import { eq } from "drizzle-orm"
import { DEFAULT_WORLD_ID } from "@excave/shared"
import type { Database } from "./client.js"
import { worlds } from "./schema.js"
import { seedFromString } from "../world/hash.js"
import {
  createMainWorldManager,
  type WorldManager,
} from "../world/WorldManager.js"

const DEFAULT_SEED = "excave-poc-seed-1"

export async function ensureMainWorld(
  database: Database["db"],
  preferredSeed = process.env.WORLD_SEED ?? DEFAULT_SEED,
): Promise<WorldManager> {
  const existing = await database
    .select()
    .from(worlds)
    .where(eq(worlds.id, DEFAULT_WORLD_ID))
    .limit(1)

  const row = existing[0]
  if (row) {
    return createMainWorldManager(row.seed, seedFromString(row.seed))
  }

  await database.insert(worlds).values({
    id: DEFAULT_WORLD_ID,
    seed: preferredSeed,
  })

  return createMainWorldManager(preferredSeed, seedFromString(preferredSeed))
}

export function createWorldManagerFromSeed(
  seed = process.env.WORLD_SEED ?? DEFAULT_SEED,
): WorldManager {
  return createMainWorldManager(seed, seedFromString(seed))
}
