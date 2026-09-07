import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue"
import type { Socket } from "socket.io-client"
import {
  ClientToServerEvent,
  DEFAULT_WORLD_ID,
  ServerToClientEvent,
  type ChunkCoordinate,
  type ChunkPayload,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type WorldJoinedPayload,
  type WorldPosition,
} from "@excave/shared"

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

const PING_INTERVAL_MS = 2000

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type WorldJoinHandler = (payload: WorldJoinedPayload) => void
export type WorldChunksHandler = (chunks: ChunkPayload[]) => void

/**
 * Guest Socket.IO session for the game page.
 * Connects on mount (client only) and disconnects on unmount.
 */
export function useGameSession(options?: {
  onWorldJoined?: WorldJoinHandler
  onWorldChunks?: WorldChunksHandler
}) {
  const config = useRuntimeConfig()
  const status = ref<ConnectionStatus>("disconnected")
  const playerId = ref<string | null>(null)
  const pingMs = ref<number | null>(null)
  const lastError = ref<string | null>(null)
  const worldId = ref<string | null>(null)
  const spawn = ref<WorldPosition | null>(null)

  const socket = shallowRef<GameSocket | null>(null)

  let pingTimer: ReturnType<typeof setInterval> | null = null
  const onWorldJoined = options?.onWorldJoined
  const onWorldChunks = options?.onWorldChunks

  const shortPlayerId = computed(() => {
    if (!playerId.value) {
      return "—"
    }
    return playerId.value.slice(0, 8)
  })

  const connectionLabel = computed(() => {
    switch (status.value) {
      case "connected":
        return "OK"
      case "connecting":
        return "…"
      default:
        return "OFF"
    }
  })

  function clearPingTimer(): void {
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  function sendPing(): void {
    const current = socket.value
    if (!current?.connected) {
      return
    }
    current.emit(ClientToServerEvent.SessionPing, {
      clientTime: Date.now(),
    })
  }

  function requestChunks(chunks: ChunkCoordinate[]): void {
    const current = socket.value
    if (!current?.connected || !worldId.value || chunks.length === 0) {
      return
    }
    current.emit(ClientToServerEvent.WorldChunkRequest, {
      worldId: worldId.value,
      chunks,
    })
  }

  async function connect(): Promise<void> {
    if (!import.meta.client || socket.value) {
      return
    }

    status.value = "connecting"
    lastError.value = null

    const { io } = await import("socket.io-client")

    const next: GameSocket = io(String(config.public.socketUrl), {
      transports: ["websocket", "polling"],
      autoConnect: true,
    })

    socket.value = next

    next.on(ServerToClientEvent.SessionReady, (payload) => {
      playerId.value = payload.playerId
      status.value = "connected"
      clearPingTimer()
      sendPing()
      pingTimer = setInterval(sendPing, PING_INTERVAL_MS)
      next.emit(ClientToServerEvent.WorldJoin, { worldId: DEFAULT_WORLD_ID })
    })

    next.on(ServerToClientEvent.SessionPong, (payload) => {
      pingMs.value = Math.max(0, Date.now() - payload.clientTime)
    })

    next.on(ServerToClientEvent.WorldJoined, (payload) => {
      worldId.value = payload.worldId
      spawn.value = payload.spawn
      onWorldJoined?.(payload)
    })

    next.on(ServerToClientEvent.WorldChunks, (payload) => {
      onWorldChunks?.(payload.chunks)
    })

    next.on("disconnect", () => {
      status.value = "disconnected"
      playerId.value = null
      pingMs.value = null
      worldId.value = null
      spawn.value = null
      clearPingTimer()
    })

    next.on("connect_error", (error) => {
      lastError.value = error.message
      status.value = "disconnected"
    })
  }

  function disconnect(): void {
    clearPingTimer()
    const current = socket.value
    socket.value = null
    current?.removeAllListeners()
    current?.disconnect()
    status.value = "disconnected"
    playerId.value = null
    pingMs.value = null
    worldId.value = null
    spawn.value = null
  }

  onMounted(() => {
    void connect()
  })

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    status,
    playerId,
    shortPlayerId,
    pingMs,
    connectionLabel,
    lastError,
    worldId,
    spawn,
    requestChunks,
    connect,
    disconnect,
  }
}
