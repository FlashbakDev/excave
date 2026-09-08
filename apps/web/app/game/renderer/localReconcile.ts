import {
  PLAYER_SPEED_PX_PER_SEC,
  stepMovement,
  type MovementButtons,
  type WorldPosition,
} from "@excave/shared"

/**
 * Only hard-correct when clearly desynced (wrong chunk / blocked differently).
 * At 140 px/s and 200 ms stall this is ~28 px — 96 px is well above normal RTT lead.
 */
export const RECONCILE_TELEPORT_PX = 96

/** Keep trusting local prediction this long after the last movement input. */
export const RECONCILE_MOVE_GRACE_MS = 180

export interface InputSample {
  sequence: number
  buttons: MovementButtons
  atMs: number
}

export type WalkabilityFn = (position: WorldPosition) => boolean

export type ReconcileAction =
  | { type: "none" }
  | { type: "apply"; position: WorldPosition }

function isHolding(buttons: MovementButtons): boolean {
  return buttons.up || buttons.down || buttons.left || buttons.right
}

/**
 * Local view is prediction-first.
 * Soft blends are forbidden — they feel elastic at any ping.
 * We only snap on large desync, then catch up with current buttons briefly.
 */
export function planLocalReconcile(options: {
  current: WorldPosition
  auth: WorldPosition
  buttons: MovementButtons
  nowMs: number
  lastMoveInputAtMs: number
  oneWayLatencySec: number
  isWalkable: WalkabilityFn
}): ReconcileAction {
  const {
    current,
    auth,
    buttons,
    nowMs,
    lastMoveInputAtMs,
    oneWayLatencySec,
    isWalkable,
  } = options

  const distance = Math.hypot(current.x - auth.x, current.y - auth.y)
  const recentlyMoved = nowMs - lastMoveInputAtMs <= RECONCILE_MOVE_GRACE_MS
  const moving = isHolding(buttons) || recentlyMoved

  // Prediction lead at 63 ms ≈ 9 px — never pull while locomoting.
  if (moving) {
    if (distance < RECONCILE_TELEPORT_PX) {
      return { type: "none" }
    }
    // Real desync while moving: snap to auth + short catch-up predict.
    return {
      type: "apply",
      position: catchUpFromAuth(auth, buttons, oneWayLatencySec, isWalkable),
    }
  }

  // Fully idle: adopt auth immediately (one small settle, not a blend loop).
  if (distance < 0.75) {
    return { type: "none" }
  }

  return { type: "apply", position: { x: auth.x, y: auth.y } }
}

function catchUpFromAuth(
  auth: WorldPosition,
  buttons: MovementButtons,
  oneWayLatencySec: number,
  isWalkable: WalkabilityFn,
): WorldPosition {
  const dt = Math.min(0.2, Math.max(0.03, oneWayLatencySec))
  return stepMovement(auth, buttons, dt, isWalkable).position
}

export function expectedPredictionLeadPx(latencyMs: number): number {
  return (PLAYER_SPEED_PX_PER_SEC * Math.max(0, latencyMs)) / 1000
}
