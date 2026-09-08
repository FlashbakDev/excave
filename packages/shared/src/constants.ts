/** Pixel size of one tile. */
export const TILE_SIZE = 32

/** Number of tiles along one chunk edge. */
export const CHUNK_SIZE = 32

/** Sole POC world id. */
export const DEFAULT_WORLD_ID = "main" as const

/** Room/corridor lattice period in world tiles (generator). */
export const WORLD_ROOM_PERIOD = 16

/** Player movement speed (pixels / second). */
export const PLAYER_SPEED_PX_PER_SEC = 140

/** Server simulation rate. */
export const SIM_TICK_HZ = 20

/** Authoritative player state broadcast rate. */
export const STATE_BROADCAST_HZ = 10

/** Chunk neighborhood radius for AOI / chunk streaming (3×3 when 1). */
export const AOI_RADIUS = 1

/** Max distance (px) to detect a buried node via SCAN. */
export const SCAN_RANGE_PX = TILE_SIZE * 2.5

/** Minimum ms between SCAN uses (server-enforced). */
export const SCAN_COOLDOWN_MS = 2000

/** Max distance (px) to start an excavation on a detected node. */
export const EXCAVATION_RANGE_PX = TILE_SIZE * 1.5

/** Excavation mini-game grid (Lot 7). */
export const EXCAVATION_GRID_WIDTH = 12
export const EXCAVATION_GRID_HEIGHT = 8

/** Max visible rock layers per cell. */
export const EXCAVATION_MAX_ROCK = 4

/** Starting stability for a stub excavation session. */
export const EXCAVATION_MAX_STABILITY = 100

/** Minimum ms between excavation hits (server-enforced). */
export const EXCAVATION_HIT_COOLDOWN_MS = 120
