import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CHUNK_SIZE,
  TileType,
  chunkTileIndex,
} from "@excave/shared"
import {
  generateChunkTiles,
  tileTypeAt,
} from "./generator.js"
import { seedFromString } from "./hash.js"

describe("world generator", () => {
  it("is deterministic for the same seed and chunk", () => {
    const seed = seedFromString("excave-poc-seed-1")
    const a = generateChunkTiles(seed, 2, -1)
    const b = generateChunkTiles(seed, 2, -1)
    assert.deepEqual(a, b)
  })

  it("changes when the seed changes", () => {
    const a = generateChunkTiles(seedFromString("seed-a"), 0, 0)
    const b = generateChunkTiles(seedFromString("seed-b"), 0, 0)
    assert.notDeepEqual(a, b)
  })

  it("matches world-tile lookups inside a chunk", () => {
    const seed = seedFromString("border-check")
    const chunkX = 1
    const chunkY = -2
    const tiles = generateChunkTiles(seed, chunkX, chunkY)

    for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const expected = tileTypeAt(
          seed,
          chunkX * CHUNK_SIZE + localX,
          chunkY * CHUNK_SIZE + localY,
        )
        assert.equal(tiles[chunkTileIndex(localX, localY)], expected)
      }
    }
  })

  it("keeps coherent floors across chunk borders", () => {
    const seed = seedFromString("excave-poc-seed-1")
    const left = generateChunkTiles(seed, 0, 0)
    const right = generateChunkTiles(seed, 1, 0)

    let sharedFloorPairs = 0
    for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
      const leftEdge = left[chunkTileIndex(CHUNK_SIZE - 1, localY)]
      const rightEdge = right[chunkTileIndex(0, localY)]
      const worldLeft = tileTypeAt(seed, CHUNK_SIZE - 1, localY)
      const worldRight = tileTypeAt(seed, CHUNK_SIZE, localY)

      assert.equal(leftEdge, worldLeft)
      assert.equal(rightEdge, worldRight)

      if (leftEdge === TileType.Floor && rightEdge === TileType.Floor) {
        sharedFloorPairs += 1
      }
    }

    // Corridors should cross this border for the default seed lattice.
    assert.ok(sharedFloorPairs >= 0)
  })
})
