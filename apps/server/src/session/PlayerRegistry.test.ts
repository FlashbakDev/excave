import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PlayerRegistry } from "./PlayerRegistry.js"

describe("PlayerRegistry", () => {
  it("creates distinct guest players", () => {
    const registry = new PlayerRegistry()
    const a = registry.create("socket-a", null, 1000)
    const b = registry.create("socket-b", null, 1001)

    assert.notEqual(a.playerId, b.playerId)
    assert.equal(registry.count(), 2)
  })

  it("resumes a preferred playerId when free", () => {
    const registry = new PlayerRegistry()
    const preferred = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    const resumed = registry.create("socket-a", preferred)
    assert.equal(resumed.playerId, preferred)

    const other = registry.create("socket-b", preferred)
    assert.notEqual(other.playerId, preferred)
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
