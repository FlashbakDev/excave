import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { computeCameraOffset } from "./cameraMath.ts"

describe("computeCameraOffset", () => {
  it("centers the focus in the viewport at zoom 1", () => {
    assert.deepEqual(computeCameraOffset(800, 600, 0, 0), { x: 400, y: 300 })
    assert.deepEqual(computeCameraOffset(800, 600, 100, -50), { x: 300, y: 350 })
  })

  it("scales focus by integer zoom and snaps to pixels", () => {
    assert.deepEqual(computeCameraOffset(800, 600, 100, 50, 2), {
      x: 200,
      y: 200,
    })
    assert.deepEqual(computeCameraOffset(801, 601, 10.4, 20.6, 1), {
      x: 390,
      y: 280,
    })
  })
})
