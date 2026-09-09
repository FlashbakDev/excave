import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { NodeVisualState } from "@excave/shared"
import {
  NODE_EXAMINE_DEBOUNCE_MS,
  hitHalfForZoom,
  resolveNodePresentation,
  shouldAcceptExamineTap,
} from "./ExcavationNodeView.ts"

describe("resolveNodePresentation", () => {
  it("keeps busy and depleted independent of range", () => {
    assert.equal(resolveNodePresentation(NodeVisualState.Busy, true), "busy")
    assert.equal(resolveNodePresentation(NodeVisualState.Busy, false), "busy")
    assert.equal(
      resolveNodePresentation(NodeVisualState.Depleted, true),
      "depleted",
    )
  })

  it("splits detected into far vs near by proximity", () => {
    assert.equal(resolveNodePresentation(NodeVisualState.Detected, false), "far")
    assert.equal(resolveNodePresentation(NodeVisualState.Detected, true), "near")
  })
})

describe("hitHalfForZoom", () => {
  it("keeps on-screen tap targets at least ~44 CSS px", () => {
    for (const zoom of [1, 2, 3] as const) {
      const half = hitHalfForZoom(zoom)
      const screenPx = half * 2 * zoom
      assert.ok(screenPx >= 44)
    }
  })
})

describe("shouldAcceptExamineTap", () => {
  it("debounces rapid double taps", () => {
    assert.equal(shouldAcceptExamineTap(1000, 1000 - NODE_EXAMINE_DEBOUNCE_MS), true)
    assert.equal(shouldAcceptExamineTap(1000, 900), false)
  })
})
