import { Container, Graphics, Rectangle } from "pixi.js"
import { NodeVisualState, type NodeVisualState as NodeVisual } from "@excave/shared"

/** Client presentation for a detected excavation node (Lots 16B–16C). */
export type NodePresentation = "far" | "near" | "busy" | "depleted"

const ROCK_CRACK = 0x25251f
const ROCK_EDGE = 0x343127
const MINERAL = 0xf0c14a
const MINERAL_HOT = 0xffe1a0
const BUSY = 0xe07030
const DEPLETED = 0x5a5348

/** Minimum on-screen tap target (CSS px) — mobile-first. */
export const NODE_TAP_TARGET_CSS_PX = 48

/** Ignore repeated taps while the server may still answer. */
export const NODE_EXAMINE_DEBOUNCE_MS = 480

export function resolveNodePresentation(
  visualState: NodeVisual,
  inRange: boolean,
): NodePresentation {
  if (visualState === NodeVisualState.Busy) {
    return "busy"
  }
  if (visualState === NodeVisualState.Depleted) {
    return "depleted"
  }
  return inRange ? "near" : "far"
}

/** World-space half-extent so the hit box ≈ `NODE_TAP_TARGET_CSS_PX` on screen. */
export function hitHalfForZoom(zoom: number): number {
  const z = Math.max(1, zoom)
  return Math.max(14, Math.ceil(NODE_TAP_TARGET_CSS_PX / (2 * z)))
}

export function shouldAcceptExamineTap(
  nowMs: number,
  lastExamineAtMs: number,
  debounceMs = NODE_EXAMINE_DEBOUNCE_MS,
): boolean {
  return nowMs - lastExamineAtMs >= debounceMs
}

/**
 * Wall-integrated vein signal — crack + mineral flecks.
 * Near + in range: larger invisible hit area; tap/click requests excavation.
 */
export class ExcavationNodeView {
  readonly root = new Container()

  private readonly body = new Graphics()
  private visualState: NodeVisual = NodeVisualState.Detected
  private inRange = false
  private phase = 0
  private lastSpark = -1
  private examineHandler: (() => void) | null = null
  private tapZoom = 1
  private lastExamineAtMs = -NODE_EXAMINE_DEBOUNCE_MS
  /** 1 → 0 after tap (press highlight). */
  private tapFlash = 0
  /** 1 → 0 after first reveal from scan. */
  private revealFlash = 0
  private pressed = false

  constructor() {
    this.root.addChild(this.body)
    this.root.on("pointertap", this.onPointerTap)
    this.root.on("pointerdown", this.onPointerDown)
    this.root.on("pointerup", this.onPointerUp)
    this.root.on("pointerupoutside", this.onPointerUp)
    this.root.on("pointercancel", this.onPointerUp)
    this.applyHitArea()
    this.syncInteraction()
    this.redraw()
  }

  getVisualState(): NodeVisual {
    return this.visualState
  }

  setWorldPosition(x: number, y: number): void {
    this.root.position.set(x, y)
  }

  setExamineHandler(handler: (() => void) | null): void {
    this.examineHandler = handler
  }

  /** Keep the on-screen tap target ~48 CSS px across zoom 1/2/3. */
  setTapZoom(zoom: number): void {
    if (this.tapZoom === zoom) {
      return
    }
    this.tapZoom = zoom
    this.applyHitArea()
  }

  /** Short pop when the scan first reveals this vein. */
  playReveal(): void {
    this.revealFlash = 1
    this.redraw()
  }

  setVisualState(visualState: NodeVisual): void {
    if (this.visualState === visualState) {
      return
    }
    this.visualState = visualState
    if (visualState !== NodeVisualState.Detected) {
      this.pressed = false
      this.root.scale.set(1)
    }
    this.syncInteraction()
    this.redraw()
  }

  setInRange(inRange: boolean): void {
    if (this.inRange === inRange) {
      return
    }
    this.inRange = inRange
    if (!inRange) {
      this.pressed = false
      this.root.scale.set(1)
    }
    this.syncInteraction()
    this.redraw()
  }

  update(dt: number): void {
    this.phase += dt
    let dirty = false

    if (this.tapFlash > 0) {
      this.tapFlash = Math.max(0, this.tapFlash - dt / 0.18)
      dirty = true
    }
    if (this.revealFlash > 0) {
      this.revealFlash = Math.max(0, this.revealFlash - dt / 0.45)
      dirty = true
    }

    const spark = Math.floor(this.phase * 2.2) % 3
    if (spark !== this.lastSpark) {
      this.lastSpark = spark
      dirty = true
    }

    if (dirty) {
      this.redraw()
    }
  }

  destroy(): void {
    this.root.off("pointertap", this.onPointerTap)
    this.root.off("pointerdown", this.onPointerDown)
    this.root.off("pointerup", this.onPointerUp)
    this.root.off("pointerupoutside", this.onPointerUp)
    this.root.off("pointercancel", this.onPointerUp)
    this.examineHandler = null
    this.root.destroy({ children: true })
  }

  private readonly onPointerDown = (): void => {
    if (!this.canExamine()) {
      return
    }
    this.pressed = true
    this.root.scale.set(0.92)
    this.tapFlash = Math.max(this.tapFlash, 0.55)
    this.redraw()
  }

  private readonly onPointerUp = (): void => {
    if (!this.pressed) {
      return
    }
    this.pressed = false
    this.root.scale.set(1)
  }

  private readonly onPointerTap = (): void => {
    if (!this.canExamine()) {
      return
    }
    const now = performance.now()
    if (!shouldAcceptExamineTap(now, this.lastExamineAtMs)) {
      return
    }
    this.lastExamineAtMs = now
    this.tapFlash = 1
    this.pressed = false
    this.root.scale.set(1)
    this.redraw()
    this.examineHandler?.()
  }

  private canExamine(): boolean {
    return this.inRange && this.visualState === NodeVisualState.Detected
  }

  private applyHitArea(): void {
    const half = hitHalfForZoom(this.tapZoom)
    this.root.hitArea = new Rectangle(-half, -half, half * 2, half * 2)
  }

  private syncInteraction(): void {
    const clickable = this.canExamine()
    this.root.eventMode = clickable ? "static" : "none"
    this.root.cursor = clickable ? "pointer" : "default"
  }

  private redraw(): void {
    const presentation = resolveNodePresentation(this.visualState, this.inRange)
    this.body.clear()
    drawVeinSignal(
      this.body,
      presentation,
      this.phase,
      this.lastSpark,
      this.tapFlash,
      this.revealFlash,
    )
  }
}

function drawVeinSignal(
  g: Graphics,
  presentation: NodePresentation,
  phase: number,
  spark: number,
  tapFlash: number,
  revealFlash: number,
): void {
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(phase * 3.1))
  const juice = Math.max(tapFlash, revealFlash * 0.85)

  // Fixed crack into the wall face (integer offsets → pixel feel).
  const crack: Array<[number, number, number, number]> = [
    [-6, -1, 4, 2],
    [-2, 0, 5, 2],
    [3, 1, 4, 2],
    [-4, 2, 2, 3],
    [1, -3, 2, 3],
    [5, -2, 2, 2],
  ]
  const crackColor =
    presentation === "depleted"
      ? DEPLETED
      : presentation === "busy"
        ? ROCK_EDGE
        : ROCK_CRACK
  const crackAlpha =
    presentation === "far"
      ? 0.85
      : presentation === "depleted"
        ? 0.55
        : 0.95 + 0.05 * juice

  for (const [x, y, w, h] of crack) {
    g.rect(x, y, w, h)
    g.fill({ color: crackColor, alpha: crackAlpha })
  }

  if (presentation === "depleted") {
    g.rect(-1, 0, 2, 2)
    g.fill({ color: DEPLETED, alpha: 0.7 })
    return
  }

  const mineral =
    presentation === "busy" ? BUSY : presentation === "near" ? MINERAL_HOT : MINERAL
  const flecksFar: Array<[number, number]> = [
    [-3, -1],
    [2, 1],
    [4, -2],
  ]
  const flecksNear: Array<[number, number]> = [
    [-3, -1],
    [2, 1],
    [4, -2],
    [-1, 2],
    [0, -3],
    [6, 0],
    [-5, 1],
    [3, -4],
  ]
  const flecks = presentation === "far" ? flecksFar : flecksNear
  let baseAlpha =
    presentation === "far" ? 0.55 : presentation === "busy" ? 0.75 : 0.72 + 0.28 * pulse
  baseAlpha = Math.min(1, baseAlpha + juice * 0.35)

  flecks.forEach(([x, y], index) => {
    const lit = presentation === "far" ? index === spark % flecks.length : true
    const alpha = lit ? baseAlpha : baseAlpha * 0.35
    g.rect(x, y, 2, 2)
    g.fill({ color: mineral, alpha })
  })

  if (presentation === "near" || presentation === "busy") {
    // Soft center glint — readable at a glance without looking like a HUD chip.
    g.rect(0, 0, 2, 2)
    g.fill({
      color: presentation === "busy" ? BUSY : MINERAL_HOT,
      alpha: Math.min(1, 0.4 + 0.45 * pulse + juice * 0.4),
    })
    if (presentation === "near" && juice > 0.05) {
      g.rect(-2, -2, 2, 2)
      g.rect(2, 2, 2, 2)
      g.fill({ color: MINERAL_HOT, alpha: 0.35 * juice })
    }
  }

  // Scan-reveal flash: brief mineral dust so detection feels tied to the pulse.
  if (revealFlash > 0.15 && presentation !== "busy") {
    const dust: Array<[number, number]> = [
      [-8, 0],
      [8, -1],
      [0, -6],
      [1, 5],
    ]
    for (const [x, y] of dust) {
      g.rect(x, y, 2, 2)
      g.fill({ color: MINERAL, alpha: 0.4 * revealFlash })
    }
  }
}
