import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  chunkRoomId,
  chunkRoomIdsForAoi,
  chunksInRadius,
  isChunkInAoi,
} from "./aoi.js"

describe("aoi helpers", () => {
  it("formats chunk room ids", () => {
    assert.equal(chunkRoomId({ x: 12, y: 18 }), "world:main:chunk:12:18")
  })

  it("builds a 3x3 neighborhood for radius 1", () => {
    const rooms = chunkRoomIdsForAoi({ x: 0, y: 0 })
    assert.equal(rooms.length, 9)
    assert.ok(rooms.includes("world:main:chunk:-1:-1"))
    assert.ok(rooms.includes("world:main:chunk:0:0"))
    assert.ok(rooms.includes("world:main:chunk:1:1"))
  })

  it("detects chunks inside AOI", () => {
    assert.equal(isChunkInAoi({ x: 0, y: 0 }, { x: 1, y: 1 }), true)
    assert.equal(isChunkInAoi({ x: 0, y: 0 }, { x: 2, y: 0 }), false)
  })

  it("lists chunk coordinates in radius", () => {
    assert.equal(chunksInRadius({ x: 5, y: 5 }, 0).length, 1)
    assert.equal(chunksInRadius({ x: 5, y: 5 }, 1).length, 9)
  })
})
