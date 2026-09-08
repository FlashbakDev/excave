import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { VisualPositionSmoother } from "./VisualPositionSmoother"

describe("VisualPositionSmoother", () => {
  it("decays a small correction monotonically without touching simulation", () => {
    const smoother = new VisualPositionSmoother()
    smoother.preserveVisualPosition({ x: 104, y: 0 }, { x: 100, y: 0 })

    const errors: number[] = []
    for (let frame = 0; frame < 20; frame += 1) {
      smoother.resolve({ x: 100, y: 0 }, 16.67)
      errors.push(smoother.getErrorPx())
    }
    assert.ok(errors.every((value, index) => index === 0 || value <= errors[index - 1]!))
    assert.ok(errors.at(-1)! < errors[0]!)
  })

  it("snaps visual state for a large correction", () => {
    const smoother = new VisualPositionSmoother()
    smoother.preserveVisualPosition({ x: 120, y: 0 }, { x: 100, y: 0 })
    assert.deepEqual(smoother.resolve({ x: 100, y: 0 }, 16), {
      x: 100,
      y: 0,
    })
  })
})
