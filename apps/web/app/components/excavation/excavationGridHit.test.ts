import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cellFromPointer } from "./excavationGridHit.ts"

describe("cellFromPointer", () => {
  it("maps continuous coords onto a 12×8 grid", () => {
    assert.deepEqual(cellFromPointer(0, 0, 360, 240, 12, 8), { x: 0, y: 0 })
    assert.deepEqual(cellFromPointer(359, 239, 360, 240, 12, 8), { x: 11, y: 7 })
    assert.deepEqual(cellFromPointer(180, 120, 360, 240, 12, 8), { x: 6, y: 4 })
  })

  it("rejects out-of-bounds pointers", () => {
    assert.equal(cellFromPointer(-1, 0, 360, 240, 12, 8), null)
    assert.equal(cellFromPointer(10, 300, 360, 240, 12, 8), null)
  })
})
