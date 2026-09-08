/**
 * Lot 14 — explorer character animation / display config.
 * Source art is 16×16 (Lot 11); display scale stays ×2 → 32 world px.
 */

export type FacingDirection = "up" | "down" | "left" | "right"

export type CharacterMotion = "idle" | "walk"

export interface CharacterAnimationState {
  direction: FacingDirection
  motion: CharacterMotion
}

/** Spritesheet layout must match `scripts/generate-explorer-sprite.mjs`. */
export const EXPLORER_FRAME_SIZE = 16
export const EXPLORER_SHEET_COLS = 4
export const EXPLORER_SHEET_ROWS = 3

/**
 * Right-facing is a horizontal mirror of left (lamp at front, pack at back).
 * Documented in PIXEL_ART.md — avoids duplicated asymmetric frames.
 */
export const EXPLORER_MIRROR_RIGHT = true

export const CHARACTER_CONFIG = {
  sourceSize: EXPLORER_FRAME_SIZE,
  scale: 2,
  /** Walk cycle visual frames per second. */
  walkFps: 8,
  /** Idle stays static (1 frame); value kept for future breathing. */
  idleFps: 1,
  /**
   * World-px delta below which remotes/local stay idle.
   * Tuned for ~140 px/s movement + remote interpolation noise.
   */
  movementEpsilon: 0.45,
  /**
   * Prefer previous facing axis when |dx|≈|dy| (stops diagonal flicker).
   * Ratio > 1 means the dominant axis must clearly win to switch.
   */
  diagonalBias: 1.2,
  /**
   * Sprite anchor: feet at logical position (collision point).
   * Character draws upward from gameplay (x, y).
   */
  anchorX: 0.5,
  anchorY: 1,
  /**
   * Lamp overlay focus offset from feet toward helmet (world px, unzoomed).
   * Negative Y = up in world space.
   */
  lightOffsetY: -14,
  /** Name label offset above helmet (world px). */
  labelOffsetY: -34,
  /** Walk texture order: 0 → 1 → 2 → 1 (loop). */
  walkFramePattern: [0, 1, 2, 1] as const,
} as const

export type ExplorerFrameKey =
  | "explorer_idle_down_0"
  | "explorer_idle_up_0"
  | "explorer_idle_left_0"
  | "explorer_walk_down_0"
  | "explorer_walk_down_1"
  | "explorer_walk_down_2"
  | "explorer_walk_up_0"
  | "explorer_walk_up_1"
  | "explorer_walk_up_2"
  | "explorer_walk_left_0"
  | "explorer_walk_left_1"
  | "explorer_walk_left_2"

export const EXPLORER_FRAME_RECTS: Record<
  ExplorerFrameKey,
  { x: number; y: number; w: number; h: number }
> = {
  explorer_idle_down_0: { x: 0, y: 0, w: 16, h: 16 },
  explorer_walk_down_0: { x: 16, y: 0, w: 16, h: 16 },
  explorer_walk_down_1: { x: 32, y: 0, w: 16, h: 16 },
  explorer_walk_down_2: { x: 48, y: 0, w: 16, h: 16 },
  explorer_idle_up_0: { x: 0, y: 16, w: 16, h: 16 },
  explorer_walk_up_0: { x: 16, y: 16, w: 16, h: 16 },
  explorer_walk_up_1: { x: 32, y: 16, w: 16, h: 16 },
  explorer_walk_up_2: { x: 48, y: 16, w: 16, h: 16 },
  explorer_idle_left_0: { x: 0, y: 32, w: 16, h: 16 },
  explorer_walk_left_0: { x: 16, y: 32, w: 16, h: 16 },
  explorer_walk_left_1: { x: 32, y: 32, w: 16, h: 16 },
  explorer_walk_left_2: { x: 48, y: 32, w: 16, h: 16 },
}
