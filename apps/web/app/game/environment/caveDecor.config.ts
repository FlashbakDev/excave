/**
 * Lot 15A — cave decor atlas frame rects (source 16×16, sheet 64×64).
 * Placement / density: Lot 15B (`DecorResolver`).
 */

export const CAVE_DECOR_FRAME_SIZE = 16
export const CAVE_DECOR_SHEET_SIZE = { w: 64, h: 64 } as const

/** Frame keys — keep in sync with `generate-cave-decor.mjs` / cave_decor.json. */
export const CAVE_DECOR_FRAME_KEYS = [
  "decor_stone_sm",
  "decor_stone_md",
  "decor_pebbles",
  "decor_pebbles_loose",
  "decor_crack_floor",
  "decor_crack_floor_y",
  "decor_dust",
  "decor_dust_scatter",
  "decor_root",
  "decor_root_fork",
  "decor_mushroom",
  "decor_mushroom_pair",
  "decor_wall_crack",
  "decor_wall_crack_diag",
  "decor_wall_chip",
  "decor_mineral_trace",
] as const

export type CaveDecorFrameKey = (typeof CAVE_DECOR_FRAME_KEYS)[number]

export type CaveDecorFrameRect = { x: number; y: number; w: number; h: number }

/** Ground-layer props (sparse floor clutter). */
export const CAVE_DECOR_GROUND_KEYS = [
  "decor_stone_sm",
  "decor_stone_md",
  "decor_pebbles",
  "decor_pebbles_loose",
  "decor_crack_floor",
  "decor_crack_floor_y",
  "decor_dust",
  "decor_dust_scatter",
  "decor_root",
  "decor_root_fork",
  "decor_mushroom",
  "decor_mushroom_pair",
  "decor_mineral_trace",
] as const satisfies readonly CaveDecorFrameKey[]

/** Wall-face props (cracks / chips on rock). */
export const CAVE_DECOR_WALL_KEYS = [
  "decor_wall_crack",
  "decor_wall_crack_diag",
  "decor_wall_chip",
] as const satisfies readonly CaveDecorFrameKey[]

const COLS = 4

function rectForIndex(index: number): CaveDecorFrameRect {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return {
    x: col * CAVE_DECOR_FRAME_SIZE,
    y: row * CAVE_DECOR_FRAME_SIZE,
    w: CAVE_DECOR_FRAME_SIZE,
    h: CAVE_DECOR_FRAME_SIZE,
  }
}

export const CAVE_DECOR_FRAME_RECTS: Record<CaveDecorFrameKey, CaveDecorFrameRect> =
  Object.fromEntries(
    CAVE_DECOR_FRAME_KEYS.map((key, index) => [key, rectForIndex(index)]),
  ) as Record<CaveDecorFrameKey, CaveDecorFrameRect>
