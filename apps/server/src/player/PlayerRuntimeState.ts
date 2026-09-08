import type {
  ChunkCoordinate,
  PlayerId,
  PlayerMovementCommand,
  WorldPosition,
} from "@excave/shared"
import { randomUUID } from "node:crypto"

export interface PlayerRuntimeState {
  playerId: PlayerId
  position: WorldPosition
  velocity: WorldPosition
  currentChunk: ChunkCoordinate
  input: PlayerMovementCommand
  pendingInputs: PlayerMovementCommand[]
  movementEpoch: string
  movementCredit: number
  lastProcessedSequence: number
  lastProcessedTick: number
  /** Epoch ms of last accepted SCAN (0 = never). */
  lastScanAt: number
}

export function createIdleInput(sequence = 0): PlayerMovementCommand {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    sequence,
  }
}

export function createPlayerRuntimeState(
  playerId: PlayerId,
  spawn: WorldPosition,
  chunk: ChunkCoordinate,
): PlayerRuntimeState {
  return {
    playerId,
    position: { ...spawn },
    velocity: { x: 0, y: 0 },
    currentChunk: { ...chunk },
    input: createIdleInput(),
    pendingInputs: [],
    movementEpoch: randomUUID(),
    movementCredit: 0,
    lastProcessedSequence: 0,
    lastProcessedTick: 0,
    lastScanAt: 0,
  }
}
