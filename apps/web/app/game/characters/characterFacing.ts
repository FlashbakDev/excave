import {
  CHARACTER_CONFIG,
  type CharacterMotion,
  type FacingDirection,
} from "./character.config"

export interface FacingFromDeltaResult {
  motion: CharacterMotion
  facing: FacingDirection
}

/**
 * Derive facing + motion from a world-space movement delta.
 * Y+ is down (matches `stepMovement` / Pixi world).
 * Keeps last facing when idle or on ambiguous diagonals.
 */
export function facingFromDelta(
  dx: number,
  dy: number,
  previous: FacingDirection,
  epsilon: number = CHARACTER_CONFIG.movementEpsilon,
  bias: number = CHARACTER_CONFIG.diagonalBias,
): FacingFromDeltaResult {
  const distance = Math.hypot(dx, dy)
  if (distance < epsilon) {
    return { motion: "idle", facing: previous }
  }

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  const horizontal: FacingDirection = dx > 0 ? "right" : "left"
  const vertical: FacingDirection = dy > 0 ? "down" : "up"

  if (absDx > absDy * bias) {
    return { motion: "walk", facing: horizontal }
  }
  if (absDy > absDx * bias) {
    return { motion: "walk", facing: vertical }
  }

  // Ambiguous diagonal — keep previous if it matches either candidate axis.
  if (previous === horizontal || previous === vertical) {
    return { motion: "walk", facing: previous }
  }

  if (absDx > absDy) {
    return { motion: "walk", facing: horizontal }
  }
  return { motion: "walk", facing: vertical }
}

/** Resolve mirrored sheet direction (right → left textures + flip). */
export function sheetDirection(
  facing: FacingDirection,
): "up" | "down" | "left" {
  if (facing === "right") return "left"
  return facing
}

export function shouldMirrorFacing(facing: FacingDirection): boolean {
  return facing === "right"
}
