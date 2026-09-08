import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ASSET_DISPLAY_SCALE,
  ASSET_SOURCE_SIZE,
  CAMERA_ZOOM_LEVELS,
  clampCameraZoom,
  isCameraZoomLevel,
} from "../assets/pixelScale.ts"

describe("pixelScale", () => {
  it("keeps 16×16 source art at ×2 display (= TILE_SIZE)", () => {
    assert.equal(ASSET_SOURCE_SIZE, 16)
    assert.equal(ASSET_DISPLAY_SCALE, 2)
    assert.equal(ASSET_SOURCE_SIZE * ASSET_DISPLAY_SCALE, 32)
  })

  it("only allows integer zoom 1 / 2 / 3", () => {
    assert.deepEqual([...CAMERA_ZOOM_LEVELS], [1, 2, 3])
    assert.equal(isCameraZoomLevel(1), true)
    assert.equal(isCameraZoomLevel(1.5), false)
    assert.equal(clampCameraZoom(0), 1)
    assert.equal(clampCameraZoom(2.7), 2)
    assert.equal(clampCameraZoom(9), 3)
  })
})
