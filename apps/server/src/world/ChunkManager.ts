import type { ChunkCoordinate, WorldId } from "@excave/shared"
import { Chunk } from "./Chunk.js"
import { generateChunkTiles } from "./generator.js"

function chunkKey(chunk: ChunkCoordinate): string {
  return `${chunk.x}:${chunk.y}`
}

export class ChunkManager {
  private readonly cache = new Map<string, Chunk>()

  constructor(
    private readonly worldId: WorldId,
    private readonly seed: number,
  ) {}

  getChunk(coordinate: ChunkCoordinate): Chunk {
    const key = chunkKey(coordinate)
    const cached = this.cache.get(key)
    if (cached) {
      return cached
    }

    const chunk = new Chunk(
      this.worldId,
      { x: coordinate.x, y: coordinate.y },
      generateChunkTiles(this.seed, coordinate.x, coordinate.y),
    )
    this.cache.set(key, chunk)
    return chunk
  }

  getChunks(coordinates: readonly ChunkCoordinate[]): Chunk[] {
    return coordinates.map((coordinate) => this.getChunk(coordinate))
  }
}
