import { Container, Sprite, Text, type Texture } from "pixi.js"
import {
  CHARACTER_CONFIG,
  type CharacterMotion,
  type FacingDirection,
} from "./character.config"
import {
  facingFromDelta,
  sheetDirection,
  shouldMirrorFacing,
} from "./characterFacing"
import type { ExplorerTextures } from "./explorerTextures"

export interface CharacterViewOptions {
  /** Optional remote player tint. */
  tint?: number
  /** Short label above the helmet (remote id). */
  label?: string
  initialFacing?: FacingDirection
}

/**
 * Pixi view for one explorer. Follows gameplay positions — never drives them.
 */
export class CharacterView {
  readonly root = new Container()

  private readonly sprite: Sprite
  private readonly textures: ExplorerTextures
  private readonly label: Text | null
  private facing: FacingDirection
  private motion: CharacterMotion = "idle"
  private animTime = 0
  private walkIndex = 0
  private worldX = 0
  private worldY = 0

  constructor(textures: ExplorerTextures, options: CharacterViewOptions = {}) {
    this.textures = textures
    this.facing = options.initialFacing ?? "down"

    this.sprite = new Sprite(textures.idle("down"))
    this.sprite.anchor.set(CHARACTER_CONFIG.anchorX, CHARACTER_CONFIG.anchorY)
    this.sprite.scale.set(CHARACTER_CONFIG.scale)
    this.sprite.roundPixels = true
    if (options.tint !== undefined) {
      this.sprite.tint = options.tint
    }
    this.root.addChild(this.sprite)

    if (options.label) {
      this.label = new Text({
        text: options.label,
        style: {
          fill: 0xc5d8e4,
          fontSize: 11,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        },
      })
      this.label.anchor.set(0.5, 1)
      this.label.position.set(0, CHARACTER_CONFIG.labelOffsetY)
      this.root.addChild(this.label)
    } else {
      this.label = null
    }

    this.root.eventMode = "none"
    this.applyFrame()
  }

  getFacing(): FacingDirection {
    return this.facing
  }

  getMotion(): CharacterMotion {
    return this.motion
  }

  getWorldPosition(): { x: number; y: number } {
    return { x: this.worldX, y: this.worldY }
  }

  /** World position for lamp overlay (near helmet, not feet). */
  getLightPosition(): { x: number; y: number } {
    return {
      x: this.worldX,
      y: this.worldY + CHARACTER_CONFIG.lightOffsetY,
    }
  }

  setWorldPosition(x: number, y: number): void {
    this.worldX = x
    this.worldY = y
    this.root.position.set(x, y)
  }

  /**
   * Apply movement since last sample. Animation follows real displacement
   * (idle when blocked against a wall even if keys are held).
   */
  applyMovementDelta(dx: number, dy: number): void {
    const next = facingFromDelta(dx, dy, this.facing)
    this.setAnimationState(next.facing, next.motion)
  }

  setAnimationState(facing: FacingDirection, motion: CharacterMotion): void {
    const facingChanged = facing !== this.facing
    const motionChanged = motion !== this.motion
    this.facing = facing
    this.motion = motion
    if (facingChanged || motionChanged) {
      if (motionChanged && motion === "walk") {
        this.animTime = 0
        this.walkIndex = 0
      }
      if (motion === "idle") {
        this.animTime = 0
        this.walkIndex = 0
      }
      this.applyFrame()
    }
  }

  /** Advance walk cycle from the shared GameRenderer ticker. */
  update(dtSeconds: number): void {
    if (this.motion !== "walk" || dtSeconds <= 0) {
      return
    }

    this.animTime += dtSeconds
    const frameDuration = 1 / CHARACTER_CONFIG.walkFps
    while (this.animTime >= frameDuration) {
      this.animTime -= frameDuration
      this.walkIndex =
        (this.walkIndex + 1) % CHARACTER_CONFIG.walkFramePattern.length
      this.applyFrame()
    }
  }

  destroy(): void {
    this.root.destroy({ children: true })
  }

  private applyFrame(): void {
    const sheetDir = sheetDirection(this.facing)
    let texture: Texture
    if (this.motion === "idle") {
      texture = this.textures.idle(sheetDir)
    } else {
      const patternIndex =
        CHARACTER_CONFIG.walkFramePattern[this.walkIndex] ?? 0
      texture = this.textures.walk(sheetDir, patternIndex)
    }

    this.sprite.texture = texture
    const mirror = shouldMirrorFacing(this.facing)
    const absScale = CHARACTER_CONFIG.scale
    this.sprite.scale.set(mirror ? -absScale : absScale, absScale)
  }
}
