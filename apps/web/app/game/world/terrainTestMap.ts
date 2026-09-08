import {
  CHUNK_SIZE,
  DEFAULT_WORLD_ID,
  TILE_SIZE,
  TileType,
  chunkTileIndex,
  type ChunkPayload,
  type WorldPosition,
} from "@excave/shared"

/**
 * Fixed 16×16 cave sample for FLOOR/WALL relief validation (dev only).
 *
 * Legend: `#` wall · `.` floor
 * Contains: room, H/V corridors, angle, internal + external corners, wall mass.
 */
export const TERRAIN_TEST_GRID: readonly string[] = [
  "################", // 0  solid mass
  "################", // 1
  "###......#######", // 2  room
  "###......#######", // 3
  "###......##...##", // 4  room + horizontal corridor
  "###......##...##", // 5
  "###......#######", // 6
  "########..######", // 7  vertical corridor
  "##..........####", // 8  open junction / angles
  "##..........####", // 9
  "##..####....####", // A  pillar (external corners)
  "##..####....####", // B
  "##..............", // C  south gallery
  "################", // D
  "################", // E  wall mass
  "################", // F
]

export const TERRAIN_TEST_SPAWN: WorldPosition = {
  x: 5.5 * TILE_SIZE,
  y: 4.5 * TILE_SIZE,
}

/** Debug flat colors — resolver layer validation (not final art). */
export const TERRAIN_DEBUG_COLORS = {
  ground: 0xd4c4a8,
  wallTop: 0xcc3333,
  wallFace: 0x3366cc,
  void: 0x000000,
} as const

export function buildTerrainTestChunks(): ChunkPayload[] {
  if (TERRAIN_TEST_GRID.length !== CHUNK_SIZE) {
    throw new Error(
      `TERRAIN_TEST_GRID rows ${TERRAIN_TEST_GRID.length} !== CHUNK_SIZE ${CHUNK_SIZE}`,
    )
  }

  const tiles: TileType[] = new Array(CHUNK_SIZE * CHUNK_SIZE)
  for (let y = 0; y < CHUNK_SIZE; y += 1) {
    const row = TERRAIN_TEST_GRID[y]!
    if (row.length !== CHUNK_SIZE) {
      throw new Error(
        `TERRAIN_TEST_GRID row ${y} length ${row.length} !== ${CHUNK_SIZE}`,
      )
    }
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const ch = row[x]!
      tiles[chunkTileIndex(x, y)] =
        ch === "." ? TileType.Floor : TileType.Wall
    }
  }

  return [
    {
      worldId: DEFAULT_WORLD_ID,
      chunk: { x: 0, y: 0 },
      tiles,
    },
  ]
}
