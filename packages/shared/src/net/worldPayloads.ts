import type { ChunkCoordinate, WorldId, WorldPosition } from "../ids.js"
import type { ChunkPayload } from "../world/chunk.js"

export interface WorldJoinPayload {
  worldId?: WorldId
}

export interface WorldJoinedPayload {
  worldId: WorldId
  spawn: WorldPosition
  chunks: ChunkPayload[]
  movementEpoch: string
  lastProcessedSequence: number
}

export interface WorldChunkRequestPayload {
  worldId: WorldId
  chunks: ChunkCoordinate[]
}

export interface WorldChunksPayload {
  worldId: WorldId
  chunks: ChunkPayload[]
}
