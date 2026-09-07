import Fastify from "fastify"
import type { FastifyInstance } from "fastify"
import {
  CHUNK_SIZE,
  DEFAULT_WORLD_ID,
  TILE_SIZE,
} from "@excave/shared"
import { createDatabase, type Database } from "./db/client.js"
import {
  createWorldManagerFromSeed,
  ensureMainWorld,
} from "./db/worldBootstrap.js"
import { attachSocketIO, type GameSocketServer } from "./realtime/socket.js"
import { PlayerRegistry } from "./session/PlayerRegistry.js"
import type { WorldManager } from "./world/WorldManager.js"

export interface BuiltServer {
  app: FastifyInstance
  registry: PlayerRegistry
  world: WorldManager
  io: GameSocketServer | null
  db: Database | null
}

export async function buildServer(options?: {
  logger?: boolean
  enableRealtime?: boolean
  corsOrigins?: string[]
  databaseUrl?: string | null
  worldSeed?: string
}): Promise<BuiltServer> {
  const app = Fastify({
    logger: options?.logger ?? true,
  })
  const registry = new PlayerRegistry()

  let db: Database | null = null
  let world: WorldManager

  const databaseUrl =
    options?.databaseUrl === undefined
      ? (process.env.DATABASE_URL ?? null)
      : options.databaseUrl

  if (databaseUrl) {
    try {
      db = createDatabase(databaseUrl)
      await ensureWorldsTable(db.client)
      world = await ensureMainWorld(db.db, options?.worldSeed)
      app.log.info(
        { worldId: world.id, seed: world.seedString },
        "world ready from database",
      )
    } catch (error) {
      await db?.client.end({ timeout: 1 }).catch(() => undefined)
      db = null
      world = createWorldManagerFromSeed(options?.worldSeed)
      app.log.error(
        {
          err: error,
          worldId: world.id,
          seed: world.seedString,
        },
        "database unavailable — falling back to in-memory world seed",
      )
    }
  } else {
    world = createWorldManagerFromSeed(options?.worldSeed)
    app.log.warn(
      { worldId: world.id, seed: world.seedString },
      "DATABASE_URL missing — using in-memory world seed",
    )
  }

  app.get("/health", async () => {
    return {
      status: "ok" as const,
      worldId: world.id,
    }
  })

  app.get("/debug/players", async () => {
    return {
      count: registry.count(),
      players: registry.list().map((player) => ({
        playerId: player.playerId,
        socketId: player.socketId,
        connectedAt: player.connectedAt,
      })),
    }
  })

  app.get<{
    Params: { x: string; y: string }
  }>("/debug/chunk/:x/:y", async (request, reply) => {
    const chunkX = Number(request.params.x)
    const chunkY = Number(request.params.y)
    if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
      return reply.code(400).send({ error: "invalid_chunk" })
    }

    return world.getChunkPayload({ x: chunkX, y: chunkY })
  })

  app.get("/debug/world", async () => {
    return {
      worldId: world.id,
      seed: world.seedString,
      tileSize: TILE_SIZE,
      chunkSize: CHUNK_SIZE,
      defaultWorldId: DEFAULT_WORLD_ID,
      spawn: world.getSpawnPosition(),
    }
  })

  const enableRealtime = options?.enableRealtime ?? true
  let io: GameSocketServer | null = null

  if (enableRealtime) {
    await app.ready()
    io = attachSocketIO(
      app,
      registry,
      world,
      options?.corsOrigins ? { corsOrigins: options.corsOrigins } : undefined,
    )
  }

  return { app, registry, world, io, db }
}

async function ensureWorldsTable(
  client: Database["client"],
): Promise<void> {
  await client`
    CREATE TABLE IF NOT EXISTS worlds (
      id text PRIMARY KEY NOT NULL,
      seed text NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL
    )
  `
}
