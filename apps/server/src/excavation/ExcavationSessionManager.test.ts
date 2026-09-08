import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ExcavationSessionStatus,
  ExcavationTool,
  type PlayerId,
} from "@excave/shared"
import { createWorldManagerFromSeed } from "../db/worldBootstrap.js"
import { ExcavationNodeManager } from "./ExcavationNodeManager.js"
import { generateExcavation } from "./ExcavationGenerator.js"
import {
  HAMMER_KERNEL,
  PICKAXE_KERNEL,
  resolveHit,
} from "./ExcavationHitResolver.js"
import { ExcavationSessionManager } from "./ExcavationSessionManager.js"
import type { ExcavationSessionState } from "./ExcavationSession.js"
import { nodeWorldPosition } from "./generateNodes.js"

describe("generateExcavation", () => {
  it("is deterministic for the same seed", () => {
    const a = generateExcavation(42)
    const b = generateExcavation(42)
    assert.deepEqual(a.rock, b.rock)
    assert.deepEqual(a.metal, b.metal)
    assert.deepEqual(
      a.treasures.map((t) => ({ type: t.type, cells: t.cells })),
      b.treasures.map((t) => ({ type: t.type, cells: t.cells })),
    )
  })

  it("places 2–4 non-overlapping treasures and metal off treasures", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const gen = generateExcavation(seed)
      assert.ok(gen.treasures.length >= 2 && gen.treasures.length <= 4)

      const occupied = new Set<string>()
      for (const treasure of gen.treasures) {
        for (const cell of treasure.cells) {
          const key = `${cell.x}:${cell.y}`
          assert.equal(occupied.has(key), false)
          occupied.add(key)
          const index = cell.y * gen.width + cell.x
          assert.equal(gen.metal[index], false)
        }
      }
    }
  })
})

describe("resolveHit", () => {
  it("applies pickaxe kernel damage and never digs metal", () => {
    const width = 5
    const height = 5
    const size = width * height
    const session: ExcavationSessionState = {
      sessionId: "s1" as ExcavationSessionState["sessionId"],
      nodeId: "n1" as ExcavationSessionState["nodeId"],
      worldId: "w1" as ExcavationSessionState["worldId"],
      playerId: "p1" as PlayerId,
      width,
      height,
      rock: new Array(size).fill(4),
      metal: new Array(size).fill(false),
      revealedMetal: new Array(size).fill(false),
      treasures: [],
      stability: 100,
      maxStability: 100,
      status: ExcavationSessionStatus.Active,
      position: { x: 0, y: 0 },
      lastHitAt: 0,
    }
    const center = 2 * width + 2
    session.metal[center] = true

    const result = resolveHit(session, 2, 2, ExcavationTool.Pickaxe)
    assert.equal(session.rock[center], 4)
    assert.equal(session.revealedMetal[center], true)
    assert.ok(result.changedCells.some((c) => c.x === 2 && c.y === 2 && c.isMetal))

    // Neighbor above center should take pickaxe damage 1.
    assert.equal(session.rock[1 * width + 2], 3)
    assert.equal(PICKAXE_KERNEL[0]![1], 1)
    assert.equal(HAMMER_KERNEL[1]![1], 4)
  })

  it("recovers a treasure only when all its cells are cleared", () => {
    const width = 3
    const height = 3
    const size = width * height
    const session: ExcavationSessionState = {
      sessionId: "s2" as ExcavationSessionState["sessionId"],
      nodeId: "n2" as ExcavationSessionState["nodeId"],
      worldId: "w1" as ExcavationSessionState["worldId"],
      playerId: "p1" as PlayerId,
      width,
      height,
      rock: new Array(size).fill(0),
      metal: new Array(size).fill(false),
      revealedMetal: new Array(size).fill(false),
      treasures: [
        {
          instanceId: "t1",
          type: "quartz",
          cells: [
            { x: 0, y: 0 },
            { x: 2, y: 2 },
          ],
          recovered: false,
        },
      ],
      stability: 100,
      maxStability: 100,
      status: ExcavationSessionStatus.Active,
      position: { x: 0, y: 0 },
      lastHitAt: 0,
    }
    session.rock[0] = 1
    session.rock[2 * width + 2] = 1

    const partial = resolveHit(session, 0, 0, ExcavationTool.Pickaxe)
    assert.equal(partial.newlyRecovered.length, 0)
    assert.equal(session.treasures[0]!.recovered, false)
    assert.equal(session.rock[0], 0)
    assert.equal(session.rock[2 * width + 2], 1)

    const done = resolveHit(session, 2, 2, ExcavationTool.Pickaxe)
    assert.equal(done.newlyRecovered.length, 1)
    assert.equal(done.newlyRecovered[0]!.type, "quartz")
    assert.equal(session.treasures[0]!.recovered, true)
  })
})

describe("ExcavationSessionManager", () => {
  function setup() {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const nodes = new ExcavationNodeManager(world)
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        nodes.ensureChunk({ x, y })
      }
    }
    const node = nodes.listAll()[0]
    assert.ok(node)
    const playerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as PlayerId
    const atNode = nodeWorldPosition(node)
    assert.ok(nodes.scan(playerId, atNode))
    assert.equal(nodes.tryStart(playerId, node.id, atNode).ok, true)
    return { node, playerId, sessions: new ExcavationSessionManager() }
  }

  it("creates a public started payload without secret maps", () => {
    const { node, playerId, sessions } = setup()
    const started = sessions.create(node, playerId)
    assert.equal(started.width, 12)
    assert.equal(started.height, 8)
    assert.equal(started.cells.length, 96)
    assert.equal(started.revealedMetal.length, 96)
    assert.ok(started.treasureCount >= 2 && started.treasureCount <= 4)
    assert.equal(started.recoveredTreasures.length, 0)
    assert.equal(
      Object.prototype.hasOwnProperty.call(started, "metal"),
      false,
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(started, "treasures"),
      false,
    )

    const secrets = sessions.getSecretsForTests(started.sessionId)
    assert.ok(secrets)
    assert.equal(secrets.metal.length, 96)
    assert.equal(secrets.treasures.length, started.treasureCount)
  })

  it("applies hits, enforces cooldown, and keeps loot on collapse", () => {
    const { node, playerId, sessions } = setup()
    const started = sessions.create(node, playerId)
    const secrets = sessions.getSecretsForTests(started.sessionId)!

    // Force two treasures: one easy to recover, one left behind on collapse.
    secrets.treasures.length = 0
    secrets.treasures.push(
      {
        instanceId: "easy",
        type: "quartz",
        cells: [{ x: 0, y: 0 }],
        recovered: false,
      },
      {
        instanceId: "left",
        type: "pyrite",
        cells: [{ x: 11, y: 7 }],
        recovered: false,
      },
    )
    secrets.rock[0] = 1
    secrets.metal[0] = false
    secrets.rock[11 + 7 * 12] = 4
    secrets.metal[11 + 7 * 12] = false

    const warm = sessions.hit(
      playerId,
      started.sessionId,
      5,
      5,
      ExcavationTool.Pickaxe,
      1_000,
    )
    assert.ok(!("error" in warm))

    const cooled = sessions.hit(
      playerId,
      started.sessionId,
      5,
      5,
      ExcavationTool.Pickaxe,
      1_050,
    )
    assert.deepEqual(cooled, { error: "cooldown" })

    const recovered = sessions.hit(
      playerId,
      started.sessionId,
      0,
      0,
      ExcavationTool.Pickaxe,
      2_000,
    )
    assert.ok(!("error" in recovered))
    if ("error" in recovered) return
    assert.ok(recovered.newlyRecoveredTreasures.length >= 1)
    assert.equal(recovered.recoveredTreasures.length, 1)
    assert.equal(recovered.status, ExcavationSessionStatus.Active)
    assert.ok(!("metal" in recovered))
    assert.ok(!("treasures" in recovered))

    // Drain stability to collapse while keeping recovered loot.
    const session = sessions.get(started.sessionId)!
    session.stability = 2
    const collapse = sessions.hit(
      playerId,
      started.sessionId,
      2,
      2,
      ExcavationTool.Pickaxe,
      3_000,
    )
    assert.ok(!("error" in collapse))
    if ("error" in collapse) return
    assert.equal(collapse.status, ExcavationSessionStatus.Collapsed)
    assert.equal(collapse.recoveredTreasures.length, 1)
  })
})
