import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PLAYER_COLLISION_BODY_HEIGHT_PX,
  PLAYER_COLLISION_FOOT_PAD_PX,
  PLAYER_COLLISION_HALF_WIDTH_PX,
  PLAYER_SPEED_PX_PER_SEC,
  TILE_SIZE,
} from "./constants.js"
import { canOccupy, stepMovement } from "./movement.js"

describe("canOccupy", () => {
  it("requires the full footprint to sit on walkable tiles", () => {
    // Floor for x < 32, wall otherwise (tile edge at 32).
    const isWalkable = (p: { x: number; y: number }) => p.x < TILE_SIZE
    assert.equal(canOccupy({ x: 16, y: 16 }, isWalkable), true)
    // Feet near wall: right samples cross into wall.
    assert.equal(
      canOccupy({ x: TILE_SIZE - PLAYER_COLLISION_HALF_WIDTH_PX + 1, y: 16 }, isWalkable),
      false,
    )
  })

  it("matches the visible lower-body footprint above the feet", () => {
    assert.equal(PLAYER_COLLISION_HALF_WIDTH_PX * 2, 12)
    assert.equal(PLAYER_COLLISION_BODY_HEIGHT_PX, 10)
    assert.equal(PLAYER_COLLISION_FOOT_PAD_PX, 0)

    const feetY = 20
    const wallAboveLowerBody = (p: { x: number; y: number }) =>
      p.y > feetY - PLAYER_COLLISION_BODY_HEIGHT_PX
    assert.equal(canOccupy({ x: 16, y: feetY }, wallAboveLowerBody), false)
  })
})

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
    // Wall for x >= 64 — footprint half-width must still fit at x=40.
    const isWalkable = (position: { x: number; y: number }) => position.x < 64
    const result = stepMovement(
      { x: 40, y: 10 },
      { up: false, down: true, left: false, right: true },
      1,
      isWalkable,
    )
    assert.equal(result.position.x, 40)
    assert.ok(result.position.y > 10)
    assert.equal(result.velocity.x, 0)
    assert.ok(result.velocity.y > 0)
  })

  it("reports zero velocity when a wall blocks all displacement", () => {
    const result = stepMovement(
      { x: 40, y: 10 },
      { up: false, down: false, left: false, right: true },
      1,
      (position) => position.x < 64,
    )
    assert.deepEqual(result.position, { x: 40, y: 10 })
    assert.deepEqual(result.velocity, { x: 0, y: 0 })
  })

  it("keeps the footprint clear of a vertical wall", () => {
    const wallX = 64
    const isWalkable = (p: { x: number; y: number }) => p.x < wallX
    let pos = { x: 32, y: 40 }
    for (let i = 0; i < 40; i += 1) {
      pos = stepMovement(
        pos,
        { up: false, down: false, left: false, right: true },
        1 / 20,
        isWalkable,
      ).position
    }
    assert.ok(pos.x + PLAYER_COLLISION_HALF_WIDTH_PX <= wallX + 1e-6)
    assert.ok(canOccupy(pos, isWalkable))
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
