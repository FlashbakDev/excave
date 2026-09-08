import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PLAYER_SPEED_PX_PER_SEC } from "./constants.js"
import { stepMovement } from "./movement.js"

describe("stepMovement", () => {
  it("does not move when no buttons are pressed", () => {
    const result = stepMovement(
      { x: 10, y: 20 },
      { up: false, down: false, left: false, right: false },
      0.05,
      () => true,
    )
    assert.deepEqual(result.position, { x: 10, y: 20 })
    assert.deepEqual(result.velocity, { x: 0, y: 0 })
  })

  it("moves right on open floor", () => {
    const result = stepMovement(
      { x: 0, y: 0 },
      { up: false, down: false, left: false, right: true },
      1,
      () => true,
    )
    assert.equal(result.position.x, PLAYER_SPEED_PX_PER_SEC)
    assert.equal(result.position.y, 0)
  })

  it("blocks movement into walls on one axis and allows sliding", () => {
    const isWalkable = (position: { x: number; y: number }) => position.x < 50
    const result = stepMovement(
      { x: 40, y: 10 },
      { up: false, down: true, left: false, right: true },
      1,
      isWalkable,
    )
    assert.equal(result.position.x, 40)
    assert.ok(result.position.y > 10)
  })

  it("normalizes diagonal speed", () => {
    const result = stepMovement(
      { x: 0, y: 0 },
      { up: true, down: false, left: false, right: true },
      1,
      () => true,
    )
    const speed = Math.hypot(result.velocity.x, result.velocity.y)
    assert.ok(Math.abs(speed - PLAYER_SPEED_PX_PER_SEC) < 1e-6)
  })
})
