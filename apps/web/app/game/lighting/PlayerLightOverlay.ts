import { Container, Graphics } from "pixi.js"
import {
  LOCAL_LIGHT_RINGS,
  ringsForStrength,
  type LightSource,
} from "./lightRings"

const DARKNESS_COLOR = 0x000000
const WARM_COLOR = 0xf2ca7c
const HELMET_GLOW_RADIUS_PX = 28

/**
 * Stepped void outside the lamp.
 * Readable near the player; deep black far away.
 * (No Pixi masks — `cut()` holes; inverse masks were leaving a full black veil.)
 */
const VEIL_ALPHAS = [0.62, 0.4, 0.22, 0.1] as const

/**
 * Screen-space lamp overlay: full-screen veils with circular cutouts.
 * Wall tops stay above this layer (pure void beyond rock).
 */
export class PlayerLightOverlay {
  readonly root = new Container()

  private readonly warm = new Graphics()
  private readonly veils: Graphics[] = []
  private width = 1
  private height = 1

  constructor() {
    const ringCount = Math.min(LOCAL_LIGHT_RINGS.length, VEIL_ALPHAS.length)
    for (let i = 0; i < ringCount; i += 1) {
      const veil = new Graphics()
      this.veils.push(veil)
      this.root.addChild(veil)
    }

    this.root.addChild(this.warm)
    this.root.eventMode = "none"
  }

  setViewport(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width))
    this.height = Math.max(1, Math.floor(height))
  }

  redraw(
    lights: readonly LightSource[],
    zoom: number,
    offset: { x: number; y: number },
    _isFloorTile?: (tileX: number, tileY: number) => boolean,
  ): void {
    const w = this.width
    const h = this.height

    for (let layerIndex = 0; layerIndex < this.veils.length; layerIndex += 1) {
      const veil = this.veils[layerIndex]!
      const alpha = VEIL_ALPHAS[layerIndex] ?? 0.2

      veil.clear()

      if (lights.length === 0) {
        veil.rect(0, 0, w, h)
        veil.fill({ color: DARKNESS_COLOR, alpha: 0.92 })
        continue
      }

      veil.rect(0, 0, w, h)
      veil.fill({ color: DARKNESS_COLOR, alpha })

      // Outer veil → largest cutout; inner veil → tighter pocket.
      const ringFromOutside = this.veils.length - 1 - layerIndex

      for (const light of lights) {
        const lx = light.floorX ?? light.x
        const ly = light.floorY ?? light.y
        const sx = Math.round(offset.x + lx * zoom)
        const sy = Math.round(offset.y + ly * zoom)
        const rings = ringsForStrength(light.strength)
        const ring = rings[ringFromOutside] ?? rings[rings.length - 1]!
        const radius = Math.max(64, ring.radius * zoom)
        veil.circle(sx, sy, radius)
        veil.cut()
      }
    }

    this.warm.clear()
    for (const light of lights) {
      const sx = Math.round(offset.x + light.x * zoom)
      const sy = Math.round(offset.y + light.y * zoom)
      const glow = HELMET_GLOW_RADIUS_PX * zoom * Math.max(0.7, light.strength)

      this.warm.circle(sx, sy, glow * 2.4)
      this.warm.fill({ color: WARM_COLOR, alpha: 0.05 * light.strength })
      this.warm.circle(sx, sy, glow * 0.9)
      this.warm.fill({ color: 0xffe1a0, alpha: 0.1 * light.strength })
    }
  }

  destroy(): void {
    this.root.destroy({ children: true })
    this.veils.length = 0
  }
}
