/** Opaque identifier for a world instance. */
export type WorldId = string

/** Opaque identifier for a player. */
export type PlayerId = string

/** Continuous position in world space (pixels or world units). */
export interface WorldPosition {
  x: number
  y: number
}

/** Integer chunk grid coordinate. */
export interface ChunkCoordinate {
  x: number
  y: number
}

/** Integer tile coordinate within the world grid. */
export interface TileCoordinate {
  x: number
  y: number
}
