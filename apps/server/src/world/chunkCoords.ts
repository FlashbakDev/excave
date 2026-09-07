import type { ChunkCoordinate } from "@excave/shared"

export function uniqueChunkCoordinates(
  coordinates: readonly ChunkCoordinate[],
  limit = 25,
): ChunkCoordinate[] {
  const seen = new Set<string>()
  const result: ChunkCoordinate[] = []

  for (const coordinate of coordinates) {
    if (!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.y)) {
      continue
    }
    const key = `${coordinate.x}:${coordinate.y}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push({ x: coordinate.x, y: coordinate.y })
    if (result.length >= limit) {
      break
    }
  }

  return result
}
