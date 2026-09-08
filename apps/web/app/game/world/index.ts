export {
  OpenNeighbor,
  WALL_FACE_SIDE_OVERHANG_X,
  WALL_FACE_SOUTH_OVERHANG_Y,
  buildOpenNeighborMask,
  hashWorldTile,
  isWallVisuallyExposed,
  resolveGroundVariant,
  resolveTerrainPlacements,
  resolveTileVisual,
  resolveWallFaceOverlay,
  resolveWallFaceOverlays,
  resolveWallTile,
  resolveWallTopVariant,
  type GroundVariantId,
  type TerrainLayer,
  type TerrainPlacement,
  type TerrainTextureId,
  type TileVisualId,
  type WallFaceId,
  type WallTileId,
  type WallTopId,
} from "./TileVariantResolver"
export {
  TERRAIN_DEBUG_COLORS,
  TERRAIN_TEST_GRID,
  TERRAIN_TEST_SPAWN,
  buildTerrainTestChunks,
} from "./terrainTestMap"
