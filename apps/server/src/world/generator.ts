import {
  CHUNK_SIZE,
  TileType,
  WORLD_ROOM_PERIOD,
  chunkTileIndex,
} from "@excave/shared"
import type { TileType as TileTypeId } from "@excave/shared"
import { hashInt } from "./hash.js"

const ROOM_RADIUS = 3
const CORRIDOR_HALF_WIDTH = 1

function roomCenter(roomCoord: number, period: number): number {
  return roomCoord * period + Math.floor(period / 2)
}

function roomExists(seed: number, roomX: number, roomY: number): boolean {
  return hashInt(seed, 0x524f4d, roomX, roomY) % 11 !== 0
}

function roomsConnectedHorizontally(
  seed: number,
  roomX: number,
  roomY: number,
): boolean {
  // Ordered by roomX so both sides of a border share the decision.
  return hashInt(seed, 0x484f52, roomX, roomY) % 5 !== 0
}

function roomsConnectedVertically(
  seed: number,
  roomX: number,
  roomY: number,
): boolean {
  return hashInt(seed, 0x564552, roomX, roomY) % 5 !== 0
}

/**
 * Tile at absolute world tile coordinates — border-safe by construction.
 */
export function tileTypeAt(
  seed: number,
  worldTileX: number,
  worldTileY: number,
): TileTypeId {
  const period = WORLD_ROOM_PERIOD
  const roomX = Math.floor(worldTileX / period)
  const roomY = Math.floor(worldTileY / period)
  const centerX = roomCenter(roomX, period)
  const centerY = roomCenter(roomY, period)

  if (roomExists(seed, roomX, roomY)) {
    if (
      Math.abs(worldTileX - centerX) <= ROOM_RADIUS &&
      Math.abs(worldTileY - centerY) <= ROOM_RADIUS
    ) {
      return TileType.Floor
    }
  }

  // Horizontal corridor toward the right-hand room.
  if (roomsConnectedHorizontally(seed, roomX, roomY)) {
    const nextCenterX = roomCenter(roomX + 1, period)
    const minX = Math.min(centerX, nextCenterX)
    const maxX = Math.max(centerX, nextCenterX)
    if (
      worldTileX >= minX &&
      worldTileX <= maxX &&
      Math.abs(worldTileY - centerY) <= CORRIDOR_HALF_WIDTH
    ) {
      return TileType.Floor
    }
  }

  // Horizontal corridor arriving from the left-hand room.
  if (roomsConnectedHorizontally(seed, roomX - 1, roomY)) {
    const prevCenterX = roomCenter(roomX - 1, period)
    const minX = Math.min(prevCenterX, centerX)
    const maxX = Math.max(prevCenterX, centerX)
    if (
      worldTileX >= minX &&
      worldTileX <= maxX &&
      Math.abs(worldTileY - centerY) <= CORRIDOR_HALF_WIDTH
    ) {
      return TileType.Floor
    }
  }

  // Vertical corridor toward the bottom room.
  if (roomsConnectedVertically(seed, roomX, roomY)) {
    const nextCenterY = roomCenter(roomY + 1, period)
    const minY = Math.min(centerY, nextCenterY)
    const maxY = Math.max(centerY, nextCenterY)
    if (
      worldTileY >= minY &&
      worldTileY <= maxY &&
      Math.abs(worldTileX - centerX) <= CORRIDOR_HALF_WIDTH
    ) {
      return TileType.Floor
    }
  }

  // Vertical corridor arriving from the top room.
  if (roomsConnectedVertically(seed, roomX, roomY - 1)) {
    const prevCenterY = roomCenter(roomY - 1, period)
    const minY = Math.min(prevCenterY, centerY)
    const maxY = Math.max(prevCenterY, centerY)
    if (
      worldTileY >= minY &&
      worldTileY <= maxY &&
      Math.abs(worldTileX - centerX) <= CORRIDOR_HALF_WIDTH
    ) {
      return TileType.Floor
    }
  }

  return TileType.Wall
}

export function generateChunkTiles(
  seed: number,
  chunkX: number,
  chunkY: number,
): TileTypeId[] {
  const tiles: TileTypeId[] = new Array(CHUNK_SIZE * CHUNK_SIZE)
  const baseX = chunkX * CHUNK_SIZE
  const baseY = chunkY * CHUNK_SIZE

  for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      tiles[chunkTileIndex(localX, localY)] = tileTypeAt(
        seed,
        baseX + localX,
        baseY + localY,
      )
    }
  }

  return tiles
}

/** Spawn near the origin on a known floor tile. */
export function findSpawnWorldTile(seed: number): { x: number; y: number } {
  const period = WORLD_ROOM_PERIOD
  const candidates: Array<{ x: number; y: number }> = []

  for (let roomY = -2; roomY <= 2; roomY += 1) {
    for (let roomX = -2; roomX <= 2; roomX += 1) {
      if (!roomExists(seed, roomX, roomY)) {
        continue
      }
      candidates.push({
        x: roomCenter(roomX, period),
        y: roomCenter(roomY, period),
      })
    }
  }

  candidates.sort(
    (a, b) => Math.abs(a.x) + Math.abs(a.y) - (Math.abs(b.x) + Math.abs(b.y)),
  )

  const spawn = candidates[0]
  if (!spawn) {
    return { x: Math.floor(period / 2), y: Math.floor(period / 2) }
  }
  return spawn
}
