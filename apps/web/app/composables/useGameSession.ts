import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue"
import type { Socket } from "socket.io-client"
import {
  ClientToServerEvent,
  DEFAULT_WORLD_ID,
  ServerToClientEvent,
  type ChunkCoordinate,
  type ChunkPayload,
  type ClientToServerEvents,
  type ExcavationHitPayload,
  type ExcavationNodeId,
  type ExcavationRejectedPayload,
  type ExcavationStartedPayload,
  type ExcavationToolId,
  type ExcavationUpdatePayload,
  type InventoryItemPublic,
  type InventoryUpdatePayload,
  type MovementButtons,
  type NodeDetectedPayload,
  type NodeUpdatedPayload,
  type PlayerScanRejectedPayload,
  type PlayerScannedPayload,
  type PlayerStatePayload,
  type ServerToClientEvents,
  type WorldJoinedPayload,
  type WorldPosition,
} from "@excave/shared"

export type ConnectionStatus = "disconnected" | "connecting" | "connected"

const PING_INTERVAL_MS = 2000
const GUEST_PLAYER_KEY = "excave.guestPlayerId"

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export type WorldJoinHandler = (payload: WorldJoinedPayload) => void
export type WorldChunksHandler = (chunks: ChunkPayload[]) => void
export type PlayerStateHandler = (payload: PlayerStatePayload) => void
export type NodeDetectedHandler = (payload: NodeDetectedPayload) => void
export type NodeUpdatedHandler = (payload: NodeUpdatedPayload) => void
export type PlayerScannedHandler = (payload: PlayerScannedPayload) => void
export type PlayerScanRejectedHandler = (
  payload: PlayerScanRejectedPayload,
) => void
export type ExcavationStartedHandler = (payload: ExcavationStartedPayload) => void
export type ExcavationRejectedHandler = (payload: ExcavationRejectedPayload) => void
export type ExcavationUpdateHandler = (payload: ExcavationUpdatePayload) => void
export type InventoryUpdateHandler = (payload: InventoryUpdatePayload) => void

/**
 * Guest Socket.IO session for the game page.
 * Resumes the same guest playerId from localStorage when possible (Lot 9).
 */
export function useGameSession(options?: {
  onWorldJoined?: WorldJoinHandler
  onWorldChunks?: WorldChunksHandler
  onPlayerState?: PlayerStateHandler
  onNodeDetected?: NodeDetectedHandler
  onNodeUpdated?: NodeUpdatedHandler
  onPlayerScanned?: PlayerScannedHandler
  onPlayerScanRejected?: PlayerScanRejectedHandler
  onExcavationStarted?: ExcavationStartedHandler
  onExcavationRejected?: ExcavationRejectedHandler
  onExcavationUpdate?: ExcavationUpdateHandler
  onInventoryUpdate?: InventoryUpdateHandler
}) {
  const config = useRuntimeConfig()
  const status = ref<ConnectionStatus>("disconnected")
  const playerId = ref<string | null>(null)
  const pingMs = ref<number | null>(null)
  const lastError = ref<string | null>(null)
  const worldId = ref<string | null>(null)
  const spawn = ref<WorldPosition | null>(null)
  const inventory = ref<InventoryItemPublic[]>([])

  const socket = shallowRef<GameSocket | null>(null)

  let pingTimer: ReturnType<typeof setInterval> | null = null
  const onWorldJoined = options?.onWorldJoined
  const onWorldChunks = options?.onWorldChunks
  const onPlayerState = options?.onPlayerState
  const onNodeDetected = options?.onNodeDetected
  const onNodeUpdated = options?.onNodeUpdated
  const onPlayerScanned = options?.onPlayerScanned
  const onPlayerScanRejected = options?.onPlayerScanRejected
  const onExcavationStarted = options?.onExcavationStarted
  const onExcavationRejected = options?.onExcavationRejected
  const onExcavationUpdate = options?.onExcavationUpdate
  const onInventoryUpdate = options?.onInventoryUpdate

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

  function sendInput(buttons: MovementButtons, sequence: number): void {
    const current = socket.value
    if (!current?.connected || !worldId.value) {
      return
    }
    current.emit(ClientToServerEvent.PlayerInput, {
      ...buttons,
      sequence,
    })
  }

  function sendScan(): void {
    const current = socket.value
    if (!current?.connected || !worldId.value) {
      return
    }
    current.emit(ClientToServerEvent.PlayerScan, {
      clientTime: Date.now(),
    })
  }

  function sendExcavationStart(nodeId: ExcavationNodeId): void {
    const current = socket.value
    if (!current?.connected || !worldId.value) {
      return
    }
    current.emit(ClientToServerEvent.ExcavationStart, { nodeId })
  }

  function sendExcavationHit(
    sessionId: string,
    x: number,
    y: number,
    tool: ExcavationToolId,
  ): void {
    const current = socket.value
    if (!current?.connected || !worldId.value) {
      return
    }
    const payload: ExcavationHitPayload = { sessionId, x, y, tool }
    current.emit(ClientToServerEvent.ExcavationHit, payload)
  }

  function readStoredPlayerId(): string | null {
    try {
      return localStorage.getItem(GUEST_PLAYER_KEY)
    } catch {
      return null
    }
  }

  function storePlayerId(id: string): void {
    try {
      localStorage.setItem(GUEST_PLAYER_KEY, id)
    } catch {
      // ignore quota / private mode
    }
  }

  async function connect(): Promise<void> {
    if (!import.meta.client || socket.value) {
      return
    }

    status.value = "connecting"
    lastError.value = null

    const { io } = await import("socket.io-client")
    const storedPlayerId = readStoredPlayerId()

    const next: GameSocket = io(String(config.public.socketUrl), {
      transports: ["websocket", "polling"],
      autoConnect: true,
      auth: storedPlayerId ? { playerId: storedPlayerId } : {},
    })

    socket.value = next

    next.on(ServerToClientEvent.SessionReady, (payload) => {
      playerId.value = payload.playerId
      storePlayerId(payload.playerId)
      inventory.value = [...payload.inventory]
      onInventoryUpdate?.({ items: payload.inventory })
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

    next.on(ServerToClientEvent.PlayerState, (payload) => {
      onPlayerState?.(payload)
    })

    next.on(ServerToClientEvent.NodeDetected, (payload) => {
      onNodeDetected?.(payload)
    })

    next.on(ServerToClientEvent.NodeUpdated, (payload) => {
      onNodeUpdated?.(payload)
    })

    next.on(ServerToClientEvent.PlayerScanned, (payload) => {
      onPlayerScanned?.(payload)
    })

    next.on(ServerToClientEvent.PlayerScanRejected, (payload) => {
      onPlayerScanRejected?.(payload)
    })

    next.on(ServerToClientEvent.ExcavationStarted, (payload) => {
      onExcavationStarted?.(payload)
    })

    next.on(ServerToClientEvent.ExcavationRejected, (payload) => {
      onExcavationRejected?.(payload)
    })

    next.on(ServerToClientEvent.ExcavationUpdate, (payload) => {
      onExcavationUpdate?.(payload)
    })

    next.on(ServerToClientEvent.InventoryUpdate, (payload) => {
      inventory.value = [...payload.items]
      onInventoryUpdate?.(payload)
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
    inventory,
    requestChunks,
    sendInput,
    sendScan,
    sendExcavationStart,
    sendExcavationHit,
    connect,
    disconnect,
  }
}
