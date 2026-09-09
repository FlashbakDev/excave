import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SCAN_PULSE_DURATION_SEC,
  SCAN_PULSE_QUANTIZE_PX,
  ScanPulseEffect,
  pulseLeadingRadius,
  quantizeRadius,
} from "./ScanPulseEffect.ts"

describe("ScanPulseEffect math", () => {
  it("keeps duration in the short juice band", () => {
    assert.ok(SCAN_PULSE_DURATION_SEC >= 0.4)
    assert.ok(SCAN_PULSE_DURATION_SEC <= 0.7)
  })

  it("quantizes radii to even world pixels", () => {
    assert.equal(quantizeRadius(7), 8)
    assert.equal(quantizeRadius(2.2), SCAN_PULSE_QUANTIZE_PX)
    assert.equal(quantizeRadius(0), SCAN_PULSE_QUANTIZE_PX)
  })

  it("expands from near-zero to full range with ease-out", () => {
    const range = 80
    const start = pulseLeadingRadius(0, SCAN_PULSE_DURATION_SEC, range)
    const mid = pulseLeadingRadius(
      SCAN_PULSE_DURATION_SEC * 0.5,
      SCAN_PULSE_DURATION_SEC,
      range,
    )
    const end = pulseLeadingRadius(
      SCAN_PULSE_DURATION_SEC,
      SCAN_PULSE_DURATION_SEC,
      range,
    )
    assert.ok(start < mid)
    assert.ok(mid < end)
    assert.equal(end, quantizeRadius(range))
  })
})

describe("ScanPulseEffect lifecycle", () => {
  it("stacks pulses and clears without a per-pulse timer", () => {
    const effect = new ScanPulseEffect()
    effect.play({ x: 10, y: 20 }, 80)
    effect.play({ x: 11, y: 21 }, 80)
    assert.equal(effect.activeCount, 2)

    effect.clear()
    assert.equal(effect.activeCount, 0)
  })

  it("expires pulses after duration via tick", () => {
    const effect = new ScanPulseEffect()
    const layer = {
      clear() {},
      circle() {
        return this
      },
      fill() {
        return this
      },
      stroke() {
        return this
      },
    }

    effect.play({ x: 0, y: 0 }, 64)
    effect.tick(SCAN_PULSE_DURATION_SEC * 0.5, layer as never)
    assert.equal(effect.activeCount, 1)

    effect.tick(SCAN_PULSE_DURATION_SEC, layer as never)
    assert.equal(effect.activeCount, 0)
  })
})
