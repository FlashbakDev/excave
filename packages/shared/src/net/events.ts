import type {
  SessionPingPayload,
  SessionPongPayload,
  SessionReadyPayload,
} from "./payloads.js"
import type {
  PlayerInputPayload,
  PlayerStatePayload,
} from "./playerPayloads.js"
import type {
  ExcavationHitPayload,
  ExcavationRejectedPayload,
  ExcavationStartPayload,
  ExcavationStartedPayload,
  ExcavationUpdatePayload,
  NodeDetectedPayload,
  NodeUpdatedPayload,
  PlayerScanPayload,
  PlayerScanRejectedPayload,
  PlayerScannedPayload,
} from "./nodePayloads.js"
import type { InventoryUpdatePayload } from "./inventoryPayloads.js"
import type {
  WorldChunkRequestPayload,
  WorldChunksPayload,
  WorldJoinPayload,
  WorldJoinedPayload,
} from "./worldPayloads.js"

/**
 * Canonical Socket.IO event names.
 * Prefer these constants over raw string literals.
 */
export const ServerToClientEvent = {
  SessionReady: "session:ready",
  SessionPong: "session:pong",
  WorldJoined: "world:joined",
  WorldChunks: "world:chunks",
  PlayerState: "player:state",
  NodeDetected: "node:detected",
  NodeUpdated: "node:updated",
  PlayerScanned: "player:scanned",
  PlayerScanRejected: "player:scanRejected",
  ExcavationStarted: "excavation:started",
  ExcavationRejected: "excavation:rejected",
  ExcavationUpdate: "excavation:update",
  InventoryUpdate: "inventory:update",
} as const

export const ClientToServerEvent = {
  SessionPing: "session:ping",
  WorldJoin: "world:join",
  WorldChunkRequest: "world:chunkRequest",
  PlayerInput: "player:input",
  PlayerScan: "player:scan",
  ExcavationStart: "excavation:start",
  ExcavationHit: "excavation:hit",
} as const

export type ServerToClientEventName =
  (typeof ServerToClientEvent)[keyof typeof ServerToClientEvent]

export type ClientToServerEventName =
  (typeof ClientToServerEvent)[keyof typeof ClientToServerEvent]

/** Events the server may emit to a client. */
export interface ServerToClientEvents {
  [ServerToClientEvent.SessionReady]: (payload: SessionReadyPayload) => void
  [ServerToClientEvent.SessionPong]: (payload: SessionPongPayload) => void
  [ServerToClientEvent.WorldJoined]: (payload: WorldJoinedPayload) => void
  [ServerToClientEvent.WorldChunks]: (payload: WorldChunksPayload) => void
  [ServerToClientEvent.PlayerState]: (payload: PlayerStatePayload) => void
  [ServerToClientEvent.NodeDetected]: (payload: NodeDetectedPayload) => void
  [ServerToClientEvent.NodeUpdated]: (payload: NodeUpdatedPayload) => void
  [ServerToClientEvent.PlayerScanned]: (payload: PlayerScannedPayload) => void
  [ServerToClientEvent.PlayerScanRejected]: (
    payload: PlayerScanRejectedPayload,
  ) => void
  [ServerToClientEvent.ExcavationStarted]: (
    payload: ExcavationStartedPayload,
  ) => void
  [ServerToClientEvent.ExcavationRejected]: (
    payload: ExcavationRejectedPayload,
  ) => void
  [ServerToClientEvent.ExcavationUpdate]: (
    payload: ExcavationUpdatePayload,
  ) => void
  [ServerToClientEvent.InventoryUpdate]: (
    payload: InventoryUpdatePayload,
  ) => void
}

/** Events a client may emit to the server. */
export interface ClientToServerEvents {
  [ClientToServerEvent.SessionPing]: (payload: SessionPingPayload) => void
  [ClientToServerEvent.WorldJoin]: (payload: WorldJoinPayload) => void
  [ClientToServerEvent.WorldChunkRequest]: (
    payload: WorldChunkRequestPayload,
  ) => void
  [ClientToServerEvent.PlayerInput]: (payload: PlayerInputPayload) => void
  [ClientToServerEvent.PlayerScan]: (payload: PlayerScanPayload) => void
  [ClientToServerEvent.ExcavationStart]: (
    payload: ExcavationStartPayload,
  ) => void
  [ClientToServerEvent.ExcavationHit]: (payload: ExcavationHitPayload) => void
}

export interface InterServerEvents {}

export interface SocketData {
  playerId: string
}
