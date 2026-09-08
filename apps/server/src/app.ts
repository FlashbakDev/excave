import Fastify from "fastify"
import type { FastifyInstance } from "fastify"
import {
  CHUNK_SIZE,
  DEFAULT_WORLD_ID,
  TILE_SIZE,
} from "@excave/shared"
import { createDatabase, type Database } from "./db/client.js"
import { ensureSchema } from "./db/migrate.js"
import { PersistenceStore } from "./db/PersistenceStore.js"
import {
  createWorldManagerFromSeed,
  ensureMainWorld,
} from "./db/worldBootstrap.js"
import { GameLoop } from "./player/GameLoop.js"
import { PlayerRuntimeStore } from "./player/PlayerRuntimeStore.js"
import { AreaOfInterestManager } from "./aoi/AreaOfInterestManager.js"
import { ExcavationNodeManager } from "./excavation/ExcavationNodeManager.js"
import { ExcavationSessionManager } from "./excavation/ExcavationSessionManager.js"
import { attachSocketIO, type GameSocketServer } from "./realtime/socket.js"
import { PlayerRegistry } from "./session/PlayerRegistry.js"
import type { WorldManager } from "./world/WorldManager.js"

export interface BuiltServer {
  app: FastifyInstance
  registry: PlayerRegistry
  runtimes: PlayerRuntimeStore
  nodes: ExcavationNodeManager
  sessions: ExcavationSessionManager
  persistence: PersistenceStore
  gameLoop: GameLoop | null
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
  startGameLoop?: boolean
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
      await ensureSchema(db.client)
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

  const persistence = new PersistenceStore(db?.db ?? null)
  const runtimes = new PlayerRuntimeStore(world)
  const aoi = new AreaOfInterestManager(world.id)
  const nodes = new ExcavationNodeManager(world)
  const sessions = new ExcavationSessionManager()

  const depleted = await persistence.listDepletedNodeIds(world.id)
  nodes.hydrateDepleted(depleted)
  if (depleted.length > 0) {
    app.log.info({ count: depleted.length }, "hydrated depleted excavation nodes")
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
      players: registry.list().map((player) => {
        const runtime = runtimes.get(player.playerId)
        const rooms = runtime ? aoi.roomsFor(runtime.currentChunk) : []
        return {
          playerId: player.playerId,
          socketId: player.socketId,
          connectedAt: player.connectedAt,
          position: runtime?.position ?? null,
          chunk: runtime?.currentChunk ?? null,
          aoiRooms: rooms,
        }
      }),
    }
  })

  app.get<{
    Params: { playerId: string }
  }>("/debug/inventory/:playerId", async (request, reply) => {
    const playerId = request.params.playerId
    if (!playerId) {
      return reply.code(400).send({ error: "invalid_player" })
    }
    return persistence.getInventory(playerId as never)
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

  app.get<{
    Params: { x: string; y: string }
  }>("/debug/nodes/:x/:y", async (request, reply) => {
    const chunkX = Number(request.params.x)
    const chunkY = Number(request.params.y)
    if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY)) {
      return reply.code(400).send({ error: "invalid_chunk" })
    }

    const list = nodes.ensureChunk({ x: chunkX, y: chunkY })
    return {
      chunk: { x: chunkX, y: chunkY },
      count: list.length,
      nodes: list.map((node) => ({
        id: node.id,
        tileX: node.tileX,
        tileY: node.tileY,
        wallSide: node.wallSide,
        status: node.status,
        activePlayerId: node.activePlayerId,
        // seed intentionally omitted from debug public surface for safety habit
      })),
    }
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
  let gameLoop: GameLoop | null = null

  if (enableRealtime) {
    await app.ready()
    io = attachSocketIO(
      app,
      registry,
      world,
      runtimes,
      aoi,
      nodes,
      sessions,
      persistence,
      options?.corsOrigins ? { corsOrigins: options.corsOrigins } : undefined,
    )
    gameLoop = new GameLoop(runtimes, io, registry, aoi)
    if (options?.startGameLoop ?? true) {
      gameLoop.start()
    }
  }

  return {
    app,
    registry,
    runtimes,
    nodes,
    sessions,
    persistence,
    gameLoop,
    world,
    io,
    db,
  }
}
