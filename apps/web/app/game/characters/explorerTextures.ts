import { Rectangle, Texture } from "pixi.js"
import {
  EXPLORER_FRAME_RECTS,
  type ExplorerFrameKey,
} from "./character.config"

type CardinalSheet = "up" | "down" | "left"

/**
 * Shared explorer frame textures sliced from one spritesheet.
 * Created once by GameAssets and reused by every CharacterView.
 */
export class ExplorerTextures {
  private readonly idleMap: Record<CardinalSheet, Texture>
  private readonly walkMap: Record<CardinalSheet, Texture[]>

  constructor(sheet: Texture) {
    this.idleMap = {
      down: slice(sheet, "explorer_idle_down_0"),
      up: slice(sheet, "explorer_idle_up_0"),
      left: slice(sheet, "explorer_idle_left_0"),
    }
    this.walkMap = {
      down: [
        slice(sheet, "explorer_walk_down_0"),
        slice(sheet, "explorer_walk_down_1"),
        slice(sheet, "explorer_walk_down_2"),
      ],
      up: [
        slice(sheet, "explorer_walk_up_0"),
        slice(sheet, "explorer_walk_up_1"),
        slice(sheet, "explorer_walk_up_2"),
      ],
      left: [
        slice(sheet, "explorer_walk_left_0"),
        slice(sheet, "explorer_walk_left_1"),
        slice(sheet, "explorer_walk_left_2"),
      ],
    }
  }

  idle(direction: CardinalSheet): Texture {
    return this.idleMap[direction]
  }

  walk(direction: CardinalSheet, frameIndex: number): Texture {
    const frames = this.walkMap[direction]
    return frames[frameIndex] ?? frames[0]!
  }
}

function slice(sheet: Texture, key: ExplorerFrameKey): Texture {
  const rect = EXPLORER_FRAME_RECTS[key]
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
