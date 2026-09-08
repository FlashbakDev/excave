import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createWorldManagerFromSeed } from "../db/worldBootstrap.js"
import { PlayerRuntimeStore } from "./PlayerRuntimeStore.js"
import type { PlayerId } from "@excave/shared"

describe("PlayerRuntimeStore", () => {
  it("spawns at world spawn and blocks wall traversal", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const store = new PlayerRuntimeStore(world)
    const playerId = "00000000-0000-4000-8000-000000000001" as PlayerId
    const state = store.spawn(playerId)

    assert.ok(world.isWalkable(state.position))

    // Push hard into a likely wall by applying strong right input for many ticks.
    store.applyInput(playerId, {
      up: false,
      down: false,
      left: false,
      right: true,
      sequence: 1,
    })

    for (let i = 0; i < 200; i += 1) {
      store.tick(0.05)
    }

    const after = store.get(playerId)
    assert.ok(after)
    assert.ok(world.isWalkable(after.position))
  })

  it("ignores stale input sequences", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const store = new PlayerRuntimeStore(world)
    const playerId = "00000000-0000-4000-8000-000000000002" as PlayerId
    store.spawn(playerId)

    assert.equal(
      store.applyInput(playerId, {
        up: true,
        down: false,
        left: false,
        right: false,
        sequence: 5,
      }),
      true,
    )
    assert.equal(
      store.applyInput(playerId, {
        up: false,
        down: true,
        left: false,
        right: false,
        sequence: 4,
      }),
      false,
    )
    assert.equal(store.get(playerId)?.input.up, true)
  })
})
