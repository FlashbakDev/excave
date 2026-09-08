import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CAVE_DECOR_FRAME_KEYS,
  CAVE_DECOR_FRAME_RECTS,
  CAVE_DECOR_FRAME_SIZE,
  CAVE_DECOR_GROUND_KEYS,
  CAVE_DECOR_SHEET_SIZE,
  CAVE_DECOR_WALL_KEYS,
  type CaveDecorFrameKey,
} from "./caveDecor.config"

describe("caveDecor.config", () => {
  it("packs 16 unique 16×16 frames inside a 64×64 sheet", () => {
    assert.equal(CAVE_DECOR_FRAME_KEYS.length, 16)
    assert.equal(CAVE_DECOR_SHEET_SIZE.w, 64)
    assert.equal(CAVE_DECOR_SHEET_SIZE.h, 64)

    const seen = new Set<string>()
    for (const key of CAVE_DECOR_FRAME_KEYS) {
      const r = CAVE_DECOR_FRAME_RECTS[key]
      assert.equal(r.w, CAVE_DECOR_FRAME_SIZE)
      assert.equal(r.h, CAVE_DECOR_FRAME_SIZE)
      assert.ok(r.x >= 0 && r.x + r.w <= CAVE_DECOR_SHEET_SIZE.w)
      assert.ok(r.y >= 0 && r.y + r.h <= CAVE_DECOR_SHEET_SIZE.h)
      assert.equal(r.x % CAVE_DECOR_FRAME_SIZE, 0)
      assert.equal(r.y % CAVE_DECOR_FRAME_SIZE, 0)
      const id = `${r.x},${r.y}`
      assert.equal(seen.has(id), false, `duplicate rect ${id}`)
      seen.add(id)
    }
  })

  it("partitions ground vs wall keys without overlap", () => {
    const ground = new Set<CaveDecorFrameKey>(CAVE_DECOR_GROUND_KEYS)
    const wall = new Set<CaveDecorFrameKey>(CAVE_DECOR_WALL_KEYS)
    for (const key of CAVE_DECOR_WALL_KEYS) {
      assert.equal(ground.has(key), false)
    }
    for (const key of CAVE_DECOR_FRAME_KEYS) {
      assert.ok(ground.has(key) || wall.has(key), `${key} uncategorized`)
    }
  })
})
