import type { MovementButtons } from "@excave/shared"

/**
 * Keyboard movement capture (ZQSD / WASD / arrows).
 * Shape is ready for a future joystick adapter.
 */
export class MovementInput {
  private readonly pressed = new Set<string>()

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
  }

  /** Replace keyboard state (e.g. future virtual stick). */
  setButtons(buttons: MovementButtons): void {
    this.pressed.clear()
    if (buttons.up) this.pressed.add("ArrowUp")
    if (buttons.down) this.pressed.add("ArrowDown")
    if (buttons.left) this.pressed.add("ArrowLeft")
    if (buttons.right) this.pressed.add("ArrowRight")
  }

  read(): MovementButtons {
    return {
      up:
        this.pressed.has("KeyW") ||
        this.pressed.has("KeyZ") ||
        this.pressed.has("ArrowUp"),
      down: this.pressed.has("KeyS") || this.pressed.has("ArrowDown"),
      left:
        this.pressed.has("KeyA") ||
        this.pressed.has("KeyQ") ||
        this.pressed.has("ArrowLeft"),
      right: this.pressed.has("KeyD") || this.pressed.has("ArrowRight"),
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
