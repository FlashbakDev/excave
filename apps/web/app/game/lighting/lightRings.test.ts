import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LOCAL_LIGHT_RINGS,
  REMOTE_LIGHT_STRENGTH,
  ringsForStrength,
} from "./lightRings.ts"

describe("ringsForStrength", () => {
  it("keeps stepped rings (not a single smooth blob)", () => {
    assert.ok(LOCAL_LIGHT_RINGS.length >= 3)
    const local = ringsForStrength(1)
    assert.equal(local.length, LOCAL_LIGHT_RINGS.length)
    assert.ok(local[0]!.radius < local[local.length - 1]!.radius)
    assert.ok(local[0]!.clearAlpha > local[local.length - 1]!.clearAlpha)
  })

  it("makes remote lamps weaker / smaller than local", () => {
    const local = ringsForStrength(1)
    const remote = ringsForStrength(REMOTE_LIGHT_STRENGTH)
    assert.ok(remote[remote.length - 1]!.radius < local[local.length - 1]!.radius)
  })
})
