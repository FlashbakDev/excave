import {
  AOI_RADIUS,
  SIM_TICK_HZ,
  STATE_BROADCAST_HZ,
  ServerToClientEvent,
  type PlayerStatePayload,
} from "@excave/shared"
import type { AreaOfInterestManager } from "../aoi/AreaOfInterestManager.js"
import type { GameSocketServer } from "../realtime/socket.js"
import type { PlayerRegistry } from "../session/PlayerRegistry.js"
import type { PlayerRuntimeStore } from "./PlayerRuntimeStore.js"

const SIM_INTERVAL_MS = 1000 / SIM_TICK_HZ
const BROADCAST_EVERY_N_TICKS = Math.max(
  1,
  Math.round(SIM_TICK_HZ / STATE_BROADCAST_HZ),
)

export class GameLoop {
  private timer: ReturnType<typeof setInterval> | null = null
  private tick = 0
  private running = false

  constructor(
    private readonly store: PlayerRuntimeStore,
    private readonly io: GameSocketServer,
    private readonly registry: PlayerRegistry,
    private readonly aoi: AreaOfInterestManager,
  ) {}

  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    this.timer = setInterval(() => {
      this.step()
    }, SIM_INTERVAL_MS)
    if (typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref()
    }
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** Exposed for tests. */
  step(): void {
    this.tick += 1
    const changes = this.store.tick(SIM_INTERVAL_MS / 1000)
    this.applyChunkRoomChanges(changes)

    if (this.tick % BROADCAST_EVERY_N_TICKS === 0) {
      this.broadcast()
    }
  }

  private applyChunkRoomChanges(
    changes: ReturnType<PlayerRuntimeStore["tick"]>,
  ): void {
    for (const change of changes) {
      const guest = this.registry.getByPlayerId(change.playerId)
      if (!guest) {
        continue
      }
      const socket = this.io.sockets.sockets.get(guest.socketId)
      if (!socket) {
        continue
      }

      const { roomsToJoin, roomsToLeave } = this.aoi.diff(
        change.previous,
        change.next,
      )
      for (const room of roomsToLeave) {
        void socket.leave(room)
      }
      for (const room of roomsToJoin) {
        void socket.join(room)
      }
    }
  }

  /**
   * Emit an AOI-filtered snapshot to each player socket.
   * No global `io.emit` for world player state.
   */
  private broadcast(): void {
    if (this.store.count() === 0) {
      return
    }

    const serverTime = Date.now()

    for (const guest of this.registry.list()) {
      const runtime = this.store.get(guest.playerId)
      if (!runtime) {
        continue
      }

      const socket = this.io.sockets.sockets.get(guest.socketId)
      if (!socket) {
        continue
      }

      const payload: PlayerStatePayload = {
        tick: this.tick,
        serverTime,
        players: this.store.snapshotInAoi(runtime.currentChunk, AOI_RADIUS),
      }
      socket.emit(ServerToClientEvent.PlayerState, payload)
    }
  }
}
