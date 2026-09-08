import { PLAYER_SPEED_PX_PER_SEC } from "./constants.js"
import type { WorldPosition } from "./ids.js"

export interface MovementButtons {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export type WalkabilityFn = (position: WorldPosition) => boolean

/**
 * Pure movement step: normalized velocity + axis-separated WALL collision.
 * Shared by server authority and client prediction.
 */
export function stepMovement(
  position: WorldPosition,
  input: MovementButtons,
  dtSeconds: number,
  isWalkable: WalkabilityFn,
  speed = PLAYER_SPEED_PX_PER_SEC,
): { position: WorldPosition; velocity: WorldPosition } {
  let dx = 0
  let dy = 0
  if (input.up) dy -= 1
  if (input.down) dy += 1
  if (input.left) dx -= 1
  if (input.right) dx += 1

  if ((dx === 0 && dy === 0) || dtSeconds <= 0) {
    return {
      position: { x: position.x, y: position.y },
      velocity: { x: 0, y: 0 },
    }
  }

  const length = Math.hypot(dx, dy) || 1
  const vx = (dx / length) * speed
  const vy = (dy / length) * speed
  const next = {
    x: position.x + vx * dtSeconds,
    y: position.y + vy * dtSeconds,
  }

  const resolved = {
    x: isWalkable({ x: next.x, y: position.y }) ? next.x : position.x,
    y: isWalkable({ x: position.x, y: next.y }) ? next.y : position.y,
  }

  return {
    position: resolved,
    velocity: { x: vx, y: vy },
  }
}
