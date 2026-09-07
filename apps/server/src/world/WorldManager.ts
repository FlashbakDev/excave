import {
  CHUNK_SIZE,
  DEFAULT_WORLD_ID,
  TILE_SIZE,
  TileType,
  type ChunkCoordinate,
  type ChunkPayload,
  type WorldId,
  type WorldPosition,
} from "@excave/shared"
import { ChunkManager } from "./ChunkManager.js"
import { findSpawnWorldTile, tileTypeAt } from "./generator.js"

export interface WorldRecord {
  id: WorldId
  seed: string
  numericSeed: number
}

export class WorldManager {
  private readonly chunks: ChunkManager

  constructor(private readonly world: WorldRecord) {
    this.chunks = new ChunkManager(world.id, world.numericSeed)
  }

  get id(): WorldId {
    return this.world.id
  }

  get seedString(): string {
    return this.world.seed
  }

  get numericSeed(): number {
    return this.world.numericSeed
  }

  getSpawnPosition(): WorldPosition {
    const tile = findSpawnWorldTile(this.world.numericSeed)
    return {
      x: tile.x * TILE_SIZE + TILE_SIZE / 2,
      y: tile.y * TILE_SIZE + TILE_SIZE / 2,
    }
  }

  getChunkPayload(coordinate: ChunkCoordinate): ChunkPayload {
    return this.chunks.getChunk(coordinate).toPayload()
  }

  getChunkPayloads(coordinates: readonly ChunkCoordinate[]): ChunkPayload[] {
    return this.chunks.getChunks(coordinates).map((chunk) => chunk.toPayload())
  }

  /** 3x3 neighborhood around a chunk. */
  getNeighborhood(center: ChunkCoordinate, radius = 1): ChunkPayload[] {
    const coordinates: ChunkCoordinate[] = []
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        coordinates.push({ x, y })
      }
    }
    return this.getChunkPayloads(coordinates)
  }

  worldPositionToChunk(position: WorldPosition): ChunkCoordinate {
    const tileX = Math.floor(position.x / TILE_SIZE)
    const tileY = Math.floor(position.y / TILE_SIZE)
    return {
      x: Math.floor(tileX / CHUNK_SIZE),
      y: Math.floor(tileY / CHUNK_SIZE),
    }
  }

  getTileAtWorldPixels(position: WorldPosition) {
    const tileX = Math.floor(position.x / TILE_SIZE)
    const tileY = Math.floor(position.y / TILE_SIZE)
    return tileTypeAt(this.world.numericSeed, tileX, tileY)
  }

  isWalkable(position: WorldPosition): boolean {
    return this.getTileAtWorldPixels(position) === TileType.Floor
  }
}

export function createMainWorldManager(
  seedString: string,
  numericSeed: number,
): WorldManager {
  return new WorldManager({
    id: DEFAULT_WORLD_ID,
    seed: seedString,
    numericSeed,
  })
}
