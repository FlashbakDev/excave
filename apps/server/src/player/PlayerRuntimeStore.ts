import type {
  ChunkCoordinate,
  PlayerId,
  PlayerInputPayload,
  PlayerStateEntry,
  WorldPosition,
} from "@excave/shared"
import type { WorldManager } from "../world/WorldManager.js"
import {
  createPlayerRuntimeState,
  type PlayerRuntimeState,
} from "./PlayerRuntimeState.js"
import { stepMovement } from "./simulation.js"

export interface PlayerChunkChange {
  playerId: PlayerId
  previous: ChunkCoordinate
  next: ChunkCoordinate
}

/**
 * In-memory authoritative player bodies for the current process.
 */
export class PlayerRuntimeStore {
  private readonly byPlayerId = new Map<PlayerId, PlayerRuntimeState>()

  constructor(private readonly world: WorldManager) {}

  spawn(playerId: PlayerId, position?: WorldPosition): PlayerRuntimeState {
    const spawn = position ?? this.world.getSpawnPosition()
    const chunk = this.world.worldPositionToChunk(spawn)
    const state = createPlayerRuntimeState(playerId, spawn, chunk)
    this.byPlayerId.set(playerId, state)
    return state
  }

  remove(playerId: PlayerId): void {
    this.byPlayerId.delete(playerId)
  }

  get(playerId: PlayerId): PlayerRuntimeState | undefined {
    return this.byPlayerId.get(playerId)
  }

  has(playerId: PlayerId): boolean {
    return this.byPlayerId.has(playerId)
  }

  applyInput(playerId: PlayerId, input: PlayerInputPayload): boolean {
    const state = this.byPlayerId.get(playerId)
    if (!state) {
      return false
    }

    if (!Number.isFinite(input.sequence) || input.sequence < 0) {
      return false
    }

    // Ignore stale / duplicate sequences (keep latest only).
    if (input.sequence < state.input.sequence) {
      return false
    }

    state.input = {
      up: Boolean(input.up),
      down: Boolean(input.down),
      left: Boolean(input.left),
      right: Boolean(input.right),
      sequence: Math.floor(input.sequence),
    }
    return true
  }

  tick(dtSeconds: number): PlayerChunkChange[] {
    const isWalkable = (position: WorldPosition) =>
      this.world.isWalkable(position)
    const changes: PlayerChunkChange[] = []

    for (const state of this.byPlayerId.values()) {
      const previousChunk = state.currentChunk
      const stepped = stepMovement(
        state.position,
        state.input,
        dtSeconds,
        isWalkable,
      )
      state.position = stepped.position
      state.velocity = stepped.velocity
      const nextChunk = this.world.worldPositionToChunk(state.position)
      state.currentChunk = nextChunk
      state.lastProcessedSequence = state.input.sequence

      if (previousChunk.x !== nextChunk.x || previousChunk.y !== nextChunk.y) {
        changes.push({
          playerId: state.playerId,
          previous: previousChunk,
          next: nextChunk,
        })
      }
    }

    return changes
  }

  snapshot(): PlayerStateEntry[] {
    return [...this.byPlayerId.values()].map((state) => ({
      playerId: state.playerId,
      x: state.position.x,
      y: state.position.y,
      vx: state.velocity.x,
      vy: state.velocity.y,
      chunkX: state.currentChunk.x,
      chunkY: state.currentChunk.y,
      lastProcessedSequence: state.lastProcessedSequence,
    }))
  }

  snapshotInAoi(center: ChunkCoordinate, radius: number): PlayerStateEntry[] {
    return this.snapshot().filter(
      (entry) =>
        Math.abs(entry.chunkX - center.x) <= radius &&
        Math.abs(entry.chunkY - center.y) <= radius,
    )
  }

  count(): number {
    return this.byPlayerId.size
  }
}
