import type { WorldPosition } from "@excave/shared"

/** Stepped lamp falloff — stylized rings, not a smooth photo gradient. */
export interface LightRing {
  /** Radius in world pixels (scaled by camera zoom at draw time). */
  radius: number
  /** How much darkness to clear at this ring (1 = fully clear). */
  clearAlpha: number
}

export interface LightSource extends WorldPosition {
  /** 1 = local explorer lamp; remotes are weaker (~0.65–0.75). */
  strength: number
  /** Floor probe origin (feet). Defaults to x/y if omitted. */
  floorX?: number
  floorY?: number
}

/**
 * Local headlamp rings (world px, TILE_SIZE = 32).
 * Wide Core Keeper-style reach (~9 → ~34 tiles at full strength).
 */
export const LOCAL_LIGHT_RINGS: readonly LightRing[] = [
  { radius: 280, clearAlpha: 1 },
  { radius: 480, clearAlpha: 0.78 },
  { radius: 760, clearAlpha: 0.45 },
  { radius: 1100, clearAlpha: 0.2 },
]

/** Remote explorer lamp — same shape, slightly smaller. */
export const REMOTE_LIGHT_STRENGTH = 0.78

export function ringsForStrength(strength: number): LightRing[] {
  const scale = Math.max(0.45, strength)
  return LOCAL_LIGHT_RINGS.map((ring) => ({
    radius: ring.radius * scale,
    clearAlpha: Math.min(1, ring.clearAlpha * (0.65 + 0.35 * strength)),
  }))
}
