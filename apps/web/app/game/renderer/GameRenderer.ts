import { Application } from "pixi.js"
import type {
  ChunkCoordinate,
  ChunkPayload,
  WorldPosition,
} from "@excave/shared"
import { Camera } from "./Camera"
import { WORLD_BACKGROUND } from "./constants"
import { WorldContainer } from "./WorldContainer"

export interface GameRendererStats {
  fps: number
  width: number
  height: number
  playerX: number
  playerY: number
  chunkX: number
  chunkY: number
}

export type GameRendererStatsListener = (stats: GameRendererStats) => void
export type ChunkRequestListener = (chunks: ChunkCoordinate[]) => void

const LOCAL_SPEED_PX_PER_SEC = 140

/**
 * Owns the Pixi Application lifecycle for the underground world view.
 * Must only be constructed in the browser.
 */
export class GameRenderer {
  private app: Application | null = null
  private camera: Camera | null = null
  private world: WorldContainer | null = null
  private host: HTMLElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private statsListener: GameRendererStatsListener | null = null
  private chunkRequestListener: ChunkRequestListener | null = null
  private fps = 0
  private destroyed = false
  private readonly pressed = new Set<string>()
  private lastChunkKey = ""

  private readonly onTick = (): void => {
    if (!this.app || !this.world || !this.camera || this.destroyed) {
      return
    }

    const deltaMS = this.app.ticker.deltaMS
    if (deltaMS > 0) {
      this.fps = 1000 / deltaMS
    }

    this.applyLocalMovement(deltaMS / 1000)
    this.camera.setFocus(this.world.getPlayerPosition())
    this.maybeRequestChunks()
    this.emitStats()
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code)
  }

  async mount(host: HTMLElement): Promise<void> {
    if (this.app || this.destroyed) {
      throw new Error("GameRenderer can only be mounted once")
    }

    if (typeof window === "undefined") {
      throw new Error("GameRenderer requires a browser environment")
    }

    this.host = host

    const app = new Application()
    await app.init({
      background: WORLD_BACKGROUND,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: "webgl",
    })

    if (this.destroyed) {
      app.destroy({ removeView: true }, { children: true })
      return
    }

    this.app = app
    host.appendChild(app.canvas)

    const world = new WorldContainer()
    const camera = new Camera()
    camera.attachWorld(world.root)
    app.stage.addChild(camera.view)

    this.world = world
    this.camera = camera

    this.resizeToHost()
    camera.setFocus(world.getPlayerPosition())

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeToHost()
    })
    this.resizeObserver.observe(host)

    window.addEventListener("keydown", this.onKeyDown)
    window.addEventListener("keyup", this.onKeyUp)

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

  applyWorldJoin(spawn: WorldPosition, chunks: readonly ChunkPayload[]): void {
    if (!this.world || !this.camera) {
      return
    }
    this.world.upsertChunks(chunks)
    this.world.setPlayerPosition(spawn)
    this.camera.setFocus(spawn)
    this.lastChunkKey = ""
    this.maybeRequestChunks()
    this.emitStats()
  }

  applyChunks(chunks: readonly ChunkPayload[]): void {
    this.world?.upsertChunks(chunks)
    this.emitStats()
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.statsListener = null
    this.chunkRequestListener = null
    this.pressed.clear()

    window.removeEventListener("keydown", this.onKeyDown)
    window.removeEventListener("keyup", this.onKeyUp)

    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    if (this.app) {
      this.app.ticker.remove(this.onTick)
      this.app.destroy({ removeView: true }, { children: true })
      this.app = null
    }

    this.world = null
    this.camera = null
    this.host = null
  }

  private applyLocalMovement(dt: number): void {
    if (!this.world || dt <= 0) {
      return
    }

    let dx = 0
    let dy = 0
    if (this.pressed.has("KeyW") || this.pressed.has("KeyZ") || this.pressed.has("ArrowUp")) {
      dy -= 1
    }
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) {
      dy += 1
    }
    if (this.pressed.has("KeyA") || this.pressed.has("KeyQ") || this.pressed.has("ArrowLeft")) {
      dx -= 1
    }
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) {
      dx += 1
    }

    if (dx === 0 && dy === 0) {
      return
    }

    const length = Math.hypot(dx, dy) || 1
    const step = (LOCAL_SPEED_PX_PER_SEC * dt) / length
    const current = this.world.getPlayerPosition()
    const next = {
      x: current.x + dx * step,
      y: current.y + dy * step,
    }

    // Axis-separated so sliding along walls works for exploration.
    const nextX = { x: next.x, y: current.y }
    const nextY = { x: current.x, y: next.y }
    const resolved = {
      x: this.world.isWalkableAt(nextX) ? next.x : current.x,
      y: this.world.isWalkableAt(nextY) ? next.y : current.y,
    }

    this.world.setPlayerPosition(resolved)
  }

  private maybeRequestChunks(): void {
    if (!this.world || !this.chunkRequestListener) {
      return
    }

    const chunk = this.world.getChunkCoordinate()
    const key = `${chunk.x}:${chunk.y}`
    if (key === this.lastChunkKey) {
      return
    }
    this.lastChunkKey = key

    const missing = this.world.getMissingNeighborhood(chunk, 1)
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
    this.emitStats()
  }

  private emitStats(): void {
    if (!this.statsListener || !this.app || !this.world) {
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
    })
  }
}
