import { Container, Graphics, Text } from "pixi.js"
import {
  CHUNK_SIZE,
  TILE_SIZE,
  TileType,
  chunkTileIndex,
  type ChunkCoordinate,
  type ChunkPayload,
  type NodeVisualState,
  type WorldPosition,
  NodeVisualState as Visual,
} from "@excave/shared"
import {
  CHUNK_BORDER_COLOR,
  FLOOR_COLOR,
  NODE_BUSY_FILL,
  NODE_DEPLETED_FILL,
  NODE_DETECTED_FILL,
  PLAYER_FILL,
  PLAYER_RADIUS,
  PLAYER_STROKE,
  REMOTE_PLAYER_FILL,
  REMOTE_PLAYER_STROKE,
  SCAN_FILL_COLOR,
  SCAN_RING_COLOR,
  WALL_COLOR,
} from "./constants"

interface NodeMarker {
  root: Container
  body: Graphics
  pulse: number
}

interface ScanPulse {
  x: number
  y: number
  rangePx: number
  age: number
  duration: number
}

/**
 * Holds the world scene: received chunks + local/remote player markers.
 */
export class WorldContainer {
  readonly root = new Container()

  private readonly tilesLayer = new Container()
  private readonly borderLayer = new Graphics()
  private readonly remotesLayer = new Container()
  private readonly nodesLayer = new Container()
  private readonly effectsLayer = new Graphics()
  private readonly player = new Graphics()
  private readonly chunkGraphics = new Map<string, Graphics>()
  private readonly chunkTiles = new Map<string, number[]>()
  private readonly remoteMarkers = new Map<string, Container>()
  private readonly nodeMarkers = new Map<string, NodeMarker>()
  private readonly scanPulses: ScanPulse[] = []
  private playerX = 0
  private playerY = 0
  private showChunkBorders = true
  private remoteCount = 0

  constructor() {
    this.root.addChild(this.tilesLayer)
    this.root.addChild(this.borderLayer)
    this.root.addChild(this.effectsLayer)
    this.root.addChild(this.nodesLayer)
    this.root.addChild(this.remotesLayer)
    this.root.addChild(this.player)
    this.drawPlayer()
  }

  getPlayerPosition(): WorldPosition {
    return { x: this.playerX, y: this.playerY }
  }

  setPlayerPosition(position: WorldPosition): void {
    this.playerX = position.x
    this.playerY = position.y
    this.player.position.set(this.playerX, this.playerY)
  }

  getChunkCoordinate(): ChunkCoordinate {
    const tileX = Math.floor(this.playerX / TILE_SIZE)
    const tileY = Math.floor(this.playerY / TILE_SIZE)
    return {
      x: Math.floor(tileX / CHUNK_SIZE),
      y: Math.floor(tileY / CHUNK_SIZE),
    }
  }

  upsertChunks(chunks: readonly ChunkPayload[]): void {
    for (const chunk of chunks) {
      this.upsertChunk(chunk)
    }
    this.redrawBorders()
  }

  hasChunk(coordinate: ChunkCoordinate): boolean {
    return this.chunkTiles.has(chunkKey(coordinate))
  }

  getMissingNeighborhood(
    center: ChunkCoordinate,
    radius = 1,
  ): ChunkCoordinate[] {
    const missing: ChunkCoordinate[] = []
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        const coordinate = { x, y }
        if (!this.hasChunk(coordinate)) {
          missing.push(coordinate)
        }
      }
    }
    return missing
  }

  /**
   * Walkability from already received chunk data (client prediction).
   */
  isWalkableAt(position: WorldPosition): boolean {
    const tileX = Math.floor(position.x / TILE_SIZE)
    const tileY = Math.floor(position.y / TILE_SIZE)
    const chunkX = Math.floor(tileX / CHUNK_SIZE)
    const chunkY = Math.floor(tileY / CHUNK_SIZE)
    const tiles = this.chunkTiles.get(chunkKey({ x: chunkX, y: chunkY }))
    if (!tiles) {
      return false
    }

    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return tiles[chunkTileIndex(localX, localY)] === TileType.Floor
  }

  getRemoteCount(): number {
    return this.remoteCount
  }

  upsertDetectedNode(
    nodeId: string,
    position: WorldPosition,
    visualState: NodeVisualState,
  ): void {
    let marker = this.nodeMarkers.get(nodeId)
    if (!marker) {
      const root = new Container()
      const body = new Graphics()
      root.addChild(body)
      marker = { root, body, pulse: 0 }
      this.nodeMarkers.set(nodeId, marker)
      this.nodesLayer.addChild(root)
    }
    marker.root.position.set(position.x, position.y)
    this.drawNodeBody(marker, visualState)
  }

  updateNodeVisual(nodeId: string, visualState: NodeVisualState): void {
    const marker = this.nodeMarkers.get(nodeId)
    if (!marker) {
      return
    }
    this.drawNodeBody(marker, visualState)
  }

  getNearestDetectedNode(
    position: WorldPosition,
    maxDistance: number,
  ): { nodeId: string; distance: number } | null {
    let best: { nodeId: string; distance: number } | null = null
    for (const [nodeId, marker] of this.nodeMarkers) {
      const dist = Math.hypot(
        marker.root.position.x - position.x,
        marker.root.position.y - position.y,
      )
      if (dist <= maxDistance && (!best || dist < best.distance)) {
        best = { nodeId, distance: dist }
      }
    }
    return best
  }

  tickNodes(dt: number): void {
    for (const marker of this.nodeMarkers.values()) {
      marker.pulse += dt * 4
      const scale = 1 + Math.sin(marker.pulse) * 0.12
      marker.root.scale.set(scale)
    }
    this.tickScanPulses(dt)
  }

  /** Expand/fade ring showing the authoritative SCAN radius. */
  playScanPulse(position: WorldPosition, rangePx: number): void {
    this.scanPulses.push({
      x: position.x,
      y: position.y,
      rangePx,
      age: 0,
      duration: 0.55,
    })
  }

  private tickScanPulses(dt: number): void {
    if (this.scanPulses.length === 0) {
      this.effectsLayer.clear()
      return
    }

    for (const pulse of this.scanPulses) {
      pulse.age += dt
    }
    for (let i = this.scanPulses.length - 1; i >= 0; i -= 1) {
      if ((this.scanPulses[i]?.age ?? 0) >= (this.scanPulses[i]?.duration ?? 0)) {
        this.scanPulses.splice(i, 1)
      }
    }

    this.effectsLayer.clear()
    for (const pulse of this.scanPulses) {
      const t = Math.min(1, pulse.age / pulse.duration)
      const radius = pulse.rangePx * (0.35 + 0.65 * t)
      const fillAlpha = 0.22 * (1 - t)
      const ringAlpha = 0.85 * (1 - t)
      this.effectsLayer.circle(pulse.x, pulse.y, radius)
      this.effectsLayer.fill({ color: SCAN_FILL_COLOR, alpha: fillAlpha })
      this.effectsLayer.circle(pulse.x, pulse.y, radius)
      this.effectsLayer.stroke({
        width: 2,
        color: SCAN_RING_COLOR,
        alpha: ringAlpha,
      })
      // Outer target ring at full range so the touched zone is readable.
      this.effectsLayer.circle(pulse.x, pulse.y, pulse.rangePx)
      this.effectsLayer.stroke({
        width: 1.5,
        color: SCAN_RING_COLOR,
        alpha: 0.35 * (1 - t * 0.5),
      })
    }
  }

  setRemotePlayer(playerId: string, position: WorldPosition): void {
    let marker = this.remoteMarkers.get(playerId)
    if (!marker) {
      marker = new Container()
      const body = new Graphics()
      body.circle(0, 0, PLAYER_RADIUS)
      body.fill({ color: REMOTE_PLAYER_FILL })
      body.stroke({ width: 2, color: REMOTE_PLAYER_STROKE })

      const label = new Text({
        text: playerId.slice(0, 8),
        style: {
          fill: 0xc5d8e4,
          fontSize: 11,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
      })
      label.anchor.set(0.5, 1)
      label.position.set(0, -PLAYER_RADIUS - 4)

      marker.addChild(body)
      marker.addChild(label)
      this.remoteMarkers.set(playerId, marker)
      this.remotesLayer.addChild(marker)
    }
    marker.position.set(position.x, position.y)
    marker.visible = true
  }

  removeRemotePlayer(playerId: string): void {
    const marker = this.remoteMarkers.get(playerId)
    if (!marker) {
      return
    }
    this.remotesLayer.removeChild(marker)
    marker.destroy({ children: true })
    this.remoteMarkers.delete(playerId)
  }

  syncRemotePlayers(activeIds: ReadonlySet<string>): void {
    for (const id of [...this.remoteMarkers.keys()]) {
      if (!activeIds.has(id)) {
        this.removeRemotePlayer(id)
      }
    }
    this.remoteCount = activeIds.size
  }

  destroy(): void {
    this.root.destroy({ children: true })
    this.chunkGraphics.clear()
    this.chunkTiles.clear()
    this.remoteMarkers.clear()
    this.nodeMarkers.clear()
  }

  private drawNodeBody(marker: NodeMarker, visualState: NodeVisualState): void {
    const color =
      visualState === Visual.Busy
        ? NODE_BUSY_FILL
        : visualState === Visual.Depleted
          ? NODE_DEPLETED_FILL
          : NODE_DETECTED_FILL
    marker.body.clear()
    marker.body.star(0, 0, 4, 10, 4)
    marker.body.fill({ color, alpha: 0.9 })
    marker.body.stroke({ width: 1.5, color: 0xf5e6c8, alpha: 0.85 })
  }

  private upsertChunk(chunk: ChunkPayload): void {
    const key = chunkKey(chunk.chunk)
    const existing = this.chunkGraphics.get(key)
    if (existing) {
      existing.destroy()
      this.tilesLayer.removeChild(existing)
    }

    const graphics = new Graphics()
    const originX = chunk.chunk.x * CHUNK_SIZE * TILE_SIZE
    const originY = chunk.chunk.y * CHUNK_SIZE * TILE_SIZE

    for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const tile = chunk.tiles[chunkTileIndex(localX, localY)]
        const color = tile === TileType.Floor ? FLOOR_COLOR : WALL_COLOR
        graphics.rect(
          originX + localX * TILE_SIZE,
          originY + localY * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        )
        graphics.fill({ color })
      }
    }

    this.chunkTiles.set(key, [...chunk.tiles])
    this.chunkGraphics.set(key, graphics)
    this.tilesLayer.addChild(graphics)
  }

  private redrawBorders(): void {
    this.borderLayer.clear()
    if (!this.showChunkBorders) {
      return
    }

    for (const key of this.chunkGraphics.keys()) {
      const [xText, yText] = key.split(":")
      const chunkX = Number(xText)
      const chunkY = Number(yText)
      const originX = chunkX * CHUNK_SIZE * TILE_SIZE
      const originY = chunkY * CHUNK_SIZE * TILE_SIZE
      const size = CHUNK_SIZE * TILE_SIZE

      this.borderLayer.rect(originX, originY, size, size)
      this.borderLayer.stroke({
        width: 1,
        color: CHUNK_BORDER_COLOR,
        alpha: 0.55,
      })
    }
  }

  private drawPlayer(): void {
    this.player.clear()
    this.player.circle(0, 0, PLAYER_RADIUS)
    this.player.fill({ color: PLAYER_FILL })
    this.player.stroke({ width: 2, color: PLAYER_STROKE })
    this.player.position.set(this.playerX, this.playerY)
  }
}

function chunkKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}:${coordinate.y}`
}
