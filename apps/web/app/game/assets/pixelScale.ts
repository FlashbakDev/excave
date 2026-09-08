/**
 * Pixel-art display conventions (Lot 11).
 * Logical TILE_SIZE stays 32; source art is drawn at 16×16 and scaled ×2.
 */

/** Source pixel art size relative to one world tile. */
export const ASSET_SOURCE_SIZE = 16

/** Display scale from source art → world pixels (16 → 32). */
export const ASSET_DISPLAY_SCALE = 2

/** Integer camera zoom levels only — fractional zoom breaks pixel-perfect. */
export const CAMERA_ZOOM_LEVELS = [1, 2, 3] as const

export type CameraZoomLevel = (typeof CAMERA_ZOOM_LEVELS)[number]

export const DEFAULT_CAMERA_ZOOM: CameraZoomLevel = 2

export function isCameraZoomLevel(value: number): value is CameraZoomLevel {
  return (CAMERA_ZOOM_LEVELS as readonly number[]).includes(value)
}

export function clampCameraZoom(value: number): CameraZoomLevel {
  if (value <= 1) return 1
  if (value >= 3) return 3
  return 2
}
