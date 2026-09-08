import {
  CHUNK_SIZE,
  TILE_SIZE,
  TileType,
  type ChunkCoordinate,
  type ExcavationNodeId,
  type NodeVisualState,
  type PlayerId,
  type WorldId,
  type WorldPosition,
  NodeVisualState as Visual,
} from "@excave/shared"
import { hashInt } from "../world/hash.js"
import { tileTypeAt } from "../world/generator.js"

export type WallSide = "north" | "south" | "east" | "west"

export type NodeStatus = "AVAILABLE" | "IN_PROGRESS" | "DEPLETED"

export interface ExcavationNode {
  id: ExcavationNodeId
  worldId: WorldId
  chunkX: number
  chunkY: number
  /** Local tile within the chunk. */
  tileX: number
  tileY: number
  /** World tile coordinates. */
  worldTileX: number
  worldTileY: number
  wallSide: WallSide
  /** Secret seed for later excavation generation (Lot 8) — never sent to client. */
  seed: number
  status: NodeStatus
  activePlayerId: PlayerId | null
}

interface Candidate {
  localX: number
  localY: number
  worldTileX: number
  worldTileY: number
  wallSide: WallSide
}

const NEIGHBORS: Array<{ dx: number; dy: number; side: WallSide }> = [
  { dx: 0, dy: -1, side: "north" },
  { dx: 0, dy: 1, side: "south" },
  { dx: -1, dy: 0, side: "west" },
  { dx: 1, dy: 0, side: "east" },
]

/**
 * Deterministic 0–3 excavation nodes for a chunk.
 * Only WALL tiles with an adjacent FLOOR qualify.
 */
export function generateNodesForChunk(
  numericSeed: number,
  worldId: WorldId,
  chunk: ChunkCoordinate,
): ExcavationNode[] {
  const count = hashInt(numericSeed, 0x4e4f44, chunk.x, chunk.y) % 4
  if (count === 0) {
    return []
  }

  const candidates = collectCandidates(numericSeed, chunk)
  if (candidates.length === 0) {
    return []
  }

  const picked = pickCandidates(numericSeed, chunk, candidates, count)
  return picked.map((candidate, index) => {
    const seed = hashInt(
      numericSeed,
      0x53454544,
      chunk.x,
      chunk.y,
      candidate.worldTileX,
      candidate.worldTileY,
      index,
    )
    return {
      id: `${worldId}:${chunk.x}:${chunk.y}:${candidate.localX}:${candidate.localY}` as ExcavationNodeId,
      worldId,
      chunkX: chunk.x,
      chunkY: chunk.y,
      tileX: candidate.localX,
      tileY: candidate.localY,
      worldTileX: candidate.worldTileX,
      worldTileY: candidate.worldTileY,
      wallSide: candidate.wallSide,
      seed,
      status: "AVAILABLE" as const,
      activePlayerId: null,
    }
  })
}

export function nodeWorldPosition(node: ExcavationNode): WorldPosition {
  return {
    x: node.worldTileX * TILE_SIZE + TILE_SIZE / 2,
    y: node.worldTileY * TILE_SIZE + TILE_SIZE / 2,
  }
}

export function nodeVisualState(node: ExcavationNode): NodeVisualState {
  switch (node.status) {
    case "IN_PROGRESS":
      return Visual.Busy
    case "DEPLETED":
      return Visual.Depleted
    default:
      return Visual.Detected
  }
}

function collectCandidates(
  numericSeed: number,
  chunk: ChunkCoordinate,
): Candidate[] {
  const baseX = chunk.x * CHUNK_SIZE
  const baseY = chunk.y * CHUNK_SIZE
  const candidates: Candidate[] = []

  for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      const worldTileX = baseX + localX
      const worldTileY = baseY + localY
      if (tileTypeAt(numericSeed, worldTileX, worldTileY) !== TileType.Wall) {
        continue
      }

      for (const neighbor of NEIGHBORS) {
        const nx = worldTileX + neighbor.dx
        const ny = worldTileY + neighbor.dy
        if (tileTypeAt(numericSeed, nx, ny) === TileType.Floor) {
          candidates.push({
            localX,
            localY,
            worldTileX,
            worldTileY,
            wallSide: neighbor.side,
          })
          break
        }
      }
    }
  }

  return candidates
}

function pickCandidates(
  numericSeed: number,
  chunk: ChunkCoordinate,
  candidates: Candidate[],
  count: number,
): Candidate[] {
  if (candidates.length <= count) {
    return candidates
  }

  // Order by deterministic score so picks are stable.
  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      score: hashInt(
        numericSeed,
        0x5049434b,
        chunk.x,
        chunk.y,
        candidate.worldTileX,
        candidate.worldTileY,
        index,
      ),
    }))
    .sort((a, b) => a.score - b.score)

  const selected: Candidate[] = []
  const usedTiles = new Set<string>()
  for (const entry of ranked) {
    const key = `${entry.candidate.localX}:${entry.candidate.localY}`
    if (usedTiles.has(key)) {
      continue
    }
    usedTiles.add(key)
    selected.push(entry.candidate)
    if (selected.length >= count) {
      break
    }
  }
  return selected
}
