import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  IDLE_MOVEMENT,
  JOYSTICK_MAX_RADIUS_PX,
  clampStickOffset,
  movementFromStick,
} from "./virtualJoystick.ts"

describe("movementFromStick", () => {
  it("stays idle inside the deadzone", () => {
    assert.deepEqual(movementFromStick(2, 0), IDLE_MOVEMENT)
    assert.deepEqual(movementFromStick(0, -4), IDLE_MOVEMENT)
  })

  it("maps cardinal directions", () => {
    assert.deepEqual(movementFromStick(40, 0), {
      up: false,
      down: false,
      left: false,
      right: true,
    })
    assert.deepEqual(movementFromStick(0, -40), {
      up: true,
      down: false,
      left: false,
      right: false,
    })
  })

  it("allows diagonals when both axes are strong", () => {
    assert.deepEqual(movementFromStick(40, 40), {
      up: false,
      down: true,
      left: false,
      right: true,
    })
  })
})

describe("clampStickOffset", () => {
  it("does not exceed the max radius", () => {
    const clamped = clampStickOffset(200, 0)
    assert.ok(Math.hypot(clamped.x, clamped.y) <= JOYSTICK_MAX_RADIUS_PX + 1e-9)
    assert.ok(clamped.x > 0)
    assert.equal(clamped.y, 0)
  })
})
