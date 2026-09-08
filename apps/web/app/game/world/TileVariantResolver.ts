import { TileType } from "@excave/shared"

/** Cardinal + diagonal open (floor) neighbors for wall autotiling. */
export const OpenNeighbor = {
  N: 1,
  E: 2,
  S: 4,
  W: 8,
  NE: 16,
  NW: 32,
  SE: 64,
  SW: 128,
} as const

export type GroundVariantId = "ground_01" | "ground_02" | "ground_03"

export type WallTopId = "wall_top_01" | "wall_top_02" | "wall_top_03"

export type WallFaceId =
  | "wall_face_s"
  | "wall_face_e"
  | "wall_face_w"
  | "wall_corner_ne"
  | "wall_corner_nw"
  | "wall_corner_se"
  | "wall_corner_sw"
  | "wall_inner_se"
  | "wall_inner_sw"

/** All terrain textures loaded by GameAssets. */
export type TerrainTextureId = GroundVariantId | WallTopId | WallFaceId

export type TerrainLayer = "ground" | "wallTop" | "wallFace"

export interface TerrainPlacement {
  textureId: TerrainTextureId
  layer: TerrainLayer
  offsetX: number
  offsetY: number
}

/** No overhang — faces sit on the wall cell so corners meet without gaps. */
export const WALL_FACE_SOUTH_OVERHANG_Y = 0
export const WALL_FACE_SIDE_OVERHANG_X = 0

const GROUND_VARIANTS: readonly GroundVariantId[] = [
  "ground_01",
  "ground_02",
  "ground_03",
]

const WALL_TOP_VARIANTS: readonly WallTopId[] = [
  "wall_top_01",
  "wall_top_02",
  "wall_top_03",
]

/**
 * Deterministic 32-bit mix of world tile coordinates.
 * Same (x, y) always yields the same visual — nothing stored in DB.
 */
export function hashWorldTile(worldX: number, worldY: number): number {
  let h = Math.imul(worldX | 0, 374761393) + Math.imul(worldY | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

export function resolveGroundVariant(
  worldTileX: number,
  worldTileY: number,
): GroundVariantId {
  const index = hashWorldTile(worldTileX, worldTileY) % GROUND_VARIANTS.length
  return GROUND_VARIANTS[index]!
}

export function resolveWallTopVariant(
  worldTileX: number,
  worldTileY: number,
): WallTopId {
  const index =
    hashWorldTile(worldTileX * 3 + 1, worldTileY * 5 + 7) %
    WALL_TOP_VARIANTS.length
  return WALL_TOP_VARIANTS[index]!
}

export function buildOpenNeighborMask(isFloor: {
  n: boolean
  e: boolean
  s: boolean
  w: boolean
  ne?: boolean
  nw?: boolean
  se?: boolean
  sw?: boolean
}): number {
  let mask = 0
  if (isFloor.n) mask |= OpenNeighbor.N
  if (isFloor.e) mask |= OpenNeighbor.E
  if (isFloor.s) mask |= OpenNeighbor.S
  if (isFloor.w) mask |= OpenNeighbor.W
  if (isFloor.ne) mask |= OpenNeighbor.NE
  if (isFloor.nw) mask |= OpenNeighbor.NW
  if (isFloor.se) mask |= OpenNeighbor.SE
  if (isFloor.sw) mask |= OpenNeighbor.SW
  return mask
}

/** Wall touches floor on a cardinal → rim; diagonals alone stay void. */
export function isWallVisuallyExposed(openMask: number): boolean {
  return (openMask & 0x0f) !== 0
}

function faceOffset(face: WallFaceId): { offsetX: number; offsetY: number } {
  switch (face) {
    case "wall_face_s":
    case "wall_corner_se":
    case "wall_corner_sw":
    case "wall_inner_se":
    case "wall_inner_sw":
      return { offsetX: 0, offsetY: WALL_FACE_SOUTH_OVERHANG_Y }
    case "wall_face_e":
    case "wall_corner_ne":
      return { offsetX: WALL_FACE_SIDE_OVERHANG_X, offsetY: 0 }
    case "wall_face_w":
    case "wall_corner_nw":
      return { offsetX: -WALL_FACE_SIDE_OVERHANG_X, offsetY: 0 }
    default:
      return { offsetX: 0, offsetY: 0 }
  }
}

/**
 * Face overlays — orientation is always relative to FLOOR neighbors:
 *   S open → cliff on the south edge of the wall (toward floor below)
 *   E/W only → wall top only (vertical corridor walls have no side lips)
 *   N open → no face (top-down; wall_top only)
 *
 * South floor always gets a full-width cliff. Inner/outer corner variants
 * used to truncate that band to meet E/W lips — those lips are gone.
 */
export function resolveWallFaceOverlays(openMask: number): WallFaceId[] {
  if ((openMask & OpenNeighbor.S) === 0) {
    return []
  }
  return ["wall_face_s"]
}

/** @deprecated Prefer resolveWallFaceOverlays — returns the primary face only. */
export function resolveWallFaceOverlay(openMask: number): WallFaceId | null {
  return resolveWallFaceOverlays(openMask)[0] ?? null
}

/**
 * Client-only terrain visuals for one world cell (FLOOR/WALL → layers).
 * Deep rock (no floor neighbor) draws nothing → void background shows through.
 */
export function resolveTerrainPlacements(
  worldTileX: number,
  worldTileY: number,
  selfType: number,
  neighborType: (x: number, y: number) => number,
): TerrainPlacement[] {
  if (selfType === TileType.Floor) {
    return [
      {
        textureId: resolveGroundVariant(worldTileX, worldTileY),
        layer: "ground",
        offsetX: 0,
        offsetY: 0,
      },
    ]
  }

  if (selfType !== TileType.Wall) {
    return []
  }

  const isFloor = (x: number, y: number) =>
    neighborType(x, y) === TileType.Floor

  const mask = buildOpenNeighborMask({
    n: isFloor(worldTileX, worldTileY - 1),
    e: isFloor(worldTileX + 1, worldTileY),
    s: isFloor(worldTileX, worldTileY + 1),
    w: isFloor(worldTileX - 1, worldTileY),
    ne: isFloor(worldTileX + 1, worldTileY - 1),
    nw: isFloor(worldTileX - 1, worldTileY - 1),
    se: isFloor(worldTileX + 1, worldTileY + 1),
    sw: isFloor(worldTileX - 1, worldTileY + 1),
  })

  // Surrounded rock = void (black clear), not textured wall tops.
  if (!isWallVisuallyExposed(mask)) {
    return []
  }

  const placements: TerrainPlacement[] = [
    {
      textureId: resolveWallTopVariant(worldTileX, worldTileY),
      layer: "wallTop",
      offsetX: 0,
      offsetY: 0,
    },
  ]

  for (const face of resolveWallFaceOverlays(mask)) {
    const { offsetX, offsetY } = faceOffset(face)
    placements.push({
      textureId: face,
      layer: "wallFace",
      offsetX,
      offsetY,
    })
  }

  return placements
}

/** @deprecated Prefer resolveTerrainPlacements — kept for narrow call sites. */
export type TileVisualId = TerrainTextureId

/** @deprecated Lot 12 single-sprite id — use resolveTerrainPlacements. */
export type WallTileId = WallTopId | WallFaceId | "wall_center"

/**
 * @deprecated Lot 12 single-tile wall pick.
 * Mapped onto the new face overlay vocabulary for tests / tooling.
 */
export function resolveWallTile(openMask: number): WallTileId {
  const face = resolveWallFaceOverlay(openMask)
  if (face) return face
  return "wall_top_01"
}

/**
 * @deprecated Prefer resolveTerrainPlacements.
 */
export function resolveTileVisual(
  worldTileX: number,
  worldTileY: number,
  selfType: number,
  neighborType: (x: number, y: number) => number,
): TileVisualId {
  const placements = resolveTerrainPlacements(
    worldTileX,
    worldTileY,
    selfType,
    neighborType,
  )
  const face = placements.find((p) => p.layer === "wallFace")
  if (face) return face.textureId
  return placements[0]?.textureId ?? "wall_top_01"
}
