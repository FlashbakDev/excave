import type { FastifyInstance } from "fastify"
import { Server as SocketServer } from "socket.io"
import {
  ClientToServerEvent,
  DEFAULT_WORLD_ID,
  ServerToClientEvent,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "@excave/shared"
import type { PlayerRegistry } from "../session/PlayerRegistry.js"
import { uniqueChunkCoordinates } from "../world/chunkCoords.js"
import type { WorldManager } from "../world/WorldManager.js"

const DEFAULT_CORS_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]

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
  options?: { corsOrigins?: string[] },
): GameSocketServer {
  const corsOrigins = options?.corsOrigins ?? DEFAULT_CORS_ORIGINS

  const io: GameSocketServer = new SocketServer(app.server, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", (socket) => {
    const player = registry.create(socket.id)
    socket.data.playerId = player.playerId

    app.log.info(
      { playerId: player.playerId, socketId: socket.id },
      "guest session created",
    )

    socket.emit(ServerToClientEvent.SessionReady, {
      playerId: player.playerId,
      serverTime: Date.now(),
    })

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

      const spawn = world.getSpawnPosition()
      const centerChunk = world.worldPositionToChunk(spawn)
      const chunks = world.getNeighborhood(centerChunk, 1)

      socket.emit(ServerToClientEvent.WorldJoined, {
        worldId: world.id,
        spawn,
        chunks,
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

      socket.emit(ServerToClientEvent.WorldChunks, {
        worldId: world.id,
        chunks: world.getChunkPayloads(coordinates),
      })
    })

    socket.on("disconnect", (reason) => {
      const removed = registry.removeBySocketId(socket.id)
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
