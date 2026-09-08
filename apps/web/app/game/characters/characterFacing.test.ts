import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { facingFromDelta } from "./characterFacing.ts"

describe("facingFromDelta", () => {
  it("maps cardinal deltas (Y+ = down)", () => {
    assert.deepEqual(facingFromDelta(1, 0, "down"), {
      motion: "walk",
      facing: "right",
    })
    assert.deepEqual(facingFromDelta(-1, 0, "down"), {
      motion: "walk",
      facing: "left",
    })
    assert.deepEqual(facingFromDelta(0, -1, "down"), {
      motion: "walk",
      facing: "up",
    })
    assert.deepEqual(facingFromDelta(0, 1, "down"), {
      motion: "walk",
      facing: "down",
    })
  })

  it("stays idle and keeps facing under epsilon", () => {
    assert.deepEqual(facingFromDelta(0.00001, 0, "left", 0.45), {
      motion: "idle",
      facing: "left",
    })
    assert.deepEqual(facingFromDelta(0, 0, "up"), {
      motion: "idle",
      facing: "up",
    })
  })

  it("picks dominant axis on diagonals without oscillating when previous matches", () => {
    const keepLeft = facingFromDelta(-1, -1, "left")
    assert.equal(keepLeft.motion, "walk")
    assert.equal(keepLeft.facing, "left")

    const keepUp = facingFromDelta(-1, -1, "up")
    assert.equal(keepUp.motion, "walk")
    assert.equal(keepUp.facing, "up")
  })

  it("prefers clearly dominant horizontal / vertical", () => {
    assert.equal(facingFromDelta(2, 1, "down").facing, "right")
    assert.equal(facingFromDelta(1, 2, "left").facing, "down")
    assert.equal(facingFromDelta(-2, 1, "up").facing, "left")
    assert.equal(facingFromDelta(1, -2, "right").facing, "up")
  })
})
