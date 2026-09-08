import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ExcavationSessionStatus,
  TreasureRarity,
  TreasureType,
  type PlayerId,
  type WorldId,
} from "@excave/shared"
import { PersistenceStore } from "./PersistenceStore.js"
import type { ExcavationNode } from "../excavation/generateNodes.js"

function fakeNode(id = "node-1"): ExcavationNode {
  return {
    id,
    worldId: "main" as WorldId,
    chunkX: 0,
    chunkY: 0,
    tileX: 1,
    tileY: 1,
    worldTileX: 1,
    worldTileY: 1,
    wallSide: "north",
    seed: 42,
    status: "IN_PROGRESS",
    activePlayerId: null,
  }
}

describe("PersistenceStore (memory)", () => {
  it("awards recovered loot once per session and keeps inventory", async () => {
    const store = new PersistenceStore(null)
    const playerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as PlayerId
    const recovered = [
      {
        type: TreasureType.Quartz,
        rarity: TreasureRarity.Common,
        name: "Quartz",
      },
      {
        type: TreasureType.Ammonite,
        rarity: TreasureRarity.Uncommon,
        name: "Ammonite",
      },
    ]

    const first = await store.finalizeExcavation({
      sessionId: "session-1",
      node: fakeNode(),
      playerId,
      status: ExcavationSessionStatus.Completed,
      recovered,
    })
    assert.equal(first.items.length, 2)
    assert.equal(
      first.items.find((i) => i.type === TreasureType.Quartz)?.quantity,
      1,
    )

    const duplicate = await store.finalizeExcavation({
      sessionId: "session-1",
      node: fakeNode(),
      playerId,
      status: ExcavationSessionStatus.Completed,
      recovered,
    })
    assert.equal(
      duplicate.items.find((i) => i.type === TreasureType.Quartz)?.quantity,
      1,
    )

    const second = await store.finalizeExcavation({
      sessionId: "session-2",
      node: fakeNode("node-2"),
      playerId,
      status: ExcavationSessionStatus.Collapsed,
      recovered: [
        {
          type: TreasureType.Quartz,
          rarity: TreasureRarity.Common,
          name: "Quartz",
        },
      ],
    })
    assert.equal(
      second.items.find((i) => i.type === TreasureType.Quartz)?.quantity,
      2,
    )

    const depleted = await store.listDepletedNodeIds("main" as WorldId)
    assert.ok(depleted.includes("node-1"))
    assert.ok(depleted.includes("node-2"))
  })
})
