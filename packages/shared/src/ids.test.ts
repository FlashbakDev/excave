import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { ChunkCoordinate, WorldPosition } from "./ids.js"

describe("@excave/shared types", () => {
  it("accepts coordinate shapes", () => {
    const position: WorldPosition = { x: 1, y: 2 }
    const chunk: ChunkCoordinate = { x: 0, y: -1 }

    assert.equal(position.x, 1)
    assert.equal(chunk.y, -1)
  })
})
