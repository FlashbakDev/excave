import { Application } from "pixi.js"
import {
  AOI_RADIUS,
  EXCAVATION_RANGE_PX,
  SIM_TICK_HZ,
  stepMovement,
  type ChunkCoordinate,
  type ChunkPayload,
  type ExcavationNodeId,
  type MovementButtons,
  type NodeDetectedPayload,
  type NodeUpdatedPayload,
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
import { planLocalReconcile } from "./localReconcile"
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

export type GameRendererStatsListener = (stats: GameRendererStats) => void
export type ChunkRequestListener = (chunks: ChunkCoordinate[]) => void
export type InputSendListener = (buttons: MovementButtons, sequence: number) => void
export type ScanListener = () => void
export type ExcavationStartListener = (nodeId: ExcavationNodeId) => void

const INPUT_SEND_INTERVAL_MS = 1000 / SIM_TICK_HZ

interface RemoteSample {
  from: WorldPosition
  to: WorldPosition
  fromTime: number
  toTime: number
}

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
  private chunkRequestListener: ChunkRequestListener | null = null
  private inputSendListener: InputSendListener | null = null
  private scanListener: ScanListener | null = null
  private excavationStartListener: ExcavationStartListener | null = null
  private fps = 0
  private destroyed = false
  private readonly movement = new MovementInput()
  private readonly interaction = new InteractionInput()
  private lastChunkKey = ""
  private localPlayerId: string | null = null
  private inputSequence = 0
  private lastSentButtons: MovementButtons = {
    up: false,
    down: false,
    left: false,
    right: false,
  }
  private inputAccumMs = 0
  private joined = false
  private readonly remotes = new Map<string, RemoteSample>()
  private movementLocked = false
  /** Last time a movement key was held — grace window avoids idle settle rubber-band. */
  private lastMoveInputAtMs = 0
  /** Smoothed one-way latency estimate from session pongs (seconds). */
  private oneWayLatencySec = 0.05
  /** Dev fixed cave map — skips network world / decor; lighting optional. */
  private terrainTestMode = false
  /** Lamp overlay — off for now while terrain relief is validated. */
  private lightingEnabled = false

  private readonly onZoomKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || !this.camera) {
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
    if (deltaMS > 0) {
      this.fps = 1000 / deltaMS
    }

    if (this.joined) {
      if (!this.movementLocked) {
        this.predictLocalMovement(deltaMS / 1000)
        this.flushInput(deltaMS)
      }
      this.handleInteraction()
      this.world.tickNodes(deltaMS / 1000)
      this.interpolateRemotes()
    }

    this.camera.setFocus(this.world.getPlayerPosition())
    this.updateLighting()
    this.maybeRequestChunks()
    this.emitStats()
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
    this.movementLocked = locked
  }

  setLocalPlayerId(playerId: string | null): void {
    this.localPlayerId = playerId
  }

  /** Update RTT estimate from session ping (ms round-trip). */
  setRoundTripMs(pingMs: number | null): void {
    if (pingMs === null || !Number.isFinite(pingMs) || pingMs < 0) {
      return
    }
    this.oneWayLatencySec = Math.min(0.2, Math.max(0.02, pingMs / 2000))
  }

  applyWorldJoin(spawn: WorldPosition, chunks: readonly ChunkPayload[]): void {
    if (!this.world || !this.camera || this.terrainTestMode) {
      // Caller must wait until mount() resolves — see GameCanvas flushPending.
      // Terrain test scene owns the map; ignore live world joins.
      return
    }
    this.world.upsertChunks(chunks)
    this.world.setPlayerPosition(spawn, { animate: false })
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
    this.world.setPlayerPosition(TERRAIN_TEST_SPAWN, { animate: false })
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

    for (const entry of payload.players) {
      if (entry.playerId === this.localPlayerId) {
        this.reconcileLocal(entry)
        continue
      }

      activeRemotes.add(entry.playerId)
      const previous = this.remotes.get(entry.playerId)
      const to = { x: entry.x, y: entry.y }
      if (previous) {
        this.remotes.set(entry.playerId, {
          from: interpolateRemote(previous, now),
          to,
          fromTime: now,
          toTime: now + 1000 / 10,
        })
      } else {
        this.remotes.set(entry.playerId, {
          from: to,
          to,
          fromTime: now,
          toTime: now,
        })
        this.world.setRemotePlayer(entry.playerId, to)
      }
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
    this.chunkRequestListener = null
    this.inputSendListener = null
    this.scanListener = null
    this.excavationStartListener = null
    this.remotes.clear()
    this.joined = false
    this.movementLocked = false
    this.lastMoveInputAtMs = 0
    this.oneWayLatencySec = 0.05
    this.inputSequence = 0

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

  private predictLocalMovement(dt: number): void {
    if (!this.world || dt <= 0) {
      return
    }

    const buttons = this.movement.read()
    if (buttons.up || buttons.down || buttons.left || buttons.right) {
      this.lastMoveInputAtMs = performance.now()
    }

    const current = this.world.getPlayerPosition()
    const stepped = stepMovement(
      current,
      buttons,
      dt,
      (position) => this.world!.isWalkableAt(position),
    )
    this.world.setPlayerPosition(stepped.position)
  }

  private reconcileLocal(entry: PlayerStateEntry): void {
    if (!this.world) {
      return
    }

    // Keep client sequences ahead of server ack after resume / remount.
    if (entry.lastProcessedSequence > this.inputSequence) {
      this.inputSequence = entry.lastProcessedSequence
    }

    const action = planLocalReconcile({
      current: this.world.getPlayerPosition(),
      auth: { x: entry.x, y: entry.y },
      buttons: this.movement.read(),
      nowMs: performance.now(),
      lastMoveInputAtMs: this.lastMoveInputAtMs,
      oneWayLatencySec: this.oneWayLatencySec,
      isWalkable: (position) => this.world!.isWalkableAt(position),
    })

    if (action.type === "none") {
      return
    }

    this.world.setPlayerPosition(action.position, { animate: false })
  }

  private flushInput(deltaMS: number): void {
    if (!this.inputSendListener) {
      return
    }

    this.inputAccumMs += deltaMS
    const buttons = this.movement.read()
    const changed = !this.movement.isEqual(buttons, this.lastSentButtons)

    if (!changed && this.inputAccumMs < INPUT_SEND_INTERVAL_MS) {
      return
    }

    this.inputAccumMs = 0
    this.inputSequence += 1
    this.lastSentButtons = { ...buttons }
    if (buttons.up || buttons.down || buttons.left || buttons.right) {
      this.lastMoveInputAtMs = performance.now()
    }
    this.inputSendListener(buttons, this.inputSequence)
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
    for (const [playerId, sample] of this.remotes) {
      this.world.setRemotePlayer(playerId, interpolateRemote(sample, now))
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

function interpolateRemote(sample: RemoteSample, now: number): WorldPosition {
  const span = sample.toTime - sample.fromTime
  if (span <= 0) {
    return { ...sample.to }
  }
  const t = Math.min(1, Math.max(0, (now - sample.fromTime) / span))
  return {
    x: sample.from.x + (sample.to.x - sample.from.x) * t,
    y: sample.from.y + (sample.to.y - sample.from.y) * t,
  }
}

function applyCanvasPixelStyle(canvas: HTMLCanvasElement): void {
  canvas.style.imageRendering = "pixelated"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.display = "block"
}
