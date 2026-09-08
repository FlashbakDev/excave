/**
 * Edge-triggered interaction keys (SCAN / excavate).
 * Desktop: E or Space.
 */
export class InteractionInput {
  private readonly pressed = new Set<string>()
  private readonly prevDown = new Set<string>()

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "KeyE" || event.code === "Space") {
      event.preventDefault()
      this.pressed.add(event.code)
    }
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
    this.prevDown.clear()
  }

  /** True once when E or Space transitions to down. */
  consumeInteractPressed(): boolean {
    const down =
      this.pressed.has("KeyE") || this.pressed.has("Space")
    const wasDown =
      this.prevDown.has("KeyE") || this.prevDown.has("Space")

    this.prevDown.clear()
    for (const code of this.pressed) {
      this.prevDown.add(code)
    }

    return down && !wasDown
  }
}
