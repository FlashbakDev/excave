import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TILE_SIZE } from "@excave/shared"
import {
  collectFloorLitCells,
  resolveFloorSeedTile,
} from "./floorLightVisibility.ts"

describe("resolveFloorSeedTile", () => {
  it("snaps a wall-lip origin down onto neighboring floor", () => {
    // Helmet above feet: origin on wall (ty=0), floor at ty=1
    const isFloor = (_tx: number, ty: number) => ty === 1
    const seed = resolveFloorSeedTile(
      TILE_SIZE / 2,
      TILE_SIZE * 0.2,
      isFloor,
    )
    assert.ok(seed)
    assert.equal(seed!.ty, 1)
  })
})

describe("collectFloorLitCells", () => {
  it("does not cross walls into a parallel corridor", () => {
    const isFloor = (tx: number, ty: number) => ty === 0 || ty === 2
    const originX = 2 * TILE_SIZE + TILE_SIZE / 2
    const originY = 0 * TILE_SIZE + TILE_SIZE / 2
    const cells = collectFloorLitCells(originX, originY, TILE_SIZE * 4, isFloor)
    assert.ok(cells.some((c) => Math.floor(c.y / TILE_SIZE) === 0))
    assert.equal(
      cells.some((c) => Math.floor(c.y / TILE_SIZE) === 2),
      false,
    )
  })

  it("wraps around corners through open floor", () => {
    const floors = new Set(["0:0", "1:0", "2:0", "2:1", "2:2"])
    const isFloor = (tx: number, ty: number) => floors.has(`${tx}:${ty}`)
    const cells = collectFloorLitCells(
      TILE_SIZE / 2,
      TILE_SIZE / 2,
      TILE_SIZE * 6,
      isFloor,
    )
    assert.ok(cells.some((c) => Math.floor(c.x / TILE_SIZE) === 2))
    assert.ok(cells.some((c) => Math.floor(c.y / TILE_SIZE) === 2))
  })

  it("recovers when origin sits on a wall tile above floor", () => {
    const isFloor = (_tx: number, ty: number) => ty >= 1
    const cells = collectFloorLitCells(
      TILE_SIZE / 2,
      4, // near top of wall tile 0
      TILE_SIZE * 3,
      isFloor,
    )
    assert.ok(cells.length > 0)
    assert.ok(cells.every((c) => Math.floor(c.y / TILE_SIZE) >= 1))
  })

  it("is empty-safe for zero radius", () => {
    assert.deepEqual(
      collectFloorLitCells(0, 0, 0, () => true),
      [],
    )
  })
})
