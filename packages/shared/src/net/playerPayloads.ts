import type { PlayerId } from "../ids.js"

/** Client → server movement intent (no absolute position). */
export interface PlayerInputPayload {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  sequence: number
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
  lastProcessedSequence: number
}

/** Server → client authoritative movement snapshot. */
export interface PlayerStatePayload {
  tick: number
  serverTime: number
  players: PlayerStateEntry[]
}
