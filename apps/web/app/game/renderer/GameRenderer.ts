import { Application } from "pixi.js"
import {
  AOI_RADIUS,
  EXCAVATION_RANGE_PX,
  SIM_TICK_HZ,
  type ChunkCoordinate,
  type ChunkPayload,
  type ExcavationNodeId,
  type MovementButtons,
  type NodeDetectedPayload,
  type NodeUpdatedPayload,
  type PlayerInputPayload,
  type PlayerStateEntry,
  type PlayerStatePayload,
  type WorldPosition,
} from "@excave/shared"
import { GameAssets, isCameraZoomLevel, type CameraZoomLevel } from "../assets"
import { InteractionInput } from "../input/InteractionInput"
import { MovementInput } from "../input/MovementInput"
import {
  PlayerLightOverlay,
  REMOTE_LIGHT_STRENGTH,
  type LightSource,
} from "../lighting"
import {
  TERRAIN_TEST_SPAWN,
  buildTerrainTestChunks,
} from "../world"
import { Camera } from "./Camera"
import { WORLD_BACKGROUND } from "./constants"
import { LocalMovementController } from "./LocalMovementController"
import { RemoteSnapshotBuffer } from "./RemoteSnapshotBuffer"
import { VisualPositionSmoother } from "./VisualPositionSmoother"
import { WorldContainer } from "./WorldContainer"

export interface GameRendererStats {
  fps: number
  width: number
  height: number
  playerX: number
  playerY: number
  chunkX: number
  chunkY: number
  remoteCount: number
  zoom: CameraZoomLevel
}

export interface MovementDebugSnapshot {
  enabled: boolean
  input: MovementButtons
  predicted: WorldPosition
  authoritative: WorldPosition | null
  render: WorldPosition
  camera: WorldPosition
  predictionErrorPx: number | null
  acknowledgedErrorPx: number | null
  snapshotAgeMs: number | null
  snapshotHz: number | null
  renderDtMs: number
  simulationDtMs: number | null
  reconcileAction: "none" | "apply"
  pendingInputCount: number
  visualErrorPx: number
  remoteInterpolationDelayMs: number | null
}

export type GameRendererStatsListener = (stats: GameRendererStats) => void
export type MovementDebugListener = (snapshot: MovementDebugSnapshot) => void
export type ChunkRequestListener = (chunks: ChunkCoordinate[]) => void
export type InputSendListener = (payload: PlayerInputPayload) => void
export type ScanListener = () => void
export type ExcavationStartListener = (nodeId: ExcavationNodeId) => void

const INPUT_BATCH_INTERVAL_MS = 1000 / SIM_TICK_HZ

/**
 * Owns the Pixi Application lifecycle for the underground world view.
 * Must only be constructed in the browser.
 */
export class GameRenderer {
  private app: Application | null = null
  private camera: Camera | null = null
  private world: WorldContainer | null = null
  private lighting: PlayerLightOverlay | null = null
  private assets: GameAssets | null = null
  private host: HTMLElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private statsListener: GameRendererStatsListener | null = null
  private movementDebugListener: MovementDebugListener | null = null
  private chunkRequestListener: ChunkRequestListener | null = null
  private inputSendListener: InputSendListener | null = null
  private scanListener: ScanListener | null = null
  private excavationStartListener: ExcavationStartListener | null = null
  private fps = 0
  private destroyed = false
  private readonly movement = new MovementInput()
  private readonly localMovement = new LocalMovementController()
  private readonly localVisual = new VisualPositionSmoother()
  private readonly interaction = new InteractionInput()
  private lastChunkKey = ""
  private localPlayerId: string | null = null
  private inputAccumMs = 0
  private joined = false
  private networkConnected = true
  private readonly remotes = new Map<string, RemoteSnapshotBuffer>()
  private movementLocked = false
  /** Dev fixed cave map — skips network world / decor; lighting optional. */
  private terrainTestMode = false
  /** Lamp overlay — off for now while terrain relief is validated. */
  private lightingEnabled = false
  private movementDebugEnabled = false
  private lastPredictedPosition: WorldPosition = { x: 0, y: 0 }
  private lastAuthoritativePosition: WorldPosition | null = null
  private lastSnapshotAtMs = 0
  private snapshotIntervalsMs: number[] = []
  private lastSnapshotServerTime = 0
  private lastSnapshotTick = 0
  private simulationDtMs: number | null = null
  private renderDtMs = 0
  private lastReconcileAction: "none" | "apply" = "none"
  private lastAcknowledgedErrorPx: number | null = null

  private readonly onZoomKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || !this.camera) {
      return
    }

    if (event.code === "F3" && import.meta.dev) {
      event.preventDefault()
      this.movementDebugEnabled = !this.movementDebugEnabled
      this.emitMovementDebug()
      return
    }
    if (this.terrainTestMode) {
      if (event.code === "KeyC") {
        event.preventDefault()
        this.world?.setTerrainDebugColors(!this.world.getTerrainDebugColors())
        return
      }
      if (event.code === "KeyL") {
        event.preventDefault()
        this.setLightingEnabled(!this.lightingEnabled)
        return
      }
    }

    const zoom = Number(event.key)
    if (!isCameraZoomLevel(zoom)) {
      return
    }
    event.preventDefault()
    this.camera.setZoom(zoom)
    this.updateLighting()
    this.emitStats()
  }

  private readonly onTick = (): void => {
    if (!this.app || !this.world || !this.camera || this.destroyed) {
      return
    }

    const deltaMS = this.app.ticker.deltaMS
    this.renderDtMs = deltaMS
    if (deltaMS > 0) {
      this.fps = 1000 / deltaMS
    }

    if (this.joined) {
      if (this.networkConnected) {
        if (!this.movementLocked) {
          this.predictLocalMovement(deltaMS)
        }
        this.flushInput(deltaMS)
      }
      const visualPosition = this.localVisual.resolve(
        this.localMovement.getPosition(),
        deltaMS,
      )
      this.world.setPlayerPosition(visualPosition)
      this.handleInteraction()
      this.world.tickNodes(deltaMS / 1000)
      this.interpolateRemotes()
    }

    this.camera.setFocus(this.world.getPlayerPosition())
    this.updateLighting()
    this.maybeRequestChunks()
    this.emitStats()
    this.emitMovementDebug()
  }

  async mount(host: HTMLElement): Promise<void> {
    if (this.app || this.destroyed) {
      throw new Error("GameRenderer can only be mounted once")
    }

    if (typeof window === "undefined") {
      throw new Error("GameRenderer requires a browser environment")
    }

    this.host = host

    GameAssets.configurePixelPerfectDefaults()

    const assets = new GameAssets()
    await assets.load()
    if (this.destroyed) {
      assets.destroy()
      return
    }
    this.assets = assets

    const app = new Application()
    const resolution = Math.max(1, Math.round(window.devicePixelRatio || 1))
    await app.init({
      background: WORLD_BACKGROUND,
      antialias: false,
      resolution,
      autoDensity: true,
      preference: "webgl",
      roundPixels: true,
    })

    if (this.destroyed) {
      app.destroy({ removeView: true }, { children: true })
      assets.destroy()
      this.assets = null
      return
    }

    this.app = app
    applyCanvasPixelStyle(app.canvas)
    host.appendChild(app.canvas)

    const world = new WorldContainer(assets)
    const camera = new Camera()
    camera.attachWorld(world.root)
    app.stage.addChild(camera.view)

    const lighting = new PlayerLightOverlay()
    lighting.root.visible = false
    app.stage.addChild(lighting.root)

    this.world = world
    this.camera = camera
    this.lighting = lighting

    this.resizeToHost()
    camera.setFocus(world.getPlayerPosition())
    this.updateLighting()

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeToHost()
    })
    this.resizeObserver.observe(host)

    this.movement.attach()
    this.interaction.attach()
    window.addEventListener("keydown", this.onZoomKeyDown)
    app.ticker.add(this.onTick)
    this.emitStats()
  }

  onStats(listener: GameRendererStatsListener | null): void {
    this.statsListener = listener
    this.emitStats()
  }

  onMovementDebug(listener: MovementDebugListener | null): void {
    this.movementDebugListener = listener
    this.emitMovementDebug()
  }

  onChunkRequest(listener: ChunkRequestListener | null): void {
    this.chunkRequestListener = listener
  }

  onInputSend(listener: InputSendListener | null): void {
    this.inputSendListener = listener
  }

  onScan(listener: ScanListener | null): void {
    this.scanListener = listener
  }

  onExcavationStart(listener: ExcavationStartListener | null): void {
    this.excavationStartListener = listener
  }

  playScanPulse(position: WorldPosition, rangePx: number): void {
    this.world?.playScanPulse(position, rangePx)
  }

  setMovementLocked(locked: boolean): void {
    if (
      locked &&
      !this.movementLocked &&
      this.world &&
      this.networkConnected
    ) {
      this.localMovement.queueImmediate(
        { up: false, down: false, left: false, right: false },
        (position) => this.world!.isWalkableAt(position),
      )
      const batch = this.localMovement.takeBatch(true)
      if (batch) {
        this.inputSendListener?.(batch)
      }
    }
    this.movementLocked = locked
  }

  setNetworkConnected(connected: boolean): void {
    this.networkConnected = connected
  }

  setLocalPlayerId(playerId: string | null): void {
    this.localPlayerId = playerId
  }

  setRoundTripMs(_pingMs: number | null): void {}

  applyWorldJoin(
    spawn: WorldPosition,
    chunks: readonly ChunkPayload[],
    movementEpoch: string,
    lastProcessedSequence: number,
  ): void {
    if (!this.world || !this.camera || this.terrainTestMode) {
      // Caller must wait until mount() resolves — see GameCanvas flushPending.
      // Terrain test scene owns the map; ignore live world joins.
      return
    }
    this.world.upsertChunks(chunks)
    this.localMovement.reset(movementEpoch, lastProcessedSequence, spawn)
    this.localVisual.reset()
    this.world.setPlayerPosition(spawn, { animate: false })
    this.lastPredictedPosition = { ...spawn }
    this.lastAuthoritativePosition = { ...spawn }
    this.camera.setFocus(spawn)
    this.lastChunkKey = ""
    this.joined = true
    this.maybeRequestChunks()
    this.emitStats()
  }

  applyChunks(chunks: readonly ChunkPayload[]): void {
    if (this.terrainTestMode) {
      return
    }
    this.world?.upsertChunks(chunks)
    this.emitStats()
  }

  /**
   * Dev-only fixed cave for FLOOR/WALL relief checks.
   * Decor off, debug colors on, lighting off until toggled (L).
   */
  loadTerrainTestScene(options?: {
    debugColors?: boolean
    lighting?: boolean
  }): void {
    if (!this.world || !this.camera) {
      return
    }

    this.terrainTestMode = true
    this.world.setDecorEnabled(false)
    this.world.setTerrainDebugColors(options?.debugColors ?? true)
    this.setLightingEnabled(options?.lighting ?? false)

    const chunks = buildTerrainTestChunks()
    this.world.upsertChunks(chunks)
    this.localMovement.reset("terrain-test", 0, TERRAIN_TEST_SPAWN)
    this.localVisual.reset()
    this.world.setPlayerPosition(TERRAIN_TEST_SPAWN, { animate: false })
    this.lastPredictedPosition = { ...TERRAIN_TEST_SPAWN }
    this.lastAuthoritativePosition = { ...TERRAIN_TEST_SPAWN }
    this.camera.setFocus(TERRAIN_TEST_SPAWN)
    this.lastChunkKey = ""
    this.joined = true
    this.updateLighting()
    this.emitStats()
  }

  setLightingEnabled(enabled: boolean): void {
    this.lightingEnabled = enabled
    if (this.lighting) {
      this.lighting.root.visible = enabled
    }
    if (enabled) {
      this.updateLighting()
    }
  }

  isTerrainTestMode(): boolean {
    return this.terrainTestMode
  }

  isLightingEnabled(): boolean {
    return this.lightingEnabled
  }

  applyPlayerState(payload: PlayerStatePayload): void {
    if (!this.world || !this.localPlayerId) {
      return
    }

    const activeRemotes = new Set<string>()
    const now = performance.now()
    this.recordSnapshotTiming(payload, now)

    for (const entry of payload.players) {
      if (entry.playerId === this.localPlayerId) {
        this.lastAuthoritativePosition = { x: entry.x, y: entry.y }
        this.reconcileLocal(entry)
        continue
      }

      activeRemotes.add(entry.playerId)
      let track = this.remotes.get(entry.playerId)
      if (!track) {
        track = new RemoteSnapshotBuffer()
        this.remotes.set(entry.playerId, track)
      }
      track.push({
        serverTime: payload.serverTime,
        receivedAtMs: now,
        position: { x: entry.x, y: entry.y },
        velocity: { x: entry.vx, y: entry.vy },
      })
      this.world.setRemotePlayer(entry.playerId, { x: entry.x, y: entry.y })
    }

    for (const id of [...this.remotes.keys()]) {
      if (!activeRemotes.has(id)) {
        this.remotes.delete(id)
      }
    }
    this.world.syncRemotePlayers(activeRemotes)
  }

  applyNodeDetected(payload: NodeDetectedPayload): void {
    this.world?.upsertDetectedNode(
      payload.nodeId,
      payload.position,
      payload.visualState,
    )
  }

  applyNodeUpdated(payload: NodeUpdatedPayload): void {
    this.world?.updateNodeVisual(payload.nodeId, payload.visualState)
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.statsListener = null
    this.movementDebugListener = null
    this.chunkRequestListener = null
    this.inputSendListener = null
    this.scanListener = null
    this.excavationStartListener = null
    this.remotes.clear()
    this.joined = false
    this.movementLocked = false
    this.networkConnected = false
    this.localVisual.reset()

    this.movement.detach()
    this.interaction.detach()
    window.removeEventListener("keydown", this.onZoomKeyDown)

    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.app) {
      this.app.ticker.remove(this.onTick)
      this.app.destroy({ removeView: true }, { children: true })
      this.app = null
    }

    this.assets?.destroy()
    this.assets = null
    this.lighting?.destroy()
    this.lighting = null
    this.world = null
    this.camera = null
    this.host = null
  }

  private predictLocalMovement(elapsedMs: number): void {
    if (!this.world || elapsedMs <= 0) {
      return
    }

    const predicted = this.localMovement.simulate(
      elapsedMs,
      this.movement.read(),
      (position) => this.world!.isWalkableAt(position),
    )
    this.lastPredictedPosition = predicted
  }

  private reconcileLocal(entry: PlayerStateEntry): void {
    if (!this.world) {
      return
    }

    const previousVisual = this.world.getPlayerPosition()
    const result = this.localMovement.reconcile(
      entry,
      (position) => this.world!.isWalkableAt(position),
    )
    if (!result.accepted) {
      this.lastReconcileAction = "none"
      return
    }
    this.lastAcknowledgedErrorPx = result.correctionPx
    this.lastReconcileAction = result.correctionPx > 0.01 ? "apply" : "none"
    this.localVisual.preserveVisualPosition(previousVisual, result.position)
    this.lastPredictedPosition = { ...result.position }
  }

  private recordSnapshotTiming(payload: PlayerStatePayload, now: number): void {
    if (this.lastSnapshotAtMs > 0) {
      this.snapshotIntervalsMs.push(now - this.lastSnapshotAtMs)
      if (this.snapshotIntervalsMs.length > 30) {
        this.snapshotIntervalsMs.shift()
      }
    }
    if (
      this.lastSnapshotServerTime > 0 &&
      payload.tick > this.lastSnapshotTick
    ) {
      this.simulationDtMs =
        (payload.serverTime - this.lastSnapshotServerTime) /
        (payload.tick - this.lastSnapshotTick)
    }
    this.lastSnapshotAtMs = now
    this.lastSnapshotServerTime = payload.serverTime
    this.lastSnapshotTick = payload.tick
  }

  private emitMovementDebug(): void {
    if (!this.movementDebugListener || !this.world || !this.camera) {
      return
    }
    const render = this.world.getPlayerPosition()
    const auth = this.lastAuthoritativePosition
    const averageInterval =
      this.snapshotIntervalsMs.length > 0
        ? this.snapshotIntervalsMs.reduce((sum, value) => sum + value, 0) /
          this.snapshotIntervalsMs.length
        : null
    this.movementDebugListener({
      enabled: this.movementDebugEnabled,
      input: this.movement.read(),
      predicted: { ...this.lastPredictedPosition },
      authoritative: auth ? { ...auth } : null,
      render: { ...render },
      camera: this.camera.getFocus(),
      predictionErrorPx: auth
        ? Math.hypot(render.x - auth.x, render.y - auth.y)
        : null,
      acknowledgedErrorPx: this.lastAcknowledgedErrorPx,
      snapshotAgeMs:
        this.lastSnapshotAtMs > 0 ? performance.now() - this.lastSnapshotAtMs : null,
      snapshotHz:
        averageInterval && averageInterval > 0 ? 1000 / averageInterval : null,
      renderDtMs: this.renderDtMs,
      simulationDtMs: this.simulationDtMs,
      reconcileAction: this.lastReconcileAction,
      pendingInputCount: this.localMovement.getPendingCount(),
      visualErrorPx: this.localVisual.getErrorPx(),
      remoteInterpolationDelayMs:
        this.remotes.values().next().value?.getInterpolationDelayMs() ?? null,
    })
  }

  private flushInput(deltaMS: number): void {
    if (!this.inputSendListener) {
      return
    }

    this.inputAccumMs += deltaMS
    if (this.inputAccumMs < INPUT_BATCH_INTERVAL_MS) {
      return
    }

    this.inputAccumMs %= INPUT_BATCH_INTERVAL_MS
    const batch = this.localMovement.takeBatch(this.movementLocked)
    if (batch) {
      this.inputSendListener(batch)
    }
  }

  private handleInteraction(): void {
    if (!this.world || !this.interaction.consumeInteractPressed()) {
      return
    }

    const nearest = this.world.getNearestDetectedNode(
      this.world.getPlayerPosition(),
      EXCAVATION_RANGE_PX,
    )
    if (nearest) {
      this.excavationStartListener?.(nearest.nodeId)
      return
    }

    this.scanListener?.()
  }

  private interpolateRemotes(): void {
    if (!this.world) {
      return
    }
    const now = performance.now()
    for (const [playerId, track] of this.remotes) {
      const position = track.sample(now)
      if (position) {
        this.world.setRemotePlayer(playerId, position)
      }
    }
  }

  private maybeRequestChunks(): void {
    if (!this.world || !this.chunkRequestListener || this.terrainTestMode) {
      return
    }

    const chunk = this.world.getChunkCoordinate()
    const key = `${chunk.x}:${chunk.y}`
    if (key === this.lastChunkKey) {
      return
    }
    this.lastChunkKey = key

    // Keep only the AOI neighborhood — prevents sprite accumulation on long walks.
    this.world.pruneChunksOutside(chunk, AOI_RADIUS)

    const missing = this.world.getMissingNeighborhood(chunk, AOI_RADIUS)
    if (missing.length > 0) {
      this.chunkRequestListener(missing)
    }
  }

  private resizeToHost(): void {
    if (!this.app || !this.host || !this.camera) {
      return
    }

    const width = Math.max(1, Math.floor(this.host.clientWidth))
    const height = Math.max(1, Math.floor(this.host.clientHeight))

    this.app.renderer.resize(width, height)
    this.camera.setViewport(width, height)
    this.lighting?.setViewport(width, height)
    this.updateLighting()
    this.emitStats()
  }

  private updateLighting(): void {
    if (!this.world || !this.camera || !this.lighting || !this.lightingEnabled) {
      return
    }

    const localLight = this.world.getLocalLightPosition()
    const localFeet = this.world.getPlayerPosition()
    const lights: LightSource[] = [
      {
        x: localLight.x,
        y: localLight.y,
        floorX: localFeet.x,
        floorY: localFeet.y,
        strength: 1,
      },
    ]
    for (const remote of this.world.getRemoteLightPositions()) {
      lights.push({
        x: remote.x,
        y: remote.y,
        floorX: remote.x,
        floorY: remote.y + 14,
        strength: REMOTE_LIGHT_STRENGTH,
      })
    }

    this.lighting.redraw(
      lights,
      this.camera.getZoom(),
      this.camera.getOffset(),
      (tx, ty) => this.world!.isFloorTile(tx, ty),
    )
  }

  private emitStats(): void {
    if (!this.statsListener || !this.app || !this.world || !this.camera) {
      return
    }

    const player = this.world.getPlayerPosition()
    const chunk = this.world.getChunkCoordinate()
    this.statsListener({
      fps: this.fps,
      width: this.app.screen.width,
      height: this.app.screen.height,
      playerX: player.x,
      playerY: player.y,
      chunkX: chunk.x,
      chunkY: chunk.y,
      remoteCount: this.world.getRemoteCount(),
      zoom: this.camera.getZoom(),
    })
  }
}

function applyCanvasPixelStyle(canvas: HTMLCanvasElement): void {
  canvas.style.imageRendering = "pixelated"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.display = "block"
}
