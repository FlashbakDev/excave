import { Container } from "pixi.js"
import type { WorldPosition } from "@excave/shared"
import {
  DEFAULT_CAMERA_ZOOM,
  isCameraZoomLevel,
  type CameraZoomLevel,
} from "../assets/pixelScale"
import { computeCameraOffset } from "./cameraMath"

/**
 * Camera that offsets a world container so a focus point stays centered.
 * Zoom is restricted to integer levels (1× / 2× / 3×) for pixel-perfect art.
 */
export class Camera {
  readonly view = new Container()

  private focusX = 0
  private focusY = 0
  private viewportWidth = 0
  private viewportHeight = 0
  private zoom: CameraZoomLevel = DEFAULT_CAMERA_ZOOM
  private offsetX = 0
  private offsetY = 0

  constructor() {
    // Keep Pixi scale in sync with DEFAULT_CAMERA_ZOOM (field alone is not enough).
    this.view.scale.set(this.zoom)
  }

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

  setZoom(zoom: number): void {
    if (!isCameraZoomLevel(zoom)) {
      return
    }
    this.zoom = zoom
    this.view.scale.set(zoom)
    this.apply()
  }

  getZoom(): CameraZoomLevel {
    return this.zoom
  }

  getFocus(): WorldPosition {
    return { x: this.focusX, y: this.focusY }
  }

  getViewport(): { width: number; height: number } {
    return { width: this.viewportWidth, height: this.viewportHeight }
  }

  /** Pixel-snapped stage offset used for lighting projection. */
  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY }
  }

  private apply(): void {
    const offset = computeCameraOffset(
      this.viewportWidth,
      this.viewportHeight,
      this.focusX,
      this.focusY,
      this.zoom,
    )
    this.offsetX = offset.x
    this.offsetY = offset.y
    this.view.position.set(offset.x, offset.y)
  }
}
