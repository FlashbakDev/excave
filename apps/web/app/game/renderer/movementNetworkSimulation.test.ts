import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MOVEMENT_COMMAND_HZ,
  PLAYER_SPEED_PX_PER_SEC,
  stepMovement,
  type PlayerInputPayload,
  type PlayerMovementCommand,
  type PlayerStateEntry,
  type WorldPosition,
} from "@excave/shared"
import { LocalMovementController } from "./LocalMovementController"

const open = () => true
const right = { up: false, down: false, left: false, right: true }

describe("movement network simulation", () => {
  it("converges under jitter, reordered batches and duplicates", () => {
    const client = new LocalMovementController()
    client.reset("epoch", 0, { x: 0, y: 0 })
    let serverPosition: WorldPosition = { x: 0, y: 0 }
    let ack = 0
    const queue = new Map<number, PlayerMovementCommand>()
    const deliveries: Array<{ frame: number; payload: PlayerInputPayload }> = []
    const snapshots: Array<{ frame: number; entry: PlayerStateEntry }> = []
    const jitterFrames = [0, 5, 1, 8, 2, 3]

    for (let frame = 0; frame < 420; frame += 1) {
      if (frame < 300) {
        client.simulate(1000 / 60, right, open)
        if (frame % 3 === 2) {
          const payload = client.takeBatch()
          if (payload) {
            const delay = jitterFrames[(frame / 3) % jitterFrames.length | 0]!
            deliveries.push({ frame: frame + delay, payload })
            if (frame % 18 === 2) {
              deliveries.push({ frame: frame + delay + 1, payload })
            }
          }
        }
      }

      for (const delivery of deliveries.filter((item) => item.frame === frame)) {
        for (const command of delivery.payload.commands) {
          if (command.sequence > ack) {
            queue.set(command.sequence, command)
          }
        }
      }

      if (frame % 3 === 2) {
        for (let budget = 0; budget < 3; budget += 1) {
          const command = queue.get(ack + 1)
          if (!command) break
          queue.delete(command.sequence)
          serverPosition = stepMovement(
            serverPosition,
            command,
            1 / MOVEMENT_COMMAND_HZ,
            open,
          ).position
          ack = command.sequence
        }
      }

      if (frame % 6 === 5) {
        snapshots.push({
          frame: frame + jitterFrames[frame % jitterFrames.length]!,
          entry: authoritativeEntry(ack, serverPosition),
        })
      }
      for (const snapshot of snapshots.filter((item) => item.frame === frame)) {
        client.reconcile(snapshot.entry, open)
      }
    }

    client.reconcile(authoritativeEntry(ack, serverPosition), open)
    assert.equal(ack, 300)
    assert.equal(client.getPendingCount(), 0)
    assert.ok(Math.abs(client.getPosition().x - serverPosition.x) < 1e-9)
    assert.ok(
      Math.abs(serverPosition.x - PLAYER_SPEED_PX_PER_SEC * 5) < 1e-6,
    )
  })

  it("stays exact during a virtual ten-minute multi-axis soak", () => {
    const client = new LocalMovementController()
    client.reset("epoch", 0, { x: 0, y: 0 })
    let serverPosition: WorldPosition = { x: 0, y: 0 }
    let ack = 0
    const directions = [
      { up: false, down: false, left: false, right: true },
      { up: false, down: true, left: false, right: false },
      { up: false, down: false, left: true, right: false },
      { up: true, down: false, left: false, right: false },
    ]

    for (let batchIndex = 0; batchIndex < 12_000; batchIndex += 1) {
      const buttons = directions[Math.floor(batchIndex / 3_000)]!
      client.simulate(50, buttons, open)
      const payload = client.takeBatch()
      assert.ok(payload)
      for (const command of payload.commands) {
        if (command.sequence !== ack + 1) continue
        serverPosition = stepMovement(
          serverPosition,
          command,
          1 / MOVEMENT_COMMAND_HZ,
          open,
        ).position
        ack = command.sequence
      }
      if (batchIndex % 2 === 1) {
        client.reconcile(authoritativeEntry(ack, serverPosition), open)
      }
    }

    client.reconcile(authoritativeEntry(ack, serverPosition), open)
    assert.equal(ack, MOVEMENT_COMMAND_HZ * 60 * 10)
    assert.equal(client.getPendingCount(), 0)
    assert.ok(Math.hypot(serverPosition.x, serverPosition.y) < 1e-6)
    assert.deepEqual(client.getPosition(), serverPosition)
  })
})

function authoritativeEntry(
  sequence: number,
  position: WorldPosition,
): PlayerStateEntry {
  return {
    playerId: "00000000-0000-4000-8000-000000000001",
    ...position,
    vx: PLAYER_SPEED_PX_PER_SEC,
    vy: 0,
    chunkX: 0,
    chunkY: 0,
    movementEpoch: "epoch",
    lastProcessedSequence: sequence,
    lastProcessedTick: sequence,
  }
}
