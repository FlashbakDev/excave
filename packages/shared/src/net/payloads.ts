import type { PlayerId } from "../ids.js"
import type { InventoryItemPublic } from "./inventoryPayloads.js"

/** Emitted by the server once a guest session is created / resumed. */
export interface SessionReadyPayload {
  playerId: PlayerId
  serverTime: number
  inventory: InventoryItemPublic[]
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
