import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PlayerRegistry } from "./PlayerRegistry.js"

describe("PlayerRegistry", () => {
  it("creates distinct guest players", () => {
    const registry = new PlayerRegistry()
    const a = registry.create("socket-a", 1000)
    const b = registry.create("socket-b", 1001)

    assert.notEqual(a.playerId, b.playerId)
    assert.equal(registry.count(), 2)
  })

  it("removes players on disconnect cleanup", () => {
    const registry = new PlayerRegistry()
    const player = registry.create("socket-a")

    const removed = registry.removeBySocketId("socket-a")
    assert.equal(removed?.playerId, player.playerId)
    assert.equal(registry.count(), 0)
    assert.equal(registry.removeBySocketId("socket-a"), undefined)
  })
})
