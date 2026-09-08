import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { AreaOfInterestManager } from "./AreaOfInterestManager.js"

describe("AreaOfInterestManager", () => {
  it("returns 9 rooms for radius 1", () => {
    const aoi = new AreaOfInterestManager("main")
    const rooms = aoi.roomsFor({ x: 2, y: 3 })
    assert.equal(rooms.length, 9)
    assert.ok(rooms.includes("world:main:chunk:2:3"))
  })

  it("diffs join/leave without redundant rooms on east move", () => {
    const aoi = new AreaOfInterestManager("main")
    const diff = aoi.diff({ x: 0, y: 0 }, { x: 1, y: 0 })

    assert.deepEqual(diff.roomsToJoin.sort(), [
      "world:main:chunk:2:-1",
      "world:main:chunk:2:0",
      "world:main:chunk:2:1",
    ])
    assert.deepEqual(diff.roomsToLeave.sort(), [
      "world:main:chunk:-1:-1",
      "world:main:chunk:-1:0",
      "world:main:chunk:-1:1",
    ])
  })

  it("returns empty diff when chunk does not change", () => {
    const aoi = new AreaOfInterestManager("main")
    const diff = aoi.diff({ x: 4, y: 4 }, { x: 4, y: 4 })
    assert.deepEqual(diff, { roomsToJoin: [], roomsToLeave: [] })
  })
})
