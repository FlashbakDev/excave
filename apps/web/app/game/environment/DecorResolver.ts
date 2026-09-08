import { TileType } from "@excave/shared"
import type { CaveDecorFrameKey } from "./caveDecor.config"

/** Client visual seed when the server does not expose a world seed. */
export const DEFAULT_VISUAL_DECOR_SEED = 0xecca_7e15

export type DecorLayer = "groundDecor" | "wallDecor" | "foregroundDecor"

export interface DecorNeighborFloors {
  n: boolean
  e: boolean
  s: boolean
  w: boolean
}

export interface DecorPlacement {
  frame: CaveDecorFrameKey
  layer: DecorLayer
  /** Pixel offset from tile center (world px, unzoomed). */
  offsetX: number
  offsetY: number
  flipX: boolean
  /** Quiet under light / player — decor stays below hierarchy. */
  alpha: number
}

/** Weighted ground clutter — dust/cracks dominate; mineral rare. */
const GROUND_WEIGHTED: readonly { frame: CaveDecorFrameKey; w: number }[] = [
  { frame: "decor_dust", w: 18 },
  { frame: "decor_dust_scatter", w: 14 },
  { frame: "decor_crack_floor", w: 12 },
  { frame: "decor_crack_floor_y", w: 10 },
  { frame: "decor_pebbles", w: 11 },
  { frame: "decor_pebbles_loose", w: 10 },
  { frame: "decor_stone_sm", w: 8 },
  { frame: "decor_mineral_trace", w: 3 },
  { frame: "decor_mushroom", w: 4 },
]

const GROUND_ROOTS: readonly CaveDecorFrameKey[] = [
  "decor_root",
  "decor_root_fork",
]

const WALL_WEIGHTED: readonly { frame: CaveDecorFrameKey; w: number }[] = [
  { frame: "decor_wall_crack", w: 14 },
  { frame: "decor_wall_crack_diag", w: 12 },
  { frame: "decor_wall_chip", w: 10 },
  { frame: "decor_root", w: 6 },
]

/** Rare depth cue only — never a bright “loot” silhouette. */
const FOREGROUND_FRAMES: readonly CaveDecorFrameKey[] = ["decor_stone_md"]

const GROUND_WEIGHT_SUM = GROUND_WEIGHTED.reduce((s, e) => s + e.w, 0)
const WALL_WEIGHT_SUM = WALL_WEIGHTED.reduce((s, e) => s + e.w, 0)

/** Coarse pocket size (tiles) — breaks chunk-aligned repetition. */
const CLUSTER_CELL = 3

/**
 * Mix world seed + tile coords (+ salt) into a stable 32-bit value.
 * Scrambles axes so CHUNK_SIZE grids do not imprint visible stripes.
 */
export function hashDecorCell(
  visualSeed: number,
  worldTileX: number,
  worldTileY: number,
  salt = 0,
): number {
  const x = worldTileX | 0
  const y = worldTileY | 0
  let h = visualSeed >>> 0
  h = Math.imul(h ^ x, 374761393)
  h = Math.imul(h ^ y, 668265263)
  h = Math.imul(h ^ (x * 0x45d9f3b) ^ (y * 0x27d4eb2d), 0x85ebca6b)
  h = Math.imul(h ^ (salt | 0), 0x9e3779b9)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

function pickWeighted(
  list: readonly { frame: CaveDecorFrameKey; w: number }[],
  sum: number,
  h: number,
): CaveDecorFrameKey {
  let cursor = h % sum
  for (const entry of list) {
    if (cursor < entry.w) return entry.frame
    cursor -= entry.w
  }
  return list[list.length - 1]!.frame
}

function pick<T>(list: readonly T[], h: number): T {
  return list[h % list.length]!
}

function offsets(h: number): { offsetX: number; offsetY: number; flipX: boolean } {
  return {
    offsetX: ((h >>> 3) % 13) - 6,
    offsetY: ((h >>> 7) % 13) - 6,
    flipX: ((h >>> 11) & 1) === 1,
  }
}

function wallAdjacent(floors: DecorNeighborFloors): boolean {
  return !floors.n || !floors.e || !floors.s || !floors.w
}

function wallCorner(floors: DecorNeighborFloors): boolean {
  const walls =
    Number(!floors.n) + Number(!floors.e) + Number(!floors.s) + Number(!floors.w)
  return walls >= 2
}

function wallExposed(floors: DecorNeighborFloors): boolean {
  return floors.n || floors.e || floors.s || floors.w
}

/**
 * Soft cluster field: most of the map is quiet; small pockets denser.
 * Uses coarse cells (not chunk size) so patterns do not follow AOI tiles.
 */
export function clusterFactor(
  visualSeed: number,
  worldTileX: number,
  worldTileY: number,
): number {
  const cx = Math.floor(worldTileX / CLUSTER_CELL)
  const cy = Math.floor(worldTileY / CLUSTER_CELL)
  const pocket = hashDecorCell(visualSeed, cx, cy, 0xc1a)
  // ~28% of coarse cells are active pockets.
  if (pocket % 1000 >= 280) {
    return 0.45
  }
  const local = hashDecorCell(visualSeed, worldTileX, worldTileY, 0xc1b)
  // Inside pocket: 0.9 … 1.35
  return 0.9 + (local % 46) / 100
}

function alphaFor(frame: CaveDecorFrameKey, h: number): number {
  if (frame === "decor_mushroom" || frame === "decor_mushroom_pair") {
    return 0.55 + (h % 12) / 100
  }
  if (frame === "decor_mineral_trace") {
    return 0.4 + (h % 15) / 100
  }
  if (frame.startsWith("decor_dust") || frame.startsWith("decor_crack")) {
    return 0.5 + (h % 20) / 100
  }
  if (frame === "decor_stone_md") {
    return 0.7 + (h % 15) / 100
  }
  return 0.62 + (h % 22) / 100
}

/**
 * Deterministic cave decor for one world tile (Lots 15B/15C).
 * Sparse, clustered, quiet — never competes with player / detected nodes.
 */
export function resolveDecor(
  visualSeed: number,
  worldTileX: number,
  worldTileY: number,
  selfType: number,
  neighborFloors: DecorNeighborFloors,
): DecorPlacement[] {
  if (selfType === TileType.Floor) {
    return resolveFloorDecor(
      visualSeed,
      worldTileX,
      worldTileY,
      neighborFloors,
    )
  }
  if (selfType === TileType.Wall) {
    return resolveWallDecor(
      visualSeed,
      worldTileX,
      worldTileY,
      neighborFloors,
    )
  }
  return []
}

function resolveFloorDecor(
  visualSeed: number,
  worldTileX: number,
  worldTileY: number,
  floors: DecorNeighborFloors,
): DecorPlacement[] {
  const nearWall = wallAdjacent(floors)
  const corner = wallCorner(floors)
  const cluster = clusterFactor(visualSeed, worldTileX, worldTileY)

  // Open floor stays mostly empty; edges/corners denser; pockets add clumps.
  let threshold = 72
  if (nearWall) threshold = 130
  if (corner) threshold = 175
  threshold = Math.round(threshold * cluster)

  const h0 = hashDecorCell(visualSeed, worldTileX, worldTileY, 1)
  if (h0 % 1000 >= threshold) {
    return []
  }

  const placements: DecorPlacement[] = []
  const h1 = hashDecorCell(visualSeed, worldTileX, worldTileY, 2)
  const roll = h1 % 100
  const pose = offsets(h1)

  if (nearWall && roll < (corner ? 48 : 34)) {
    const frame = pick(GROUND_ROOTS, h1 >>> 4)
    placements.push({
      frame,
      layer: "groundDecor",
      ...pose,
      alpha: alphaFor(frame, h1),
    })
  } else if (roll < 88) {
    const frame = pickWeighted(GROUND_WEIGHTED, GROUND_WEIGHT_SUM, h1 >>> 4)
    placements.push({
      frame,
      layer: "groundDecor",
      ...pose,
      alpha: alphaFor(frame, h1),
    })
  } else {
    // Extremely rare foreground rock for depth (below entities in z-order).
    const h2 = hashDecorCell(visualSeed, worldTileX, worldTileY, 3)
    if (h2 % 1000 < 90 && cluster > 0.85) {
      const frame = pick(FOREGROUND_FRAMES, h2)
      placements.push({
        frame,
        layer: "foregroundDecor",
        ...offsets(h2),
        alpha: alphaFor(frame, h2),
      })
    } else {
      const frame = pickWeighted(GROUND_WEIGHTED, GROUND_WEIGHT_SUM, h1 >>> 5)
      placements.push({
        frame,
        layer: "groundDecor",
        ...pose,
        alpha: alphaFor(frame, h1),
      })
    }
  }

  // Tiny natural cluster: occasional second dust fleck in active pockets near walls.
  if (nearWall && cluster > 1.05 && placements.length === 1) {
    const h3 = hashDecorCell(visualSeed, worldTileX, worldTileY, 6)
    if (h3 % 1000 < 160) {
      placements.push({
        frame: "decor_dust",
        layer: "groundDecor",
        offsetX: pose.offsetX + (((h3 >>> 2) % 5) - 2),
        offsetY: pose.offsetY + (((h3 >>> 5) % 5) - 2),
        flipX: false,
        alpha: 0.45 + (h3 % 10) / 100,
      })
    }
  }

  return placements
}

function resolveWallDecor(
  visualSeed: number,
  worldTileX: number,
  worldTileY: number,
  floors: DecorNeighborFloors,
): DecorPlacement[] {
  if (!wallExposed(floors)) {
    return []
  }

  const cluster = clusterFactor(visualSeed, worldTileX, worldTileY)
  const h0 = hashDecorCell(visualSeed, worldTileX, worldTileY, 4)
  // Exposed lips only — quieter than floor edge clutter (~7–11%).
  const threshold = Math.round(85 * cluster)
  if (h0 % 1000 >= threshold) {
    return []
  }

  const h1 = hashDecorCell(visualSeed, worldTileX, worldTileY, 5)
  const frame = pickWeighted(WALL_WEIGHTED, WALL_WEIGHT_SUM, h1 >>> 5)
  const pose = offsets(h1)
  return [
    {
      frame,
      layer: "wallDecor",
      ...pose,
      alpha: alphaFor(frame, h1) * 0.92,
    },
  ]
}
