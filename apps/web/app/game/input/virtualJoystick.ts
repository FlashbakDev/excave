import type { MovementButtons } from "@excave/shared"

export const IDLE_MOVEMENT: MovementButtons = {
  up: false,
  down: false,
  left: false,
  right: false,
}

/** Stick travel radius in CSS px. */
export const JOYSTICK_MAX_RADIUS_PX = 56

/** Ignore micro movements inside this fraction of the max radius. */
export const JOYSTICK_DEADZONE = 0.28

/**
 * Map a clamped stick vector to digital WASD-style buttons.
 * Diagonals allowed when both axes are meaningful.
 */
export function movementFromStick(
  dx: number,
  dy: number,
  maxRadiusPx = JOYSTICK_MAX_RADIUS_PX,
  deadzone = JOYSTICK_DEADZONE,
): MovementButtons {
  const magnitude = Math.hypot(dx, dy)
  if (magnitude < maxRadiusPx * deadzone) {
    return { ...IDLE_MOVEMENT }
  }

  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  const diagonalGate = 0.55

  return {
    up: dy < 0 && absY >= absX * diagonalGate,
    down: dy > 0 && absY >= absX * diagonalGate,
    left: dx < 0 && absX >= absY * diagonalGate,
    right: dx > 0 && absX >= absY * diagonalGate,
  }
}

/** Clamp knob offset inside the stick circle. */
export function clampStickOffset(
  dx: number,
  dy: number,
  maxRadiusPx = JOYSTICK_MAX_RADIUS_PX,
): { x: number; y: number } {
  const magnitude = Math.hypot(dx, dy)
  if (magnitude <= maxRadiusPx || magnitude === 0) {
    return { x: dx, y: dy }
  }
  const scale = maxRadiusPx / magnitude
  return {
    x: dx * scale,
    y: dy * scale,
  }
}
