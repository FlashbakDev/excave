import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { RemoteSnapshotBuffer } from "./RemoteSnapshotBuffer"

describe("RemoteSnapshotBuffer", () => {
  it("interpolates on a delayed server timeline", () => {
    const buffer = new RemoteSnapshotBuffer()
    buffer.push({
      serverTime: 1_000,
      receivedAtMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 100, y: 0 },
    })
    buffer.push({
      serverTime: 1_100,
      receivedAtMs: 100,
      position: { x: 10, y: 0 },
      velocity: { x: 100, y: 0 },
    })

    assert.deepEqual(buffer.sample(150), { x: 5, y: 0 })
    assert.equal(buffer.getInterpolationDelayMs(), 100)
  })

  it("bounds extrapolation when snapshots stall", () => {
    const buffer = new RemoteSnapshotBuffer()
    buffer.push({
      serverTime: 1_000,
      receivedAtMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 100, y: 0 },
    })
    assert.deepEqual(buffer.sample(500), { x: 10, y: 0 })
  })

  it("raises interpolation delay under arrival jitter", () => {
    const buffer = new RemoteSnapshotBuffer()
    for (const [index, receivedAtMs] of [0, 100, 260, 300].entries()) {
      buffer.push({
        serverTime: 1_000 + index * 100,
        receivedAtMs,
        position: { x: index * 10, y: 0 },
        velocity: { x: 100, y: 0 },
      })
    }
    assert.ok(buffer.getInterpolationDelayMs() > 100)
    assert.ok(buffer.getInterpolationDelayMs() <= 250)
  })

  it("resets interpolation on a remote teleport", () => {
    const buffer = new RemoteSnapshotBuffer()
    buffer.push({
      serverTime: 1_000,
      receivedAtMs: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    })
    buffer.push({
      serverTime: 1_100,
      receivedAtMs: 100,
      position: { x: 500, y: 0 },
      velocity: { x: 0, y: 0 },
    })
    assert.deepEqual(buffer.sample(100), { x: 500, y: 0 })
  })
})
