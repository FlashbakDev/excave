/** Public tile kinds visible to clients. */
export const TileType = {
  Floor: 0,
  Wall: 1,
} as const

export type TileType = (typeof TileType)[keyof typeof TileType]

export function isTileType(value: number): value is TileType {
  return value === TileType.Floor || value === TileType.Wall
}
