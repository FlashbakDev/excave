import {
  PLAYER_COLLISION_BODY_HEIGHT_PX,
  PLAYER_COLLISION_FOOT_PAD_PX,
  PLAYER_COLLISION_HALF_WIDTH_PX,
  PLAYER_SPEED_PX_PER_SEC,
  MOVEMENT_COMMAND_HZ,
} from "./constants.js"
import type { WorldPosition } from "./ids.js"

export interface MovementButtons {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export type WalkabilityFn = (position: WorldPosition) => boolean

/**
 * Player footprint in world px (feet = logical position, sprite grows upward).
 * Keeps the visible body from sinking into wall tiles.
 */
export function canOccupy(
  position: WorldPosition,
  isTileWalkable: WalkabilityFn,
  halfWidth = PLAYER_COLLISION_HALF_WIDTH_PX,
  bodyHeight = PLAYER_COLLISION_BODY_HEIGHT_PX,
  footPad = PLAYER_COLLISION_FOOT_PAD_PX,
): boolean {
  const hx = halfWidth
  const samples: WorldPosition[] = [
    position,
    { x: position.x - hx, y: position.y },
    { x: position.x + hx, y: position.y },
    { x: position.x - hx, y: position.y - bodyHeight },
    { x: position.x + hx, y: position.y - bodyHeight },
    { x: position.x, y: position.y - bodyHeight },
    { x: position.x - hx, y: position.y + footPad },
    { x: position.x + hx, y: position.y + footPad },
  ]
  for (const sample of samples) {
    if (!isTileWalkable(sample)) {
      return false
    }
  }
  return true
}

/**
 * Pure movement step: normalized velocity + axis-separated WALL collision.
 * Shared by server authority and client prediction.
 * `isWalkable` is a *tile* check for a point; footprint sampling is applied here.
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
  const actualVelocity = (resolved: WorldPosition): WorldPosition => ({
    x: (resolved.x - position.x) / dtSeconds,
    y: (resolved.y - position.y) / dtSeconds,
  })

  const fits = (candidate: WorldPosition) => canOccupy(candidate, isWalkable)

  // If already overlapping a wall (legacy pose / reconcile), allow escape moves.
  if (!fits(position)) {
    if (fits(next)) {
      return { position: next, velocity: actualVelocity(next) }
    }
    if (fits({ x: next.x, y: position.y })) {
      const resolved = { x: next.x, y: position.y }
      return {
        position: resolved,
        velocity: actualVelocity(resolved),
      }
    }
    if (fits({ x: position.x, y: next.y })) {
      const resolved = { x: position.x, y: next.y }
      return {
        position: resolved,
        velocity: actualVelocity(resolved),
      }
    }
  }

  const resolved = {
    x: fits({ x: next.x, y: position.y }) ? next.x : position.x,
    y: fits({ x: position.x, y: next.y }) ? next.y : position.y,
  }

  // Diagonal into a corner: axis slides can both pass alone but the combined
  // cell is blocked — refuse the second axis if the final pose does not fit.
  if (
    (resolved.x !== position.x || resolved.y !== position.y) &&
    !fits(resolved)
  ) {
    if (fits({ x: resolved.x, y: position.y })) {
      const slide = { x: resolved.x, y: position.y }
      return {
        position: slide,
        velocity: actualVelocity(slide),
      }
    }
    if (fits({ x: position.x, y: resolved.y })) {
      const slide = { x: position.x, y: resolved.y }
      return {
        position: slide,
        velocity: actualVelocity(slide),
      }
    }
    return {
      position: { x: position.x, y: position.y },
      velocity: { x: 0, y: 0 },
    }
  }

  return {
    position: resolved,
    velocity: actualVelocity(resolved),
  }
}

/** Replays the fixed command timeline used by client and server authority. */
export function replayMovementCommands(
  position: WorldPosition,
  commands: readonly MovementButtons[],
  isWalkable: WalkabilityFn,
): WorldPosition {
  let next = { ...position }
  for (const command of commands) {
    next = stepMovement(
      next,
      command,
      1 / MOVEMENT_COMMAND_HZ,
      isWalkable,
    ).position
  }
  return next
}
