import type { FastifyInstance } from "fastify"
import { Server as SocketServer } from "socket.io"
import {
  AOI_RADIUS,
  ClientToServerEvent,
  DEFAULT_WORLD_ID,
  ExcavationSessionStatus,
  MOVEMENT_MAX_SERVER_QUEUE,
  SCAN_COOLDOWN_MS,
  SCAN_RANGE_PX,
  ServerToClientEvent,
  chunkRoomId,
  type ClientToServerEvents,
  type ExcavationHitPayload,
  type ExcavationStartPayload,
  type InterServerEvents,
  type PlayerInputPayload,
  type ServerToClientEvents,
  type SocketData,
} from "@excave/shared"
import type { AreaOfInterestManager } from "../aoi/AreaOfInterestManager.js"
import type { PersistenceStore } from "../db/PersistenceStore.js"
import type { ExcavationNodeManager } from "../excavation/ExcavationNodeManager.js"
import type { ExcavationSessionManager } from "../excavation/ExcavationSessionManager.js"
import type { PlayerRuntimeStore } from "../player/PlayerRuntimeStore.js"
import type { PlayerRegistry } from "../session/PlayerRegistry.js"
import { uniqueChunkCoordinates } from "../world/chunkCoords.js"
import type { WorldManager } from "../world/WorldManager.js"

const DEFAULT_CORS_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]
const PLAYER_RECONNECT_GRACE_MS = 15_000

export type GameSocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export function attachSocketIO(
  app: FastifyInstance,
  registry: PlayerRegistry,
  world: WorldManager,
  runtimes: PlayerRuntimeStore,
  aoi: AreaOfInterestManager,
  nodes: ExcavationNodeManager,
  sessions: ExcavationSessionManager,
  persistence: PersistenceStore,
  options?: { corsOrigins?: string[] },
): GameSocketServer {
  const corsOrigins = options?.corsOrigins ?? DEFAULT_CORS_ORIGINS

  const io: GameSocketServer = new SocketServer(app.server, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
    },
  })
  const runtimeRemovalTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()

  io.on("connection", (socket) => {
    const auth = socket.handshake.auth as { playerId?: unknown }
    const preferred =
      typeof auth.playerId === "string" ? auth.playerId : null
    const player = registry.create(socket.id, preferred)
    socket.data.playerId = player.playerId
    const pendingRemoval = runtimeRemovalTimers.get(player.playerId)
    if (pendingRemoval) {
      clearTimeout(pendingRemoval)
      runtimeRemovalTimers.delete(player.playerId)
    }

    app.log.info(
      {
        playerId: player.playerId,
        socketId: socket.id,
        resumed: preferred === player.playerId,
      },
      "guest session created",
    )

    void (async () => {
      await persistence.ensurePlayer(player.playerId)
      const inventory = await persistence.getInventory(player.playerId)
      socket.emit(ServerToClientEvent.SessionReady, {
        playerId: player.playerId,
        serverTime: Date.now(),
        inventory: inventory.items,
      })
    })()

    socket.on(ClientToServerEvent.SessionPing, (payload) => {
      socket.emit(ServerToClientEvent.SessionPong, {
        clientTime: payload.clientTime,
        serverTime: Date.now(),
      })
    })

    socket.on(ClientToServerEvent.WorldJoin, (payload) => {
      const worldId = payload.worldId ?? DEFAULT_WORLD_ID
      if (worldId !== world.id) {
        app.log.warn({ worldId, playerId: player.playerId }, "unknown world")
        return
      }

      const runtime = runtimes.spawn(player.playerId, world.getSpawnPosition())
      const spawn = { ...runtime.position }
      const centerChunk = world.worldPositionToChunk(runtime.position)
      const chunks = world.getNeighborhood(centerChunk, AOI_RADIUS)
      nodes.ensureNeighborhood(centerChunk, AOI_RADIUS)

      for (const room of aoi.roomsFor(centerChunk)) {
        void socket.join(room)
      }

      app.log.info(
        {
          playerId: player.playerId,
          chunk: centerChunk,
          rooms: aoi.roomsFor(centerChunk).length,
        },
        "player joined world AOI rooms",
      )

      socket.emit(ServerToClientEvent.WorldJoined, {
        worldId: world.id,
        spawn,
        chunks,
        movementEpoch: runtime.movementEpoch,
        lastProcessedSequence: runtime.lastProcessedSequence,
      })
    })

    socket.on(ClientToServerEvent.WorldChunkRequest, (payload) => {
      if (payload.worldId !== world.id) {
        return
      }

      const coordinates = uniqueChunkCoordinates(payload.chunks)
      if (coordinates.length === 0) {
        return
      }

      for (const coordinate of coordinates) {
        nodes.ensureChunk(coordinate)
      }

      socket.emit(ServerToClientEvent.WorldChunks, {
        worldId: world.id,
        chunks: world.getChunkPayloads(coordinates),
      })
    })

    socket.on(ClientToServerEvent.PlayerInput, (payload: PlayerInputPayload) => {
      if (!runtimes.has(player.playerId)) {
        return
      }
      if (!isValidInputPayload(payload)) {
        return
      }
      runtimes.applyInput(player.playerId, payload)
    })

    socket.on(ClientToServerEvent.PlayerScan, () => {
      const runtime = runtimes.get(player.playerId)
      if (!runtime) {
        return
      }

      const now = Date.now()
      const elapsed = now - runtime.lastScanAt
      if (runtime.lastScanAt > 0 && elapsed < SCAN_COOLDOWN_MS) {
        socket.emit(ServerToClientEvent.PlayerScanRejected, {
          reason: "cooldown",
          remainingMs: SCAN_COOLDOWN_MS - elapsed,
        })
        return
      }

      runtime.lastScanAt = now
      const detected = nodes.scan(player.playerId, runtime.position)
      socket.emit(ServerToClientEvent.PlayerScanned, {
        position: { ...runtime.position },
        rangePx: SCAN_RANGE_PX,
        detected: Boolean(detected),
      })

      if (!detected) {
        return
      }

      socket.emit(ServerToClientEvent.NodeDetected, detected)
      app.log.info(
        { playerId: player.playerId, nodeId: detected.nodeId },
        "node detected",
      )
    })

    socket.on(
      ClientToServerEvent.ExcavationStart,
      (payload: ExcavationStartPayload) => {
        const runtime = runtimes.get(player.playerId)
        if (!runtime) {
          return
        }
        if (!payload || typeof payload.nodeId !== "string") {
          return
        }

        const result = nodes.tryStart(
          player.playerId,
          payload.nodeId,
          runtime.position,
        )

        if (!result.ok) {
          socket.emit(ServerToClientEvent.ExcavationRejected, {
            nodeId: result.nodeId,
            reason: result.reason,
          })
          return
        }

        const node = result.node
        const started = sessions.create(node, player.playerId)
        socket.emit(ServerToClientEvent.ExcavationStarted, started)

        const update = nodes.toPublicUpdate(node)
        const room = chunkRoomId(
          { x: node.chunkX, y: node.chunkY },
          node.worldId,
        )
        io.to(room).emit(ServerToClientEvent.NodeUpdated, update)

        app.log.info(
          {
            playerId: player.playerId,
            nodeId: node.id,
            sessionId: started.sessionId,
          },
          "excavation started",
        )
      },
    )

    socket.on(
      ClientToServerEvent.ExcavationHit,
      (payload: ExcavationHitPayload) => {
        if (
          !payload ||
          typeof payload.sessionId !== "string" ||
          typeof payload.x !== "number" ||
          typeof payload.y !== "number" ||
          typeof payload.tool !== "string"
        ) {
          return
        }

        const result = sessions.hit(
          player.playerId,
          payload.sessionId,
          payload.x,
          payload.y,
          payload.tool,
        )
        if ("error" in result) {
          return
        }

        socket.emit(ServerToClientEvent.ExcavationUpdate, result)

        if (
          result.status === ExcavationSessionStatus.Collapsed ||
          result.status === ExcavationSessionStatus.Completed
        ) {
          void (async () => {
            const endStatus = result.status
            if (
              endStatus !== ExcavationSessionStatus.Collapsed &&
              endStatus !== ExcavationSessionStatus.Completed
            ) {
              return
            }

            const nodeId = sessions.finishSession(payload.sessionId)
            if (!nodeId) {
              return
            }
            const node = nodes.get(nodeId)
            if (!node) {
              return
            }

            try {
              const inventory = await persistence.finalizeExcavation({
                sessionId: payload.sessionId,
                node,
                playerId: player.playerId,
                status: endStatus,
                recovered: result.recoveredTreasures,
              })
              socket.emit(ServerToClientEvent.InventoryUpdate, inventory)
            } catch (error) {
              app.log.error(
                { err: error, sessionId: payload.sessionId },
                "failed to persist excavation loot",
              )
            }

            const depleted = nodes.markDepleted(nodeId)
            if (depleted) {
              const room = chunkRoomId(
                { x: node.chunkX, y: node.chunkY },
                node.worldId,
              )
              io.to(room).emit(ServerToClientEvent.NodeUpdated, depleted)
            }
          })()
        }
      },
    )

    socket.on("disconnect", (reason) => {
      const removed = registry.removeBySocketId(socket.id)
      if (removed) {
        sessions.releasePlayer(removed.playerId)
        const updates = nodes.releasePlayer(removed.playerId)
        for (const update of updates) {
          const node = nodes.get(update.nodeId)
          if (!node) {
            continue
          }
          const room = chunkRoomId(
            { x: node.chunkX, y: node.chunkY },
            node.worldId,
          )
          io.to(room).emit(ServerToClientEvent.NodeUpdated, update)
        }
        runtimes.suspend(removed.playerId)
        const timer = setTimeout(() => {
          runtimes.remove(removed.playerId)
          runtimeRemovalTimers.delete(removed.playerId)
        }, PLAYER_RECONNECT_GRACE_MS)
        if (typeof timer === "object" && "unref" in timer) {
          timer.unref()
        }
        runtimeRemovalTimers.set(removed.playerId, timer)
      }
      app.log.info(
        {
          playerId: removed?.playerId,
          socketId: socket.id,
          reason,
        },
        "guest session removed",
      )
    })
  })

  return io
}

function isValidInputPayload(payload: unknown): payload is PlayerInputPayload {
  if (!payload || typeof payload !== "object") {
    return false
  }
  const value = payload as Record<string, unknown>
  return (
    typeof value.movementEpoch === "string" &&
    value.movementEpoch.length > 0 &&
    Array.isArray(value.commands) &&
    value.commands.length > 0 &&
    value.commands.length <= MOVEMENT_MAX_SERVER_QUEUE &&
    value.commands.every((command) => {
      if (!command || typeof command !== "object") {
        return false
      }
      const item = command as Record<string, unknown>
      return (
        typeof item.up === "boolean" &&
        typeof item.down === "boolean" &&
        typeof item.left === "boolean" &&
        typeof item.right === "boolean" &&
        Number.isSafeInteger(item.sequence) &&
        Number(item.sequence) > 0
      )
    })
  )
}
