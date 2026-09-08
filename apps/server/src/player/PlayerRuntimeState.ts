import type {
  ChunkCoordinate,
  PlayerId,
  PlayerInputPayload,
  WorldPosition,
} from "@excave/shared"

export interface PlayerRuntimeState {
  playerId: PlayerId
  position: WorldPosition
  velocity: WorldPosition
  currentChunk: ChunkCoordinate
  input: PlayerInputPayload
  lastProcessedSequence: number
  /** Epoch ms of last accepted SCAN (0 = never). */
  lastScanAt: number
}

export function createIdleInput(sequence = 0): PlayerInputPayload {
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
    lastProcessedSequence: 0,
    lastScanAt: 0,
  }
}
