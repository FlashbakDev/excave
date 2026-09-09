import type { MovementButtons } from "@excave/shared"
import { IDLE_MOVEMENT } from "./virtualJoystick"

/**
 * Keyboard + virtual stick movement capture (ZQSD / WASD / arrows / mobile joystick).
 */
export class MovementInput {
  private readonly pressed = new Set<string>()
  private virtual: MovementButtons = { ...IDLE_MOVEMENT }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code)
  }

  attach(target: Window = window): void {
    target.addEventListener("keydown", this.onKeyDown)
    target.addEventListener("keyup", this.onKeyUp)
  }

  detach(target: Window = window): void {
    target.removeEventListener("keydown", this.onKeyDown)
    target.removeEventListener("keyup", this.onKeyUp)
    this.pressed.clear()
    this.virtual = { ...IDLE_MOVEMENT }
  }

  /** Overlay from the mobile joystick (merged with keyboard on read). */
  setVirtualButtons(buttons: MovementButtons): void {
    this.virtual = { ...buttons }
  }

  clearVirtualButtons(): void {
    this.virtual = { ...IDLE_MOVEMENT }
  }

  read(): MovementButtons {
    return {
      up:
        this.pressed.has("KeyW") ||
        this.pressed.has("KeyZ") ||
        this.pressed.has("ArrowUp") ||
        this.virtual.up,
      down:
        this.pressed.has("KeyS") ||
        this.pressed.has("ArrowDown") ||
        this.virtual.down,
      left:
        this.pressed.has("KeyA") ||
        this.pressed.has("KeyQ") ||
        this.pressed.has("ArrowLeft") ||
        this.virtual.left,
      right:
        this.pressed.has("KeyD") ||
        this.pressed.has("ArrowRight") ||
        this.virtual.right,
    }
  }

  isEqual(a: MovementButtons, b: MovementButtons): boolean {
    return (
      a.up === b.up &&
      a.down === b.down &&
      a.left === b.left &&
      a.right === b.right
    )
  }
}
