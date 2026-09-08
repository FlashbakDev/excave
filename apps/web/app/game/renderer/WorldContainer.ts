import { Container, Graphics, Sprite, type Texture } from "pixi.js"
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
  ASSET_DISPLAY_SCALE,
  type GameAssets,
} from "../assets"
import { CharacterView } from "../characters"
import {
  DEFAULT_VISUAL_DECOR_SEED,
  resolveDecor,
  type DecorLayer,
  type DecorPlacement,
} from "../environment"
import {
  resolveTerrainPlacements,
  TERRAIN_DEBUG_COLORS,
  type TerrainLayer,
} from "../world"
import {
  CHUNK_BORDER_COLOR,
  NODE_BUSY_FILL,
  NODE_DEPLETED_FILL,
  NODE_DETECTED_FILL,
  REMOTE_PLAYER_TINT,
  SCAN_FILL_COLOR,
  SCAN_RING_COLOR,
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

interface RemoteCharacter {
  view: CharacterView
  lastX: number
  lastY: number
}

interface ChunkDecorContainers {
  ground: Container
  wall: Container
  foreground: Container
}

interface ChunkTerrainContainers {
  wallTop: Container
  ground: Container
  wallFace: Container
}

/**
 * Holds the world scene: received chunks + local/remote explorers.
 * Terrain stack: void (clear) → ground → wallTop → wallFaces → decor → entities.
 * Lighting is applied above this root by GameRenderer.
 */
export class WorldContainer {
  readonly root = new Container()

  private readonly groundLayer = new Container()
  private readonly wallTopLayer = new Container()
  private readonly wallFaceLayer = new Container()
  private readonly groundDecorLayer = new Container()
  private readonly wallDecorLayer = new Container()
  private readonly borderLayer = new Graphics()
  private readonly remotesLayer = new Container()
  private readonly nodesLayer = new Container()
  private readonly foregroundDecorLayer = new Container()
  private readonly effectsLayer = new Graphics()
  private readonly localCharacter: CharacterView
  private readonly chunkTerrain = new Map<string, ChunkTerrainContainers>()
  private readonly chunkDecor = new Map<string, ChunkDecorContainers>()
  private readonly chunkTiles = new Map<string, number[]>()
  private readonly remotes = new Map<string, RemoteCharacter>()
  private readonly nodeMarkers = new Map<string, NodeMarker>()
  private readonly scanPulses: ScanPulse[] = []
  private readonly assets: GameAssets
  private playerX = 0
  private playerY = 0
  private showChunkBorders = false
  private remoteCount = 0
  private visualDecorSeed = DEFAULT_VISUAL_DECOR_SEED
  private decorEnabled = true
  private terrainDebugColors = false

  constructor(assets: GameAssets) {
    this.assets = assets
    this.localCharacter = new CharacterView(assets.getExplorerTextures())

    // void (app background) → ground → wallTop → wallFaces → decor → entities
    this.root.addChild(this.groundLayer)
    this.root.addChild(this.wallTopLayer)
    this.root.addChild(this.wallFaceLayer)
    this.root.addChild(this.groundDecorLayer)
    this.root.addChild(this.wallDecorLayer)
    this.root.addChild(this.foregroundDecorLayer)
    this.root.addChild(this.borderLayer)
    this.root.addChild(this.remotesLayer)
    this.root.addChild(this.nodesLayer)
    this.root.addChild(this.localCharacter.root)
    this.root.addChild(this.effectsLayer)
    this.localCharacter.setWorldPosition(this.playerX, this.playerY)
  }

  /** Dev / terrain-test: skip cave decor placement. */
  setDecorEnabled(enabled: boolean): void {
    if (this.decorEnabled === enabled) {
      return
    }
    this.decorEnabled = enabled
    this.redrawAllChunks()
  }

  /** Dev: flat FLOOR/WALL_TOP/WALL_FACE colors to validate the resolver. */
  setTerrainDebugColors(enabled: boolean): void {
    if (this.terrainDebugColors === enabled) {
      return
    }
    this.terrainDebugColors = enabled
    this.redrawAllChunks()
  }

  getTerrainDebugColors(): boolean {
    return this.terrainDebugColors
  }

  private redrawAllChunks(): void {
    for (const key of [...this.chunkTiles.keys()]) {
      this.redrawChunkGraphics(key)
    }
  }

  /** Optional client visual seed (e.g. hashed worldId). No server round-trip. */
  setVisualDecorSeed(seed: number): void {
    this.visualDecorSeed = seed >>> 0
  }

  getPlayerPosition(): WorldPosition {
    return { x: this.playerX, y: this.playerY }
  }

  /** Lamp focus for the local explorer (helmet, not feet). */
  getLocalLightPosition(): WorldPosition {
    return this.localCharacter.getLightPosition()
  }

  setPlayerPosition(position: WorldPosition, options?: { animate?: boolean }): void {
    const animate = options?.animate !== false
    const dx = position.x - this.playerX
    const dy = position.y - this.playerY
    this.playerX = position.x
    this.playerY = position.y
    this.localCharacter.setWorldPosition(this.playerX, this.playerY)
    if (animate) {
      this.localCharacter.applyMovementDelta(dx, dy)
    }
    // animate:false = pose unchanged (reconcile / spawn) — do not force idle.
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
    const redrawKeys = new Set<string>()

    for (const chunk of chunks) {
      const key = chunkKey(chunk.chunk)
      this.chunkTiles.set(key, [...chunk.tiles])
      redrawKeys.add(key)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const neighborKey = chunkKey({
            x: chunk.chunk.x + dx,
            y: chunk.chunk.y + dy,
          })
          if (this.chunkTiles.has(neighborKey)) {
            redrawKeys.add(neighborKey)
          }
        }
      }
    }

    for (const key of redrawKeys) {
      this.redrawChunkGraphics(key)
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
   * Drop chunk tiles + sprites outside AOI so long travel does not accumulate.
   * Shared atlas textures are never destroyed.
   */
  pruneChunksOutside(center: ChunkCoordinate, radius = 1): void {
    const keep = new Set<string>()
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        keep.add(chunkKey({ x, y }))
      }
    }

    for (const key of [...this.chunkTiles.keys()]) {
      if (keep.has(key)) {
        continue
      }
      this.destroyChunkTerrain(key)
      this.destroyChunkDecor(key)
      this.chunkTiles.delete(key)
    }
    this.redrawBorders()
  }

  /**
   * Walkability from already received chunk data (client prediction).
   */
  isWalkableAt(position: WorldPosition): boolean {
    const tileX = Math.floor(position.x / TILE_SIZE)
    const tileY = Math.floor(position.y / TILE_SIZE)
    return this.getTileTypeAt(tileX, tileY) === TileType.Floor
  }

  /** Floor probe for lamp flood-fill (walls block light). */
  isFloorTile(tileX: number, tileY: number): boolean {
    return this.getTileTypeAt(tileX, tileY) === TileType.Floor
  }

  getRemoteCount(): number {
    return this.remoteCount
  }

  /** World positions of remote lamps (helmet focus). */
  getRemoteLightPositions(): WorldPosition[] {
    const positions: WorldPosition[] = []
    for (const remote of this.remotes.values()) {
      positions.push(remote.view.getLightPosition())
    }
    return positions
  }

  setChunkBordersVisible(visible: boolean): void {
    this.showChunkBorders = visible
    this.redrawBorders()
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
    this.tickCharacters(dt)
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
      this.effectsLayer.circle(pulse.x, pulse.y, pulse.rangePx)
      this.effectsLayer.stroke({
        width: 1.5,
        color: SCAN_RING_COLOR,
        alpha: 0.35 * (1 - t * 0.5),
      })
    }
  }

  private tickCharacters(dt: number): void {
    this.localCharacter.update(dt)
    for (const remote of this.remotes.values()) {
      remote.view.update(dt)
    }
  }

  setRemotePlayer(playerId: string, position: WorldPosition): void {
    let remote = this.remotes.get(playerId)
    if (!remote) {
      const view = new CharacterView(this.assets.getExplorerTextures(), {
        tint: REMOTE_PLAYER_TINT,
        label: playerId.slice(0, 8),
      })
      view.setWorldPosition(position.x, position.y)
      this.remotesLayer.addChild(view.root)
      remote = {
        view,
        lastX: position.x,
        lastY: position.y,
      }
      this.remotes.set(playerId, remote)
      return
    }

    const dx = position.x - remote.lastX
    const dy = position.y - remote.lastY
    remote.lastX = position.x
    remote.lastY = position.y
    remote.view.setWorldPosition(position.x, position.y)
    remote.view.applyMovementDelta(dx, dy)
    remote.view.root.visible = true
  }

  removeRemotePlayer(playerId: string): void {
    const remote = this.remotes.get(playerId)
    if (!remote) {
      return
    }
    this.remotesLayer.removeChild(remote.view.root)
    remote.view.destroy()
    this.remotes.delete(playerId)
  }

  syncRemotePlayers(activeIds: ReadonlySet<string>): void {
    for (const id of [...this.remotes.keys()]) {
      if (!activeIds.has(id)) {
        this.removeRemotePlayer(id)
      }
    }
    this.remoteCount = activeIds.size
  }

  destroy(): void {
    this.root.destroy({ children: true })
    this.chunkTerrain.clear()
    this.chunkDecor.clear()
    this.chunkTiles.clear()
    this.remotes.clear()
    this.nodeMarkers.clear()
  }

  private drawNodeBody(marker: NodeMarker, visualState: NodeVisualState): void {
    const color =
      visualState === Visual.Busy
        ? NODE_BUSY_FILL
        : visualState === Visual.Depleted
          ? NODE_DEPLETED_FILL
          : NODE_DETECTED_FILL
    // Detected veins must read above cave decor (Lot 15C hierarchy).
    marker.body.clear()
    marker.body.star(0, 0, 5, 14, 6)
    marker.body.fill({ color, alpha: 1 })
    marker.body.stroke({ width: 2, color: 0xffe1a0, alpha: 0.95 })
    marker.body.circle(0, 0, 3)
    marker.body.fill({ color: 0xffe1a0, alpha: 0.55 })
  }

  /** Missing / unloaded tiles count as Wall so AOI borders stay solid rock. */
  private getTileTypeAt(worldTileX: number, worldTileY: number): number {
    const chunkX = Math.floor(worldTileX / CHUNK_SIZE)
    const chunkY = Math.floor(worldTileY / CHUNK_SIZE)
    const tiles = this.chunkTiles.get(chunkKey({ x: chunkX, y: chunkY }))
    if (!tiles) {
      return TileType.Wall
    }
    const localX = ((worldTileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const localY = ((worldTileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return tiles[chunkTileIndex(localX, localY)] ?? TileType.Wall
  }

  private destroyChunkTerrain(key: string): void {
    const terrain = this.chunkTerrain.get(key)
    if (!terrain) {
      return
    }
    terrain.wallTop.destroy({ children: true })
    terrain.ground.destroy({ children: true })
    terrain.wallFace.destroy({ children: true })
    this.wallTopLayer.removeChild(terrain.wallTop)
    this.groundLayer.removeChild(terrain.ground)
    this.wallFaceLayer.removeChild(terrain.wallFace)
    this.chunkTerrain.delete(key)
  }

  private destroyChunkDecor(key: string): void {
    const decor = this.chunkDecor.get(key)
    if (!decor) {
      return
    }
    decor.ground.destroy({ children: true })
    decor.wall.destroy({ children: true })
    decor.foreground.destroy({ children: true })
    this.groundDecorLayer.removeChild(decor.ground)
    this.wallDecorLayer.removeChild(decor.wall)
    this.foregroundDecorLayer.removeChild(decor.foreground)
    this.chunkDecor.delete(key)
  }

  private redrawChunkGraphics(key: string): void {
    const tiles = this.chunkTiles.get(key)
    if (!tiles) {
      return
    }

    const [xText, yText] = key.split(":")
    const chunkX = Number(xText)
    const chunkY = Number(yText)
    if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) {
      return
    }

    this.destroyChunkTerrain(key)
    this.destroyChunkDecor(key)

    const wallTop = new Container()
    const ground = new Container()
    const wallFace = new Container()
    const groundDecor = new Container()
    const wallDecor = new Container()
    const foregroundDecor = new Container()
    const originX = chunkX * CHUNK_SIZE * TILE_SIZE
    const originY = chunkY * CHUNK_SIZE * TILE_SIZE
    const worldOriginX = chunkX * CHUNK_SIZE
    const worldOriginY = chunkY * CHUNK_SIZE
    const decorTextures = this.assets.getCaveDecorTextures()

    for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const worldTileX = worldOriginX + localX
        const worldTileY = worldOriginY + localY
        const selfType = tiles[chunkTileIndex(localX, localY)] ?? TileType.Wall
        const tileOriginX = originX + localX * TILE_SIZE
        const tileOriginY = originY + localY * TILE_SIZE

        const terrain = resolveTerrainPlacements(
          worldTileX,
          worldTileY,
          selfType,
          (x, y) => this.getTileTypeAt(x, y),
        )
        for (const placement of terrain) {
          const parent = terrainLayerContainer(
            placement.layer,
            wallTop,
            ground,
            wallFace,
          )
          const x = tileOriginX + placement.offsetX
          const y = tileOriginY + placement.offsetY
          if (this.terrainDebugColors) {
            addTerrainDebugRect(parent, placement.layer, x, y)
          } else {
            addTerrainSprite(
              parent,
              this.assets.get(placement.textureId),
              x,
              y,
            )
          }
        }

        if (this.decorEnabled) {
          const neighborFloors = {
            n: this.getTileTypeAt(worldTileX, worldTileY - 1) === TileType.Floor,
            e: this.getTileTypeAt(worldTileX + 1, worldTileY) === TileType.Floor,
            s: this.getTileTypeAt(worldTileX, worldTileY + 1) === TileType.Floor,
            w: this.getTileTypeAt(worldTileX - 1, worldTileY) === TileType.Floor,
          }
          const placements = resolveDecor(
            this.visualDecorSeed,
            worldTileX,
            worldTileY,
            selfType,
            neighborFloors,
          )
          for (const placement of placements) {
            addDecorSprite(
              layerContainer(
                placement.layer,
                groundDecor,
                wallDecor,
                foregroundDecor,
              ),
              decorTextures.get(placement.frame),
              tileOriginX + TILE_SIZE / 2,
              tileOriginY + TILE_SIZE / 2,
              placement,
            )
          }
        }
      }
    }

    this.chunkTerrain.set(key, { wallTop, ground, wallFace })
    this.wallTopLayer.addChild(wallTop)
    this.groundLayer.addChild(ground)
    this.wallFaceLayer.addChild(wallFace)

    this.chunkDecor.set(key, {
      ground: groundDecor,
      wall: wallDecor,
      foreground: foregroundDecor,
    })
    this.groundDecorLayer.addChild(groundDecor)
    this.wallDecorLayer.addChild(wallDecor)
    this.foregroundDecorLayer.addChild(foregroundDecor)
  }

  private redrawBorders(): void {
    this.borderLayer.clear()
    if (!this.showChunkBorders) {
      return
    }

    for (const key of this.chunkTerrain.keys()) {
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
}

function terrainLayerContainer(
  layer: TerrainLayer,
  wallTop: Container,
  ground: Container,
  wallFace: Container,
): Container {
  if (layer === "wallTop") return wallTop
  if (layer === "ground") return ground
  return wallFace
}

function layerContainer(
  layer: DecorLayer,
  ground: Container,
  wall: Container,
  foreground: Container,
): Container {
  if (layer === "groundDecor") return ground
  if (layer === "wallDecor") return wall
  return foreground
}

function addTerrainSprite(
  parent: Container,
  texture: Texture,
  x: number,
  y: number,
): void {
  const sprite = new Sprite(texture)
  sprite.scale.set(ASSET_DISPLAY_SCALE)
  sprite.anchor.set(0)
  sprite.roundPixels = true
  sprite.position.set(x, y)
  parent.addChild(sprite)
}

function addTerrainDebugRect(
  parent: Container,
  layer: TerrainLayer,
  x: number,
  y: number,
): void {
  const color =
    layer === "ground"
      ? TERRAIN_DEBUG_COLORS.ground
      : layer === "wallTop"
        ? TERRAIN_DEBUG_COLORS.wallTop
        : TERRAIN_DEBUG_COLORS.wallFace
  const g = new Graphics()
  // Faces: shorter band so overhang reads as a cliff lip over the floor.
  const h = layer === "wallFace" ? Math.floor(TILE_SIZE * 0.55) : TILE_SIZE
  const y0 = layer === "wallFace" ? y + (TILE_SIZE - h) : y
  g.rect(x, y0, TILE_SIZE, h)
  g.fill({ color, alpha: layer === "wallFace" ? 0.92 : 1 })
  parent.addChild(g)
}

function addDecorSprite(
  parent: Container,
  texture: Texture,
  centerX: number,
  centerY: number,
  placement: DecorPlacement,
): void {
  const sprite = createScaledSprite(texture)
  sprite.anchor.set(0.5)
  sprite.position.set(centerX + placement.offsetX, centerY + placement.offsetY)
  sprite.alpha = placement.alpha
  if (placement.flipX) {
    sprite.scale.x = -ASSET_DISPLAY_SCALE
  }
  parent.addChild(sprite)
}

function createScaledSprite(texture: Texture): Sprite {
  const sprite = new Sprite(texture)
  sprite.scale.set(ASSET_DISPLAY_SCALE)
  sprite.anchor.set(0.5)
  sprite.roundPixels = true
  return sprite
}

function chunkKey(coordinate: ChunkCoordinate): string {
  return `${coordinate.x}:${coordinate.y}`
}
