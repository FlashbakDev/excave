import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SIM_TICK_HZ } from "@excave/shared"
import type { AreaOfInterestManager } from "../aoi/AreaOfInterestManager.js"
import type { GameSocketServer } from "../realtime/socket.js"
import type { PlayerRegistry } from "../session/PlayerRegistry.js"
import { GameLoop } from "./GameLoop.js"
import type { PlayerRuntimeStore } from "./PlayerRuntimeStore.js"

describe("GameLoop fixed-step accumulator", () => {
  it("runs deterministic ticks and bounds catch-up after a stall", () => {
    const ticks: Array<{ dt: number; tick: number }> = []
    const store = {
      tick(dt: number, tick: number) {
        ticks.push({ dt, tick })
        return []
      },
      count: () => 0,
    } as unknown as PlayerRuntimeStore
    const loop = new GameLoop(
      store,
      {} as GameSocketServer,
      { list: () => [] } as unknown as PlayerRegistry,
      {} as AreaOfInterestManager,
    )

    assert.equal(loop.advance(49), 0)
    assert.equal(loop.advance(1), 1)
    assert.equal(loop.advance(200), 4)
    assert.equal(loop.advance(1000), 5)
    assert.equal(loop.getTimingStats().accumulatorMs, 750)
    assert.equal(loop.advance(5000), 5)
    assert.equal(ticks.length, 15)
    assert.ok(ticks.every(({ dt }) => dt === 1 / SIM_TICK_HZ))
    assert.ok(loop.getTimingStats().droppedTimeMs >= 4_000)
  })
})
