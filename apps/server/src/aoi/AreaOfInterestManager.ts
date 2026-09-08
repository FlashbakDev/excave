import {
  AOI_RADIUS,
  chunkRoomIdsForAoi,
  type ChunkCoordinate,
  type WorldId,
} from "@excave/shared"

export interface AoiRoomDiff {
  roomsToJoin: string[]
  roomsToLeave: string[]
}

/**
 * Computes Socket.IO chunk-room subscriptions for localized multiplayer.
 */
export class AreaOfInterestManager {
  constructor(
    private readonly worldId: WorldId | string,
    private readonly radius = AOI_RADIUS,
  ) {}

  roomsFor(center: ChunkCoordinate): string[] {
    return chunkRoomIdsForAoi(center, this.worldId, this.radius)
  }

  /**
   * Diff AOI room sets when a player moves from one chunk to another.
   * Avoids leave/join when the room stays in both neighborhoods.
   */
  diff(previous: ChunkCoordinate, next: ChunkCoordinate): AoiRoomDiff {
    if (previous.x === next.x && previous.y === next.y) {
      return { roomsToJoin: [], roomsToLeave: [] }
    }

    const before = new Set(this.roomsFor(previous))
    const after = new Set(this.roomsFor(next))

    const roomsToJoin: string[] = []
    const roomsToLeave: string[] = []

    for (const room of after) {
      if (!before.has(room)) {
        roomsToJoin.push(room)
      }
    }
    for (const room of before) {
      if (!after.has(room)) {
        roomsToLeave.push(room)
      }
    }

    return { roomsToJoin, roomsToLeave }
  }
}
