import type { Graphics } from "pixi.js"
import type { WorldPosition } from "@excave/shared"

/** Warm lamp-adjacent tones — not cool cyan, not neon. */
export const SCAN_PULSE_RING_COLOR = 0xffe1a0
export const SCAN_PULSE_ECHO_COLOR = 0xf2ca7c
export const SCAN_PULSE_FILL_COLOR = 0xe8c078

/** Short satisfying sonar (~550 ms within the 400–700 ms band). */
export const SCAN_PULSE_DURATION_SEC = 0.55

/** Snap ring radii to even world px so the wave reads as pixel art. */
export const SCAN_PULSE_QUANTIZE_PX = 2

interface ActivePulse {
  x: number
  y: number
  rangePx: number
  age: number
  duration: number
}

/**
 * Client-only scan feedback: expanding stepped rings around a fixed origin.
 * Ticked by the existing world frame loop — no per-pulse timers.
 */
export class ScanPulseEffect {
  private readonly pulses: ActivePulse[] = []

  get activeCount(): number {
    return this.pulses.length
  }

  /** Freeze origin at press; wave does not follow the moving player. */
  play(position: WorldPosition, rangePx: number): void {
    this.pulses.push({
      x: position.x,
      y: position.y,
      rangePx,
      age: 0,
      duration: SCAN_PULSE_DURATION_SEC,
    })
  }

  clear(): void {
    this.pulses.length = 0
  }

  /**
   * Advance pulses and redraw onto `layer` (caller owns the Graphics).
   * Clears the layer every frame — empty when no pulses remain.
   */
  tick(dt: number, layer: Graphics): void {
    if (this.pulses.length === 0) {
      layer.clear()
      return
    }

    for (const pulse of this.pulses) {
      pulse.age += dt
    }
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      if ((this.pulses[i]?.age ?? 0) >= (this.pulses[i]?.duration ?? 0)) {
        this.pulses.splice(i, 1)
      }
    }

    layer.clear()
    for (const pulse of this.pulses) {
      drawPulse(layer, pulse)
    }
  }
}

/** Pure helper — leading radius in [0, range] with ease-out. */
export function pulseLeadingRadius(age: number, duration: number, rangePx: number): number {
  const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, age / duration))
  const eased = 1 - (1 - t) * (1 - t)
  return quantizeRadius(rangePx * eased)
}

export function quantizeRadius(radius: number): number {
  const step = SCAN_PULSE_QUANTIZE_PX
  return Math.max(step, Math.round(radius / step) * step)
}

function drawPulse(layer: Graphics, pulse: ActivePulse): void {
  const t = pulse.duration <= 0 ? 1 : Math.min(1, pulse.age / pulse.duration)
  const fade = 1 - t
  const leading = pulseLeadingRadius(pulse.age, pulse.duration, pulse.rangePx)

  // Brief warm spark at the feet — readable even when no vein is found.
  if (t < 0.28) {
    const sparkT = 1 - t / 0.28
    const sparkR = quantizeRadius(6 + 10 * sparkT)
    layer.circle(pulse.x, pulse.y, sparkR)
    layer.fill({
      color: SCAN_PULSE_FILL_COLOR,
      alpha: 0.2 * sparkT,
    })
  }

  // Leading ring (main wave).
  if (leading >= SCAN_PULSE_QUANTIZE_PX) {
    layer.circle(pulse.x, pulse.y, leading)
    layer.stroke({
      width: 2,
      color: SCAN_PULSE_RING_COLOR,
      alpha: 0.88 * fade,
    })
  }

  // Quantized echo trails — stepped, not a smooth gradient wash.
  for (const [backPx, alphaScale, width] of [
    [8, 0.42, 1],
    [16, 0.22, 1],
  ] as const) {
    const echo = leading - backPx
    if (echo < SCAN_PULSE_QUANTIZE_PX * 2) {
      continue
    }
    layer.circle(pulse.x, pulse.y, quantizeRadius(echo))
    layer.stroke({
      width,
      color: SCAN_PULSE_ECHO_COLOR,
      alpha: alphaScale * fade,
    })
  }
}
