import type {
  ChunkCoordinate,
  PlayerId,
  PlayerInputPayload,
  PlayerMovementCommand,
  PlayerStateEntry,
  WorldPosition,
} from "@excave/shared"
import {
  MOVEMENT_COMMAND_HZ,
  MOVEMENT_MAX_SERVER_QUEUE,
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
    const existing = this.byPlayerId.get(playerId)
    if (existing) {
      return existing
    }
    const spawn = position ?? this.world.getSpawnPosition()
    const chunk = this.world.worldPositionToChunk(spawn)
    const state = createPlayerRuntimeState(playerId, spawn, chunk)
    this.byPlayerId.set(playerId, state)
    return state
  }

  remove(playerId: PlayerId): void {
    this.byPlayerId.delete(playerId)
  }

  suspend(playerId: PlayerId): void {
    const state = this.byPlayerId.get(playerId)
    if (!state) {
      return
    }
    state.pendingInputs.length = 0
    state.movementCredit = 0
    state.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      sequence: state.lastProcessedSequence,
    }
    state.velocity = { x: 0, y: 0 }
  }

  get(playerId: PlayerId): PlayerRuntimeState | undefined {
    return this.byPlayerId.get(playerId)
  }

  has(playerId: PlayerId): boolean {
    return this.byPlayerId.has(playerId)
  }

  applyInput(playerId: PlayerId, input: PlayerInputPayload): boolean {
    const state = this.byPlayerId.get(playerId)
    if (!state || input.movementEpoch !== state.movementEpoch) {
      return false
    }

    if (
      input.commands.length === 0 ||
      input.commands.length > MOVEMENT_MAX_SERVER_QUEUE
    ) {
      return false
    }

    const queued = new Set(state.pendingInputs.map((command) => command.sequence))
    let accepted = false
    for (const command of input.commands) {
      if (!isValidCommand(command)) {
        continue
      }
      if (
        command.sequence <= state.lastProcessedSequence ||
        command.sequence >
          state.lastProcessedSequence + MOVEMENT_MAX_SERVER_QUEUE ||
        queued.has(command.sequence) ||
        state.pendingInputs.length >= MOVEMENT_MAX_SERVER_QUEUE
      ) {
        continue
      }
      state.pendingInputs.push({ ...command })
      queued.add(command.sequence)
      accepted = true
    }
    if (accepted) {
      state.pendingInputs.sort((a, b) => a.sequence - b.sequence)
    }
    return accepted
  }

  tick(dtSeconds: number, serverTick = 0): PlayerChunkChange[] {
    const isWalkable = (position: WorldPosition) =>
      this.world.isWalkable(position)
    const changes: PlayerChunkChange[] = []

    for (const state of this.byPlayerId.values()) {
      const previousChunk = state.currentChunk
      state.movementCredit = Math.min(
        MOVEMENT_COMMAND_HZ * 0.2,
        state.movementCredit + dtSeconds * MOVEMENT_COMMAND_HZ,
      )
      let processed = false

      while (state.movementCredit >= 1) {
        const expectedSequence = state.lastProcessedSequence + 1
        const command = state.pendingInputs[0]
        if (!command || command.sequence !== expectedSequence) {
          break
        }
        state.pendingInputs.shift()
        const stepped = stepMovement(
          state.position,
          command,
          1 / MOVEMENT_COMMAND_HZ,
          isWalkable,
        )
        state.position = stepped.position
        state.velocity = stepped.velocity
        state.input = command
        state.lastProcessedSequence = command.sequence
        state.lastProcessedTick = serverTick
        state.movementCredit -= 1
        processed = true
      }
      if (!processed) {
        state.velocity = { x: 0, y: 0 }
      }
      const nextChunk = this.world.worldPositionToChunk(state.position)
      state.currentChunk = nextChunk

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
      movementEpoch: state.movementEpoch,
      lastProcessedSequence: state.lastProcessedSequence,
      lastProcessedTick: state.lastProcessedTick,
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

function isValidCommand(command: PlayerMovementCommand): boolean {
  return (
    Number.isSafeInteger(command.sequence) &&
    command.sequence > 0 &&
    typeof command.up === "boolean" &&
    typeof command.down === "boolean" &&
    typeof command.left === "boolean" &&
    typeof command.right === "boolean"
  )
}
