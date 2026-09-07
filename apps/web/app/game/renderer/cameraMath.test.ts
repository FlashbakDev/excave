import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { computeCameraOffset } from "./cameraMath.ts"

describe("computeCameraOffset", () => {
  it("centers the focus in the viewport", () => {
    assert.deepEqual(computeCameraOffset(800, 600, 0, 0), { x: 400, y: 300 })
    assert.deepEqual(computeCameraOffset(800, 600, 100, -50), { x: 300, y: 350 })
  })
})
