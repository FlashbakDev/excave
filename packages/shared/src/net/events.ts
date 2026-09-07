import type {
  SessionPingPayload,
  SessionPongPayload,
  SessionReadyPayload,
} from "./payloads.js"
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
} as const

export const ClientToServerEvent = {
  SessionPing: "session:ping",
  WorldJoin: "world:join",
  WorldChunkRequest: "world:chunkRequest",
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
}

/** Events a client may emit to the server. */
export interface ClientToServerEvents {
  [ClientToServerEvent.SessionPing]: (payload: SessionPingPayload) => void
  [ClientToServerEvent.WorldJoin]: (payload: WorldJoinPayload) => void
  [ClientToServerEvent.WorldChunkRequest]: (
    payload: WorldChunkRequestPayload,
  ) => void
}

export interface InterServerEvents {}

export interface SocketData {
  playerId: string
}
