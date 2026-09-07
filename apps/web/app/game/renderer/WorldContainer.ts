import { Container, Graphics } from "pixi.js"
import {
  CHUNK_SIZE,
  TILE_SIZE,
  TileType,
  chunkTileIndex,
  type ChunkCoordinate,
  type ChunkPayload,
  type WorldPosition,
} from "@excave/shared"
import {
  CHUNK_BORDER_COLOR,
  FLOOR_COLOR,
  PLAYER_FILL,
  PLAYER_RADIUS,
  PLAYER_STROKE,
  WALL_COLOR,
} from "./constants"

/**
 * Holds the local world scene: received chunks + temporary player marker.
 */
export class WorldContainer {
  readonly root = new Container()

  private readonly tilesLayer = new Container()
  private readonly borderLayer = new Graphics()
  private readonly player = new Graphics()
  private readonly chunkGraphics = new Map<string, Graphics>()
  private readonly chunkTiles = new Map<string, number[]>()
  private playerX = 0
  private playerY = 0
  private showChunkBorders = true

  constructor() {
    this.root.addChild(this.tilesLayer)
    this.root.addChild(this.borderLayer)
    this.root.addChild(this.player)
    this.drawPlayer()
  }

  getPlayerPosition(): WorldPosition {
    return { x: this.playerX, y: this.playerY }
  }

  setPlayerPosition(position: WorldPosition): void {
    this.playerX = position.x
    this.playerY = position.y
    this.player.position.set(this.playerX, this.playerY)
  }

  getChunkCoordinate(): ChunkCoordinate {
    const tileX = Math.floor(this.playerX / TILE_SIZE)
    const tileY = Math.floor(this.playerY / TILE_SIZE)
    return {
      x: Math.floor(tileX / CHUNK_SIZE),
      y: Math.floor(tileY / CHUNK_SIZE),
    }
  }

  upsertChunks(chunks: readonly ChunkPayload[]): void {
    for (const chunk of chunks) {
      this.upsertChunk(chunk)
    }
    this.redrawBorders()
  }

  hasChunk(coordinate: ChunkCoordinate): boolean {
    return this.chunkTiles.has(chunkKey(coordinate))
  }

  getMissingNeighborhood(
    center: ChunkCoordinate,
    radius = 1,
  ): ChunkCoordinate[] {
    const missing: ChunkCoordinate[] = []
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        const coordinate = { x, y }
        if (!this.hasChunk(coordinate)) {
          missing.push(coordinate)
        }
      }
    }
    return missing
  }

  /**
   * Local walkability from already received chunk data (Lot 3 exploration only).
   */
  isWalkableAt(position: WorldPosition): boolean {
    const tileX = Math.floor(position.x / TILE_SIZE)
    const tileY = Math.floor(position.y / TILE_SIZE)
    const chunkX = Math.floor(tileX / CHUNK_SIZE)
    const chunkY = Math.floor(tileY / CHUNK_SIZE)
    const tiles = this.chunkTiles.get(chunkKey({ x: chunkX, y: chunkY }))
    if (!tiles) {
      return false
    }

    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return tiles[chunkTileIndex(localX, localY)] === TileType.Floor
  }

  destroy(): void {
    this.root.destroy({ children: true })
    this.chunkGraphics.clear()
    this.chunkTiles.clear()
  }

  private upsertChunk(chunk: ChunkPayload): void {
    const key = chunkKey(chunk.chunk)
    const existing = this.chunkGraphics.get(key)
    if (existing) {
      existing.destroy()
      this.tilesLayer.removeChild(existing)
    }

    const graphics = new Graphics()
    const originX = chunk.chunk.x * CHUNK_SIZE * TILE_SIZE
    const originY = chunk.chunk.y * CHUNK_SIZE * TILE_SIZE

    for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const tile = chunk.tiles[chunkTileIndex(localX, localY)]
        const color = tile === TileType.Floor ? FLOOR_COLOR : WALL_COLOR
        graphics.rect(
          originX + localX * TILE_SIZE,
          originY + localY * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        )
        graphics.fill({ color })
      }
    }

    this.chunkTiles.set(key, [...chunk.tiles])
    this.chunkGraphics.set(key, graphics)
    this.tilesLayer.addChild(graphics)
  }

  private redrawBorders(): void {
    this.borderLayer.clear()
    if (!this.showChunkBorders) {
      return
    }

    for (const key of this.chunkGraphics.keys()) {
      const [xText, yText] = key.split(":")
      const chunkX = Number(xText)
      const chunkY = Number(yText)
      const originX = chunkX * CHUNK_SIZE * TILE_SIZE
      const originY = chunkY * CHUNK_SIZE * TILE_SIZE
      const size = CHUNK_SIZE * TILE_SIZE

      this.borderLayer.rect(originX, originY, size, size)
      this.borderLayer.stroke({
        width: 1,
        color: CHUNK_BORDER_COLOR,
        alpha: 0.55,
      })
    }
  }

  private drawPlayer(): void {
    this.player.clear()
    this.player.circle(0, 0, PLAYER_RADIUS)
    this.player.fill({ color: PLAYER_FILL })
    this.player.stroke({ width: 2, color: PLAYER_STROKE })
    this.player.position.set(this.playerX, this.playerY)
  }
}

function chunkKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}:${coordinate.y}`
}
