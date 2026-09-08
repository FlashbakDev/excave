import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { PlayerId } from "@excave/shared"
import { createWorldManagerFromSeed } from "../db/worldBootstrap.js"
import { ExcavationNodeManager } from "./ExcavationNodeManager.js"
import { generateNodesForChunk, nodeWorldPosition } from "./generateNodes.js"

describe("generateNodesForChunk", () => {
  it("is deterministic for a fixed seed and chunk", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const a = generateNodesForChunk(world.numericSeed, world.id, { x: 0, y: 0 })
    const b = generateNodesForChunk(world.numericSeed, world.id, { x: 0, y: 0 })
    assert.equal(a.length, b.length)
    assert.deepEqual(
      a.map((node) => node.id),
      b.map((node) => node.id),
    )
    assert.ok(a.length <= 3)
  })

  it("changes node seeds when the world seed changes", () => {
    const a = createWorldManagerFromSeed("excave-poc-seed-1")
    const b = createWorldManagerFromSeed("excave-poc-seed-2")
    const nodesA = generateNodesForChunk(a.numericSeed, a.id, { x: 0, y: 0 })
    const nodesB = generateNodesForChunk(b.numericSeed, b.id, { x: 0, y: 0 })
    if (nodesA.length > 0 && nodesB.length > 0) {
      assert.notEqual(nodesA[0]?.seed, nodesB[0]?.seed)
    }
  })
})

describe("ExcavationNodeManager", () => {
  it("grants excavation to only one player at a time", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const manager = new ExcavationNodeManager(world)

    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        manager.ensureChunk({ x, y })
      }
    }

    const target = manager.listAll()[0]
    assert.ok(target, "expected at least one node nearby")

    const playerA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as PlayerId
    const playerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as PlayerId
    const atNode = nodeWorldPosition(target)

    assert.ok(manager.scan(playerA, atNode))
    assert.ok(manager.scan(playerB, atNode))

    const first = manager.tryStart(playerA, target.id, atNode)
    assert.equal(first.ok, true)

    const second = manager.tryStart(playerB, target.id, atNode)
    assert.equal(second.ok, false)
    if (!second.ok) {
      assert.equal(second.reason, "busy")
    }

    const released = manager.releasePlayer(playerA)
    assert.ok(released.length >= 1)

    const retry = manager.tryStart(playerB, target.id, atNode)
    assert.equal(retry.ok, true)
  })
})
