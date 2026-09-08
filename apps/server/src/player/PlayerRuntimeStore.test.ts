import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createWorldManagerFromSeed } from "../db/worldBootstrap.js"
import { PlayerRuntimeStore } from "./PlayerRuntimeStore.js"
import type {
  MovementButtons,
  PlayerId,
  PlayerMovementCommand,
} from "@excave/shared"
import { replayMovementCommands } from "@excave/shared"

const right: MovementButtons = {
  up: false,
  down: false,
  left: false,
  right: true,
}

function command(
  sequence: number,
  buttons: MovementButtons = right,
): PlayerMovementCommand {
  return { ...buttons, sequence }
}

describe("PlayerRuntimeStore", () => {
  it("processes fixed commands within real-time movement credit", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const store = new PlayerRuntimeStore(world)
    const playerId = "00000000-0000-4000-8000-000000000001" as PlayerId
    const state = store.spawn(playerId)
    const start = { ...state.position }
    assert.equal(store.applyInput(playerId, {
      movementEpoch: state.movementEpoch,
      commands: Array.from({ length: 30 }, (_, index) => command(index + 1)),
    }), true)

    store.tick(0.05, 1)
    assert.equal(state.lastProcessedSequence, 3)
    assert.equal(state.lastProcessedTick, 1)
    assert.ok(Math.abs(state.position.x - start.x - 7) < 1e-9)
    assert.equal(state.pendingInputs.length, 27)
  })

  it("waits for sequence gaps and heals from redundant batches", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const store = new PlayerRuntimeStore(world)
    const playerId = "00000000-0000-4000-8000-000000000002" as PlayerId
    const state = store.spawn(playerId)

    store.applyInput(playerId, {
      movementEpoch: state.movementEpoch,
      commands: [command(2)],
    })
    store.tick(1 / 60, 1)
    assert.equal(state.lastProcessedSequence, 0)

    store.applyInput(playerId, {
      movementEpoch: state.movementEpoch,
      commands: [command(1), command(2)],
    })
    store.tick(1 / 60, 2)
    assert.equal(state.lastProcessedSequence, 2)
  })

  it("rejects stale commands and commands from another epoch", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const store = new PlayerRuntimeStore(world)
    const playerId = "00000000-0000-4000-8000-000000000003" as PlayerId
    const state = store.spawn(playerId)

    assert.equal(
      store.applyInput(playerId, {
        movementEpoch: state.movementEpoch,
        commands: [command(1)],
      }),
      true,
    )
    store.tick(1 / 60, 1)
    assert.equal(
      store.applyInput(playerId, {
        movementEpoch: state.movementEpoch,
        commands: [command(1)],
      }),
      false,
    )
    assert.equal(
      store.applyInput(playerId, {
        movementEpoch: "old-epoch",
        commands: [command(2)],
      }),
      false,
    )
  })

  it("matches shared replay across turns, diagonals and collisions", () => {
    const world = createWorldManagerFromSeed("excave-poc-seed-1")
    const store = new PlayerRuntimeStore(world)
    const playerId = "00000000-0000-4000-8000-000000000004" as PlayerId
    const state = store.spawn(playerId)
    const start = { ...state.position }
    const timeline = Array.from({ length: 120 }, (_, index) =>
      command(index + 1, {
        up: index >= 30 && index < 60,
        down: index >= 90,
        left: index >= 60 && index < 90,
        right: index < 60,
      }),
    )
    store.applyInput(playerId, {
      movementEpoch: state.movementEpoch,
      commands: timeline,
    })
    for (let tick = 1; tick <= 40; tick += 1) {
      store.tick(0.05, tick)
    }

    const expected = replayMovementCommands(
      start,
      timeline,
      (position) => world.isWalkable(position),
    )
    assert.ok(Math.abs(state.position.x - expected.x) < 1e-9)
    assert.ok(Math.abs(state.position.y - expected.y) < 1e-9)
  })
})
