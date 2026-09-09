import { ExcavationTool, type ExcavationTool as ExcavationToolId } from "@excave/shared"

export type ImpactTool = "pick" | "hammer"

export type ImpactFxKind =
  | "tap"
  | "chip"
  | "burst"
  | "metal"
  | "treasure"

export interface ImpactFx {
  id: number
  x: number
  y: number
  kind: ImpactFxKind
  tool: ImpactTool
  age: number
  duration: number
}

export interface SpawnDeltaInput {
  x: number
  y: number
  tool: ExcavationToolId
  fromRock: number
  toRock: number
  revealedMetal: boolean
  revealedTreasure: boolean
}

const MAX_ACTIVE = 28

export function toolToImpact(tool: ExcavationToolId): ImpactTool {
  return tool === ExcavationTool.Hammer ? "hammer" : "pick"
}

export function impactDuration(kind: ImpactFxKind, tool: ImpactTool): number {
  switch (kind) {
    case "tap":
      return tool === "hammer" ? 0.14 : 0.1
    case "chip":
      return 0.16
    case "burst":
      return tool === "hammer" ? 0.22 : 0.16
    case "metal":
      return 0.2
    case "treasure":
      return 0.28
    default:
      return 0.16
  }
}

/**
 * Client-only excavation juice. Ticked from one rAF — never per-cell timers.
 */
export class ExcavationImpactFx {
  private readonly effects: ImpactFx[] = []
  private nextId = 1
  /** Remaining shake time (seconds). Mild on purpose for mobile. */
  private shakeLeft = 0
  private shakePower = 0

  get activeCount(): number {
    return this.effects.length
  }

  getActive(): readonly ImpactFx[] {
    return this.effects
  }

  /** 0..1 current shake intensity. */
  getShake(): number {
    if (this.shakeLeft <= 0) {
      return 0
    }
    return Math.min(1, this.shakeLeft / 0.14) * this.shakePower
  }

  /** Mild pixel offset for CSS transform (mobile-safe). */
  getShakeOffset(): { x: number; y: number } {
    const s = this.getShake()
    if (s <= 0) {
      return { x: 0, y: 0 }
    }
    const phase = Math.floor(this.shakeLeft * 36)
    return {
      x: (phase % 2 === 0 ? 1 : -1) * Math.ceil(s * 2),
      y: (phase % 3 === 0 ? 1 : 0) * Math.ceil(s),
    }
  }

  clear(): void {
    this.effects.length = 0
    this.shakeLeft = 0
    this.shakePower = 0
  }

  /** Immediate feedback at tap — before the server answers. */
  spawnTap(x: number, y: number, tool: ExcavationToolId): void {
    const impact = toolToImpact(tool)
    this.push({
      x,
      y,
      kind: "tap",
      tool: impact,
      duration: impactDuration("tap", impact),
    })
    if (impact === "hammer") {
      this.armShake(0.12, 0.55)
    }
  }

  /** Visualize a server-authoritative cell delta. */
  spawnFromDelta(input: SpawnDeltaInput): void {
    const impact = toolToImpact(input.tool)
    if (input.revealedMetal) {
      this.push({
        x: input.x,
        y: input.y,
        kind: "metal",
        tool: impact,
        duration: impactDuration("metal", impact),
      })
    }
    if (input.revealedTreasure) {
      this.push({
        x: input.x,
        y: input.y,
        kind: "treasure",
        tool: impact,
        duration: impactDuration("treasure", impact),
      })
    }
    if (input.fromRock !== input.toRock) {
      const kind: ImpactFxKind =
        impact === "hammer" || input.fromRock - input.toRock >= 2
          ? "burst"
          : "chip"
      this.push({
        x: input.x,
        y: input.y,
        kind,
        tool: impact,
        duration: impactDuration(kind, impact),
      })
      if (impact === "hammer") {
        this.armShake(0.14, 0.7)
      }
    }
  }

  tick(dt: number): void {
    if (dt <= 0) {
      return
    }
    if (this.shakeLeft > 0) {
      this.shakeLeft = Math.max(0, this.shakeLeft - dt)
      if (this.shakeLeft === 0) {
        this.shakePower = 0
      }
    }
    for (const fx of this.effects) {
      fx.age += dt
    }
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const fx = this.effects[i]
      if (!fx || fx.age >= fx.duration) {
        this.effects.splice(i, 1)
      }
    }
  }

  private armShake(seconds: number, power: number): void {
    this.shakeLeft = Math.max(this.shakeLeft, seconds)
    this.shakePower = Math.max(this.shakePower, power)
  }

  private push(
    partial: Omit<ImpactFx, "id" | "age"> & { age?: number },
  ): void {
    while (this.effects.length >= MAX_ACTIVE) {
      this.effects.shift()
    }
    this.effects.push({
      id: this.nextId++,
      age: 0,
      ...partial,
    })
  }
}
