import { randomUUID } from "node:crypto"
import type { PlayerId } from "@excave/shared"

export interface GuestPlayer {
  playerId: PlayerId
  socketId: string
  connectedAt: number
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isPlayerId(value: unknown): value is PlayerId {
  return typeof value === "string" && UUID_RE.test(value)
}

/**
 * In-memory guest players for the current server process.
 * PlayerIds may be resumed from the client (Lot 9) when not already connected.
 */
export class PlayerRegistry {
  private readonly bySocketId = new Map<string, GuestPlayer>()
  private readonly byPlayerId = new Map<PlayerId, GuestPlayer>()

  create(socketId: string, preferredPlayerId?: string | null, now = Date.now()): GuestPlayer {
    if (this.bySocketId.has(socketId)) {
      throw new Error(`Socket already registered: ${socketId}`)
    }

    let playerId: PlayerId
    if (
      preferredPlayerId &&
      isPlayerId(preferredPlayerId) &&
      !this.byPlayerId.has(preferredPlayerId)
    ) {
      playerId = preferredPlayerId
    } else {
      playerId = randomUUID() as PlayerId
    }

    const player: GuestPlayer = {
      playerId,
      socketId,
      connectedAt: now,
    }

    this.bySocketId.set(socketId, player)
    this.byPlayerId.set(player.playerId, player)
    return player
  }

  removeBySocketId(socketId: string): GuestPlayer | undefined {
    const player = this.bySocketId.get(socketId)
    if (!player) {
      return undefined
    }

    this.bySocketId.delete(socketId)
    this.byPlayerId.delete(player.playerId)
    return player
  }

  getBySocketId(socketId: string): GuestPlayer | undefined {
    return this.bySocketId.get(socketId)
  }

  getByPlayerId(playerId: PlayerId): GuestPlayer | undefined {
    return this.byPlayerId.get(playerId)
  }

  list(): GuestPlayer[] {
    return [...this.bySocketId.values()]
  }

  count(): number {
    return this.bySocketId.size
  }
}
