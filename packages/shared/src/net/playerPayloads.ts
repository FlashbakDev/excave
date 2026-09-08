import type { PlayerId } from "../ids.js"

/** One deterministic, fixed-duration movement command. */
export interface PlayerMovementCommand {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  sequence: number
}

/** Client → server ordered command batch (never contains absolute position). */
export interface PlayerInputPayload {
  movementEpoch: string
  commands: PlayerMovementCommand[]
}

/** One player in a server state snapshot. */
export interface PlayerStateEntry {
  playerId: PlayerId
  x: number
  y: number
  vx: number
  vy: number
  chunkX: number
  chunkY: number
  movementEpoch: string
  lastProcessedSequence: number
  lastProcessedTick: number
}

/** Server → client authoritative movement snapshot. */
export interface PlayerStatePayload {
  tick: number
  serverTime: number
  players: PlayerStateEntry[]
}
