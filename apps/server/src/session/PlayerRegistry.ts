import { randomUUID } from "node:crypto"
import type { PlayerId } from "@excave/shared"

export interface GuestPlayer {
  playerId: PlayerId
  socketId: string
  connectedAt: number
}

/**
 * In-memory guest players for the current server process.
 * Nothing here is persisted (Lot 2).
 */
export class PlayerRegistry {
  private readonly bySocketId = new Map<string, GuestPlayer>()
  private readonly byPlayerId = new Map<PlayerId, GuestPlayer>()

  create(socketId: string, now = Date.now()): GuestPlayer {
    if (this.bySocketId.has(socketId)) {
      throw new Error(`Socket already registered: ${socketId}`)
    }

    const player: GuestPlayer = {
      playerId: randomUUID() as PlayerId,
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

  list(): GuestPlayer[] {
    return [...this.bySocketId.values()]
  }

  count(): number {
    return this.bySocketId.size
  }
}
