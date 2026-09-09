import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ExcavationTool } from "@excave/shared"
import {
  ExcavationImpactFx,
  impactDuration,
  toolToImpact,
} from "./excavationImpactFx.ts"

describe("toolToImpact", () => {
  it("maps tools to pick vs hammer feel", () => {
    assert.equal(toolToImpact(ExcavationTool.Pickaxe), "pick")
    assert.equal(toolToImpact(ExcavationTool.Hammer), "hammer")
  })
})

describe("ExcavationImpactFx", () => {
  it("expires effects through a shared tick (no per-cell timer)", () => {
    const fx = new ExcavationImpactFx()
    fx.spawnTap(1, 2, ExcavationTool.Pickaxe)
    assert.equal(fx.activeCount, 1)
    fx.tick(impactDuration("tap", "pick") + 0.01)
    assert.equal(fx.activeCount, 0)
  })

  it("makes hammer hits heavier than pick chips", () => {
    const pick = new ExcavationImpactFx()
    const hammer = new ExcavationImpactFx()
    pick.spawnFromDelta({
      x: 0,
      y: 0,
      tool: ExcavationTool.Pickaxe,
      fromRock: 3,
      toRock: 2,
      revealedMetal: false,
      revealedTreasure: false,
    })
    hammer.spawnFromDelta({
      x: 0,
      y: 0,
      tool: ExcavationTool.Hammer,
      fromRock: 3,
      toRock: 1,
      revealedMetal: false,
      revealedTreasure: false,
    })
    assert.equal(pick.getActive()[0]?.kind, "chip")
    assert.equal(hammer.getActive()[0]?.kind, "burst")
    assert.ok(hammer.getShake() > pick.getShake())
  })

  it("spawns distinct metal and treasure reveals", () => {
    const fx = new ExcavationImpactFx()
    fx.spawnFromDelta({
      x: 2,
      y: 3,
      tool: ExcavationTool.Pickaxe,
      fromRock: 1,
      toRock: 0,
      revealedMetal: true,
      revealedTreasure: true,
    })
    const kinds = fx.getActive().map((e) => e.kind).sort()
    assert.deepEqual(kinds, ["chip", "metal", "treasure"])
  })
})
