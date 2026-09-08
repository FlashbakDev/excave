import { Rectangle, Texture } from "pixi.js"
import {
  CAVE_DECOR_FRAME_KEYS,
  CAVE_DECOR_FRAME_RECTS,
  type CaveDecorFrameKey,
} from "./caveDecor.config"

/**
 * Shared cave-decor frame textures sliced from one atlas sheet.
 * Created once by GameAssets — placement is Lot 15B.
 */
export class CaveDecorTextures {
  private readonly frames: Record<CaveDecorFrameKey, Texture>

  constructor(sheet: Texture) {
    this.frames = {} as Record<CaveDecorFrameKey, Texture>
    for (const key of CAVE_DECOR_FRAME_KEYS) {
      this.frames[key] = slice(sheet, key)
    }
  }

  get(key: CaveDecorFrameKey): Texture {
    return this.frames[key]
  }

  keys(): readonly CaveDecorFrameKey[] {
    return CAVE_DECOR_FRAME_KEYS
  }
}

function slice(sheet: Texture, key: CaveDecorFrameKey): Texture {
  const rect = CAVE_DECOR_FRAME_RECTS[key]
  const frame = new Rectangle(rect.x, rect.y, rect.w, rect.h)
  const texture = new Texture({
    source: sheet.source,
    frame,
  })
  if (texture.source) {
    texture.source.scaleMode = "nearest"
    texture.source.style?.update?.()
  }
  return texture
}
