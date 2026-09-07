import {
  CHUNK_SIZE,
  type ChunkCoordinate,
  type ChunkPayload,
  type WorldId,
} from "@excave/shared"
import type { TileType as TileTypeId } from "@excave/shared"

export class Chunk {
  readonly worldId: WorldId
  readonly coordinate: ChunkCoordinate
  readonly tiles: readonly TileTypeId[]

  constructor(
    worldId: WorldId,
    coordinate: ChunkCoordinate,
    tiles: readonly TileTypeId[],
  ) {
    if (tiles.length !== CHUNK_SIZE * CHUNK_SIZE) {
      throw new Error("Invalid chunk tile count")
    }
    this.worldId = worldId
    this.coordinate = coordinate
    this.tiles = tiles
  }

  toPayload(): ChunkPayload {
    return {
      worldId: this.worldId,
      chunk: { ...this.coordinate },
      tiles: [...this.tiles],
    }
  }
}
