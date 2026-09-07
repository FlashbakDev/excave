import type { PlayerId } from "../ids.js"

/** Emitted by the server once a guest session is created. */
export interface SessionReadyPayload {
  playerId: PlayerId
  serverTime: number
}

/** Client → server latency probe. */
export interface SessionPingPayload {
  clientTime: number
}

/** Server → client latency probe reply. */
export interface SessionPongPayload {
  clientTime: number
  serverTime: number
}
