import type { ChunkCoordinate, WorldId } from "../ids.js"
import type { TileType } from "./tiles.js"
import { CHUNK_SIZE } from "../constants.js"

/** Chunk snapshot safe to send to clients (no secrets). */
export interface ChunkPayload {
  worldId: WorldId
  chunk: ChunkCoordinate
  /** Row-major tiles, length CHUNK_SIZE * CHUNK_SIZE. */
  tiles: TileType[]
}

export function chunkTileIndex(localX: number, localY: number): number {
  return localY * CHUNK_SIZE + localX
}

export function assertChunkTiles(tiles: readonly number[]): void {
  const expected = CHUNK_SIZE * CHUNK_SIZE
  if (tiles.length !== expected) {
    throw new Error(`Chunk tiles length ${tiles.length} !== ${expected}`)
  }
}
