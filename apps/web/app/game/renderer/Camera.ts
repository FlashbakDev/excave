import { Container } from "pixi.js"
import type { WorldPosition } from "@excave/shared"
import { computeCameraOffset } from "./cameraMath"

/**
 * Camera that offsets a world container so a focus point stays centered.
 * Not coupled to networking — Lot 1 is local only.
 */
export class Camera {
  readonly view = new Container()

  private focusX = 0
  private focusY = 0
  private viewportWidth = 0
  private viewportHeight = 0

  attachWorld(world: Container): void {
    this.view.removeChildren()
    this.view.addChild(world)
    this.apply()
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
    this.apply()
  }

  setFocus(position: WorldPosition): void {
    this.focusX = position.x
    this.focusY = position.y
    this.apply()
  }

  getFocus(): WorldPosition {
    return { x: this.focusX, y: this.focusY }
  }

  private apply(): void {
    const offset = computeCameraOffset(
      this.viewportWidth,
      this.viewportHeight,
      this.focusX,
      this.focusY,
    )
    this.view.position.set(offset.x, offset.y)
  }
}
