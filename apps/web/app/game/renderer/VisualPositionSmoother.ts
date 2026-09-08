import type { WorldPosition } from "@excave/shared"

const MAX_SMOOTHED_CORRECTION_PX = 6
const CORRECTION_HALF_LIFE_MS = 35
const OFFSET_EPSILON_PX = 0.05

/** Visual-only error decay; authoritative/predicted simulation is never lerped. */
export class VisualPositionSmoother {
  private offset: WorldPosition = { x: 0, y: 0 }

  reset(): void {
    this.offset = { x: 0, y: 0 }
  }

  preserveVisualPosition(
    previousVisual: WorldPosition,
    correctedSimulation: WorldPosition,
  ): void {
    const offset = {
      x: previousVisual.x - correctedSimulation.x,
      y: previousVisual.y - correctedSimulation.y,
    }
    if (Math.hypot(offset.x, offset.y) > MAX_SMOOTHED_CORRECTION_PX) {
      this.reset()
      return
    }
    this.offset = offset
  }

  resolve(simulation: WorldPosition, elapsedMs: number): WorldPosition {
    const decay = Math.pow(0.5, Math.max(0, elapsedMs) / CORRECTION_HALF_LIFE_MS)
    this.offset.x *= decay
    this.offset.y *= decay
    if (Math.hypot(this.offset.x, this.offset.y) < OFFSET_EPSILON_PX) {
      this.reset()
    }
    return {
      x: simulation.x + this.offset.x,
      y: simulation.y + this.offset.y,
    }
  }

  getErrorPx(): number {
    return Math.hypot(this.offset.x, this.offset.y)
  }
}
