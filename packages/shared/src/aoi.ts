import type { ChunkCoordinate, WorldId } from "./ids.js"
import { AOI_RADIUS, DEFAULT_WORLD_ID } from "./constants.js"

/**
 * Socket.IO room for a world chunk.
 * Example: `world:main:chunk:12:18`
 */
export function chunkRoomId(
  chunk: ChunkCoordinate,
  worldId: WorldId | string = DEFAULT_WORLD_ID,
): string {
  return `world:${worldId}:chunk:${chunk.x}:${chunk.y}`
}

/** Chunk coordinates in a square neighborhood (inclusive). */
export function chunksInRadius(
  center: ChunkCoordinate,
  radius = AOI_RADIUS,
): ChunkCoordinate[] {
  const coordinates: ChunkCoordinate[] = []
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      coordinates.push({ x, y })
    }
  }
  return coordinates
}

export function isChunkInAoi(
  viewerChunk: ChunkCoordinate,
  otherChunk: ChunkCoordinate,
  radius = AOI_RADIUS,
): boolean {
  return (
    Math.abs(viewerChunk.x - otherChunk.x) <= radius &&
    Math.abs(viewerChunk.y - otherChunk.y) <= radius
  )
}

export function chunkRoomIdsForAoi(
  center: ChunkCoordinate,
  worldId: WorldId | string = DEFAULT_WORLD_ID,
  radius = AOI_RADIUS,
): string[] {
  return chunksInRadius(center, radius).map((chunk) =>
    chunkRoomId(chunk, worldId),
  )
}
