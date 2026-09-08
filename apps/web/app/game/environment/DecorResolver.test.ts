import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TileType } from "@excave/shared"
import {
  CAVE_DECOR_GROUND_KEYS,
  CAVE_DECOR_WALL_KEYS,
  type CaveDecorFrameKey,
} from "./caveDecor.config"
import {
  DEFAULT_VISUAL_DECOR_SEED,
  clusterFactor,
  hashDecorCell,
  resolveDecor,
  type DecorNeighborFloors,
  type DecorPlacement,
} from "./DecorResolver"

const OPEN: DecorNeighborFloors = { n: true, e: true, s: true, w: true }
const CLOSED: DecorNeighborFloors = { n: false, e: false, s: false, w: false }
const EDGE: DecorNeighborFloors = { n: true, e: false, s: true, w: true }

function placementsEqual(a: DecorPlacement[], b: DecorPlacement[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

describe("hashDecorCell", () => {
  it("is deterministic and seed-sensitive", () => {
    const a = hashDecorCell(DEFAULT_VISUAL_DECOR_SEED, 3, -2, 1)
    const b = hashDecorCell(DEFAULT_VISUAL_DECOR_SEED, 3, -2, 1)
    assert.equal(a, b)
    assert.notEqual(a, hashDecorCell(DEFAULT_VISUAL_DECOR_SEED + 1, 3, -2, 1))
    assert.notEqual(a, hashDecorCell(DEFAULT_VISUAL_DECOR_SEED, 4, -2, 1))
  })

  it("does not imprint a simple CHUNK_SIZE=16 stripe", () => {
    // Adjacent world tiles across a former chunk seam must not share one bit pattern.
    const a = hashDecorCell(DEFAULT_VISUAL_DECOR_SEED, 15, 0, 1)
    const b = hashDecorCell(DEFAULT_VISUAL_DECOR_SEED, 16, 0, 1)
    assert.notEqual(a, b)
    assert.notEqual(a % 1000, b % 1000)
  })
})

describe("clusterFactor", () => {
  it("creates quiet zones and denser pockets", () => {
    let quiet = 0
    let dense = 0
    for (let y = 0; y < 60; y += 1) {
      for (let x = 0; x < 60; x += 1) {
        const f = clusterFactor(DEFAULT_VISUAL_DECOR_SEED, x, y)
        if (f < 0.6) quiet += 1
        if (f >= 0.9) dense += 1
      }
    }
    assert.ok(quiet > dense)
    assert.ok(dense > 0)
  })
})

describe("resolveDecor", () => {
  it("is deterministic for the same seed and world tile", () => {
    const a = resolveDecor(DEFAULT_VISUAL_DECOR_SEED, 12, -4, TileType.Floor, EDGE)
    const b = resolveDecor(DEFAULT_VISUAL_DECOR_SEED, 12, -4, TileType.Floor, EDGE)
    assert.ok(placementsEqual(a, b))
    for (const p of a) {
      assert.ok(p.alpha > 0 && p.alpha <= 1)
    }
  })

  it("changes when the visual seed changes", () => {
    const samples: string[] = []
    for (let y = 0; y < 24; y += 1) {
      for (let x = 0; x < 24; x += 1) {
        const a = resolveDecor(1, x, y, TileType.Floor, EDGE)
        const b = resolveDecor(2, x, y, TileType.Floor, EDGE)
        samples.push(`${JSON.stringify(a)}|${JSON.stringify(b)}`)
      }
    }
    assert.ok(samples.some((s) => s.split("|")[0] !== s.split("|")[1]))
  })

  it("only places wall frames on walls and floor-compatible frames on floors", () => {
    for (let y = 0; y < 40; y += 1) {
      for (let x = 0; x < 40; x += 1) {
        for (const p of resolveDecor(
          DEFAULT_VISUAL_DECOR_SEED,
          x,
          y,
          TileType.Floor,
          EDGE,
        )) {
          assert.ok(
            p.layer === "groundDecor" || p.layer === "foregroundDecor",
            `floor got ${p.layer}`,
          )
        }

        for (const p of resolveDecor(
          DEFAULT_VISUAL_DECOR_SEED,
          x,
          y,
          TileType.Wall,
          EDGE,
        )) {
          assert.equal(p.layer, "wallDecor")
          assert.ok(
            (CAVE_DECOR_WALL_KEYS as readonly string[]).includes(p.frame) ||
              p.frame === "decor_root",
          )
        }
      }
    }
  })

  it("keeps density sparse (majority of tiles empty)", () => {
    let floorHits = 0
    let wallHits = 0
    const n = 48
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (
          resolveDecor(DEFAULT_VISUAL_DECOR_SEED, x, y, TileType.Floor, OPEN)
            .length > 0
        ) {
          floorHits += 1
        }
        if (
          resolveDecor(DEFAULT_VISUAL_DECOR_SEED, x, y, TileType.Wall, EDGE)
            .length > 0
        ) {
          wallHits += 1
        }
      }
    }
    const cells = n * n
    assert.ok(floorHits / cells < 0.18, `floor density ${floorHits / cells}`)
    assert.ok(floorHits / cells > 0.015, `floor density too empty ${floorHits / cells}`)
    assert.ok(wallHits / cells < 0.15, `wall density ${wallHits / cells}`)
    assert.equal(
      resolveDecor(DEFAULT_VISUAL_DECOR_SEED, 0, 0, TileType.Wall, CLOSED).length,
      0,
    )
  })

  it("favors some decor near walls vs open floor", () => {
    let openHits = 0
    let edgeHits = 0
    const n = 64
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (
          resolveDecor(DEFAULT_VISUAL_DECOR_SEED, x, y, TileType.Floor, OPEN)
            .length > 0
        ) {
          openHits += 1
        }
        if (
          resolveDecor(DEFAULT_VISUAL_DECOR_SEED, x, y, TileType.Floor, EDGE)
            .length > 0
        ) {
          edgeHits += 1
        }
      }
    }
    assert.ok(edgeHits > openHits)
  })

  it("keeps mushrooms rarer than dust/cracks and never as wallDecor", () => {
    let mushrooms = 0
    let dustOrCrack = 0
    for (let y = 0; y < 80; y += 1) {
      for (let x = 0; x < 80; x += 1) {
        for (const p of resolveDecor(
          DEFAULT_VISUAL_DECOR_SEED,
          x,
          y,
          TileType.Floor,
          EDGE,
        )) {
          if (p.frame.startsWith("decor_mushroom")) mushrooms += 1
          if (p.frame.startsWith("decor_dust") || p.frame.startsWith("decor_crack")) {
            dustOrCrack += 1
          }
          assert.notEqual(p.layer, "wallDecor")
        }
      }
    }
    assert.ok(dustOrCrack > mushrooms * 2)
  })

  it("never assigns ground-only keys to wallDecor layer", () => {
    const groundOnly = new Set<CaveDecorFrameKey>(
      CAVE_DECOR_GROUND_KEYS.filter(
        (k) => k !== "decor_root" && k !== "decor_root_fork",
      ),
    )
    for (let y = 0; y < 30; y += 1) {
      for (let x = 0; x < 30; x += 1) {
        for (const p of resolveDecor(
          DEFAULT_VISUAL_DECOR_SEED,
          x,
          y,
          TileType.Wall,
          EDGE,
        )) {
          assert.equal(groundOnly.has(p.frame), false)
        }
      }
    }
  })
})
