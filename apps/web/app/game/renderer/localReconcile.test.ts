import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  RECONCILE_TELEPORT_PX,
  planLocalReconcile,
} from "./localReconcile.ts"

const idle = { up: false, down: false, left: false, right: false }
const right = { up: false, down: false, left: false, right: true }
const open = () => true

describe("planLocalReconcile", () => {
  it("never pulls back for normal prediction lead while moving", () => {
    const action = planLocalReconcile({
      current: { x: 40, y: 0 },
      auth: { x: 10, y: 0 },
      buttons: right,
      nowMs: 1000,
      lastMoveInputAtMs: 1000,
      oneWayLatencySec: 0.032,
      isWalkable: open,
    })
    assert.equal(action.type, "none")
  })

  it("keeps trusting prediction during post-move grace", () => {
    const action = planLocalReconcile({
      current: { x: 40, y: 0 },
      auth: { x: 10, y: 0 },
      buttons: idle,
      nowMs: 1000,
      lastMoveInputAtMs: 900,
      oneWayLatencySec: 0.032,
      isWalkable: open,
    })
    assert.equal(action.type, "none")
  })

  it("hard-settles to auth only when fully idle", () => {
    const action = planLocalReconcile({
      current: { x: 12, y: 0 },
      auth: { x: 0, y: 0 },
      buttons: idle,
      nowMs: 1000,
      lastMoveInputAtMs: 0,
      oneWayLatencySec: 0.032,
      isWalkable: open,
    })
    assert.equal(action.type, "apply")
    if (action.type === "apply") {
      assert.deepEqual(action.position, { x: 0, y: 0 })
    }
  })

  it("teleport-corrects only on large desync while moving", () => {
    const action = planLocalReconcile({
      current: { x: 0, y: 0 },
      auth: { x: RECONCILE_TELEPORT_PX + 10, y: 0 },
      buttons: right,
      nowMs: 1000,
      lastMoveInputAtMs: 1000,
      oneWayLatencySec: 0.05,
      isWalkable: open,
    })
    assert.equal(action.type, "apply")
    if (action.type === "apply") {
      assert.ok(action.position.x > RECONCILE_TELEPORT_PX)
    }
  })
})
