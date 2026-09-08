import { TILE_SIZE } from "@excave/shared"

export interface LitFloorCell {
  /** World-pixel center of the lit floor tile. */
  x: number
  y: number
  /** Distance from light origin in world px. */
  dist: number
}

/** Prefer a nearby floor tile when the lamp sits on a wall lip / helmet offset. */
export function resolveFloorSeedTile(
  originX: number,
  originY: number,
  isFloorTile: (tileX: number, tileY: number) => boolean,
): { tx: number; ty: number } | null {
  const cx = Math.floor(originX / TILE_SIZE)
  const cy = Math.floor(originY / TILE_SIZE)
  const candidates: Array<[number, number]> = [
    [0, 0],
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [0, 2],
    [0, -2],
    [-2, 0],
    [2, 0],
  ]
  for (const [dx, dy] of candidates) {
    const tx = cx + dx
    const ty = cy + dy
    if (isFloorTile(tx, ty)) {
      return { tx, ty }
    }
  }
  return null
}

/**
 * Flood-fill floor tiles reachable from a light without crossing walls.
 * Core Keeper-style: light wraps through corridors, never through rock.
 */
export function collectFloorLitCells(
  originX: number,
  originY: number,
  radiusPx: number,
  isFloorTile: (tileX: number, tileY: number) => boolean,
): LitFloorCell[] {
  const maxDist = Math.max(0, radiusPx)
  if (maxDist <= 0) {
    return []
  }

  const seed = resolveFloorSeedTile(originX, originY, isFloorTile)
  if (!seed) {
    return []
  }

  const startTx = seed.tx
  const startTy = seed.ty
  const maxTileSteps = Math.ceil(maxDist / TILE_SIZE) + 2
  const visited = new Set<string>()
  const queue: { tx: number; ty: number; dist: number }[] = [
    { tx: startTx, ty: startTy, dist: 0 },
  ]
  visited.add(`${startTx}:${startTy}`)

  const cells: LitFloorCell[] = []
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const

  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur.dist > maxDist) {
      continue
    }

    cells.push({
      x: cur.tx * TILE_SIZE + TILE_SIZE / 2,
      y: cur.ty * TILE_SIZE + TILE_SIZE / 2,
      dist: cur.dist,
    })

    if (cur.dist >= maxDist) {
      continue
    }

    for (const [dx, dy] of dirs) {
      const nx = cur.tx + dx
      const ny = cur.ty + dy
      const key = `${nx}:${ny}`
      if (visited.has(key)) {
        continue
      }
      if (!isFloorTile(nx, ny)) {
        continue
      }
      const step = Math.hypot(dx * TILE_SIZE, dy * TILE_SIZE)
      const nextDist = cur.dist + step
      if (nextDist > maxDist) {
        continue
      }
      const manhattan = Math.abs(nx - startTx) + Math.abs(ny - startTy)
      if (manhattan > maxTileSteps) {
        continue
      }
      visited.add(key)
      queue.push({ tx: nx, ty: ny, dist: nextDist })
    }
  }

  return cells
}
