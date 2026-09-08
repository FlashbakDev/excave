import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PLAYER_SPEED_PX_PER_SEC, type PlayerStateEntry } from "@excave/shared"
import { LocalMovementController } from "./LocalMovementController"

const open = () => true
const right = { up: false, down: false, left: false, right: true }

function authority(
  sequence: number,
  x: number,
  epoch = "epoch-a",
  serverTick = 1,
): PlayerStateEntry {
  return {
    playerId: "00000000-0000-4000-8000-000000000001",
    x,
    y: 0,
    vx: PLAYER_SPEED_PX_PER_SEC,
    vy: 0,
    chunkX: 0,
    chunkY: 0,
    movementEpoch: epoch,
    lastProcessedSequence: sequence,
    lastProcessedTick: serverTick,
  }
}

describe("LocalMovementController", () => {
  it("generates fixed commands independently from render FPS", () => {
    const positions = [30, 60, 144].map((fps) => {
      const controller = new LocalMovementController()
      controller.reset("epoch-a", 0, { x: 0, y: 0 })
      for (let frame = 0; frame < fps * 3; frame += 1) {
        controller.simulate(1000 / fps, right, open)
      }
      return controller.getPosition().x
    })

    for (const position of positions) {
      assert.ok(Math.abs(position - PLAYER_SPEED_PX_PER_SEC * 3) < 1e-6)
    }
  })

  it("resets to authority and exactly replays unacknowledged commands", () => {
    const controller = new LocalMovementController()
    controller.reset("epoch-a", 0, { x: 0, y: 0 })
    controller.simulate(50, right, open)
    assert.equal(controller.takeBatch()?.commands.length, 3)

    const result = controller.reconcile(
      authority(2, (PLAYER_SPEED_PX_PER_SEC * 2) / 60),
      open,
    )
    assert.equal(result.accepted, true)
    assert.equal(result.pendingCount, 1)
    assert.ok(
      Math.abs(result.position.x - (PLAYER_SPEED_PX_PER_SEC * 3) / 60) <
        1e-9,
    )
    assert.ok(result.correctionPx < 1e-9)
  })

  it("rejects stale epochs without mutating prediction", () => {
    const controller = new LocalMovementController()
    controller.reset("epoch-a", 0, { x: 0, y: 0 })
    controller.simulate(50, right, open)
    const before = controller.getPosition()
    const result = controller.reconcile(authority(3, 0, "epoch-old"), open)

    assert.equal(result.accepted, false)
    assert.deepEqual(controller.getPosition(), before)
  })

  it("rejects snapshots older than the accepted acknowledgement", () => {
    const controller = new LocalMovementController()
    controller.reset("epoch-a", 0, { x: 0, y: 0 })
    controller.simulate(50, right, open)
    assert.equal(
      controller.reconcile(authority(2, 4, "epoch-a", 10), open).accepted,
      true,
    )
    const before = controller.getPosition()
    assert.equal(
      controller.reconcile(authority(1, 2, "epoch-a", 9), open).accepted,
      false,
    )
    assert.deepEqual(controller.getPosition(), before)
  })

  it("bounds command catch-up after a background-tab stall", () => {
    const controller = new LocalMovementController()
    controller.reset("epoch-a", 0, { x: 0, y: 0 })
    controller.simulate(5_000, right, open)
    assert.equal(controller.takeBatch()?.commands.length, 15)
  })

  it("retransmits unacknowledged commands after generation is locked", () => {
    const controller = new LocalMovementController()
    controller.reset("epoch-a", 0, { x: 0, y: 0 })
    controller.simulate(2_000, right, open)
    const first = controller.takeBatch()
    assert.equal(first?.commands.length, 15)
    assert.equal(controller.takeBatch(), null)
    const retransmit = controller.takeBatch(true)
    assert.deepEqual(
      retransmit?.commands.map((command) => command.sequence),
      first?.commands.map((command) => command.sequence),
    )
  })
})
