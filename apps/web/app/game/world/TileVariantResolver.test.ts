import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TileType } from "@excave/shared"
import {
  OpenNeighbor,
  hashWorldTile,
  isWallVisuallyExposed,
  resolveGroundVariant,
  resolveTerrainPlacements,
  resolveWallFaceOverlays,
  resolveWallTopVariant,
} from "./TileVariantResolver.ts"
import {
  TERRAIN_TEST_GRID,
  buildTerrainTestChunks,
} from "./terrainTestMap.ts"

describe("hashWorldTile", () => {
  it("is deterministic and varies by position", () => {
    assert.equal(hashWorldTile(3, 7), hashWorldTile(3, 7))
    assert.notEqual(hashWorldTile(3, 7), hashWorldTile(4, 7))
    assert.notEqual(hashWorldTile(3, 7), hashWorldTile(3, 8))
  })
})

describe("resolveGroundVariant", () => {
  it("returns only ground_01..03 and stays stable", () => {
    const seen = new Set<string>()
    for (let y = 0; y < 32; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const id = resolveGroundVariant(x, y)
        assert.match(id, /^ground_0[1-3]$/)
        seen.add(id)
        assert.equal(resolveGroundVariant(x, y), id)
      }
    }
    assert.equal(seen.size, 3)
  })
})

describe("isWallVisuallyExposed", () => {
  it("is false for surrounded rock (void)", () => {
    assert.equal(isWallVisuallyExposed(0), false)
  })

  it("is true for cardinal floor neighbors only", () => {
    assert.equal(isWallVisuallyExposed(OpenNeighbor.S), true)
    assert.equal(isWallVisuallyExposed(OpenNeighbor.SE), false)
  })
})

describe("resolveWallFaceOverlays", () => {
  it("returns empty for surrounded rock", () => {
    assert.deepEqual(resolveWallFaceOverlays(0), [])
  })

  it("maps south cliffs and skips east/west side lips", () => {
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.S), ["wall_face_s"])
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.E), [])
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.W), [])
  })

  it("uses a south cliff only for outer SE/SW", () => {
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.S | OpenNeighbor.E), [
      "wall_face_s",
    ])
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.S | OpenNeighbor.W), [
      "wall_face_s",
    ])
  })

  it("keeps a full-width south cliff at inner SE/SW junctions", () => {
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.S | OpenNeighbor.SE), [
      "wall_face_s",
    ])
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.S | OpenNeighbor.SW), [
      "wall_face_s",
    ])
  })

  it("does not place faces from diagonals alone", () => {
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.SE), [])
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.NE), [])
  })

  it("uses full south face for peninsula S+E+W", () => {
    assert.deepEqual(
      resolveWallFaceOverlays(
        OpenNeighbor.S | OpenNeighbor.E | OpenNeighbor.W,
      ),
      ["wall_face_s"],
    )
  })

  it("skips north-only open (no vertical face)", () => {
    assert.deepEqual(resolveWallFaceOverlays(OpenNeighbor.N), [])
  })
})

describe("resolveTerrainPlacements", () => {
  it("draws nothing for surrounded rock (void)", () => {
    const neighbor = () => TileType.Wall
    const a = resolveTerrainPlacements(4, -2, TileType.Wall, neighbor)
    assert.deepEqual(a, [])
  })

  it("places ground only on floor tiles", () => {
    const neighbor = () => TileType.Floor
    const p = resolveTerrainPlacements(1, 1, TileType.Floor, neighbor)
    assert.equal(p.length, 1)
    assert.equal(p[0]!.layer, "ground")
    assert.match(p[0]!.textureId, /^ground_0[1-3]$/)
  })

  it("adds wall top + south face when floor is south of wall", () => {
    const map = new Map<string, number>([
      ["0:0", TileType.Wall],
      ["0:1", TileType.Floor],
    ])
    const neighbor = (x: number, y: number) =>
      map.get(`${x}:${y}`) ?? TileType.Wall
    const p = resolveTerrainPlacements(0, 0, TileType.Wall, neighbor)
    assert.equal(p[0]!.layer, "wallTop")
    assert.ok(p.some((x) => x.textureId === "wall_face_s"))
  })

  it("uses a south cliff only for outer SE", () => {
    const map = new Map<string, number>([
      ["1:1", TileType.Wall],
      ["1:2", TileType.Floor],
      ["2:1", TileType.Floor],
    ])
    const neighbor = (x: number, y: number) =>
      map.get(`${x}:${y}`) ?? TileType.Wall
    const p = resolveTerrainPlacements(1, 1, TileType.Wall, neighbor)
    assert.ok(p.some((x) => x.textureId === "wall_face_s"))
    assert.equal(
      p.filter((x) => x.layer === "wallFace").length,
      1,
    )
  })

  it("places a full south face at a T-junction wall", () => {
    const map = new Map<string, number>([
      ["1:1", TileType.Wall],
      ["1:2", TileType.Floor],
      ["2:1", TileType.Wall],
      ["2:2", TileType.Floor],
    ])
    const neighbor = (x: number, y: number) =>
      map.get(`${x}:${y}`) ?? TileType.Wall
    const p = resolveTerrainPlacements(1, 1, TileType.Wall, neighbor)
    assert.ok(p.some((x) => x.textureId === "wall_face_s"))
  })

  it("keeps void for diagonal-only exposure", () => {
    const map = new Map<string, number>([
      ["1:1", TileType.Wall],
      ["2:2", TileType.Floor],
    ])
    const neighbor = (x: number, y: number) =>
      map.get(`${x}:${y}`) ?? TileType.Wall
    const p = resolveTerrainPlacements(1, 1, TileType.Wall, neighbor)
    assert.deepEqual(p, [])
  })

  it("keeps only the wall top when floor is east of a vertical wall", () => {
    const map = new Map<string, number>([
      ["0:0", TileType.Wall],
      ["1:0", TileType.Floor],
    ])
    const neighbor = (x: number, y: number) =>
      map.get(`${x}:${y}`) ?? TileType.Wall
    const p = resolveTerrainPlacements(0, 0, TileType.Wall, neighbor)
    assert.equal(p.length, 1)
    assert.equal(p[0]!.layer, "wallTop")
    assert.ok(!p.some((x) => x.layer === "wallFace"))
  })

  it("stays stable across a fake chunk seam (world coords)", () => {
    const map = new Map<string, number>([["15:0", TileType.Wall], ["15:1", TileType.Floor]])
    const neighbor = (x: number, y: number) =>
      map.get(`${x}:${y}`) ?? TileType.Wall
    const a = resolveTerrainPlacements(15, 0, TileType.Wall, neighbor)
    assert.deepEqual(
      a,
      resolveTerrainPlacements(15, 0, TileType.Wall, neighbor),
    )
    assert.match(a[0]!.textureId, /^wall_top_0[1-3]$/)
    assert.notEqual(
      resolveWallTopVariant(15, 0),
      resolveWallTopVariant(1000, 1000),
    )
  })
})

describe("terrainTestMap", () => {
  it("builds a full CHUNK_SIZE payload with mixed floor/wall", () => {
    const chunks = buildTerrainTestChunks()
    assert.equal(chunks.length, 1)
    assert.equal(chunks[0]!.tiles.length, TERRAIN_TEST_GRID.length ** 2)
    assert.ok(chunks[0]!.tiles.includes(TileType.Floor))
    assert.ok(chunks[0]!.tiles.includes(TileType.Wall))
  })
})
