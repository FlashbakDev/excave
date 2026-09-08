import { TILE_SIZE, type WorldPosition } from "@excave/shared"

const MIN_INTERPOLATION_DELAY_MS = 100
const MAX_INTERPOLATION_DELAY_MS = 250
const MAX_EXTRAPOLATION_MS = 100
const MAX_SAMPLES = 20
const REMOTE_TELEPORT_PX = TILE_SIZE * 4

interface RemoteSnapshot {
  serverTime: number
  receivedAtMs: number
  position: WorldPosition
  velocity: WorldPosition
}

/** Adaptive interpolation timeline for one remote player. */
export class RemoteSnapshotBuffer {
  private readonly samples: RemoteSnapshot[] = []
  private intervalsMs: number[] = []

  push(sample: RemoteSnapshot): void {
    const previous = this.samples.at(-1)
    if (previous && sample.serverTime <= previous.serverTime) {
      return
    }
    const teleported =
      previous &&
      Math.hypot(
        sample.position.x - previous.position.x,
        sample.position.y - previous.position.y,
      ) > REMOTE_TELEPORT_PX
    if (teleported) {
      this.samples.length = 0
      this.intervalsMs = []
    }
    if (previous && !teleported) {
      this.intervalsMs.push(sample.receivedAtMs - previous.receivedAtMs)
      if (this.intervalsMs.length > 20) {
        this.intervalsMs.shift()
      }
    }
    this.samples.push({ ...sample, position: { ...sample.position } })
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.shift()
    }
  }

  sample(nowMs: number): WorldPosition | null {
    const latest = this.samples.at(-1)
    if (!latest) {
      return null
    }
    const estimatedServerNow =
      latest.serverTime + Math.max(0, nowMs - latest.receivedAtMs)
    const renderTime = estimatedServerNow - this.getInterpolationDelayMs()

    while (
      this.samples.length >= 3 &&
      (this.samples[1]?.serverTime ?? Number.POSITIVE_INFINITY) <= renderTime
    ) {
      this.samples.shift()
    }

    const from = this.samples[0]
    const to = this.samples[1]
    if (from && to && renderTime <= to.serverTime) {
      const span = Math.max(1, to.serverTime - from.serverTime)
      const t = Math.min(1, Math.max(0, (renderTime - from.serverTime) / span))
      return {
        x: from.position.x + (to.position.x - from.position.x) * t,
        y: from.position.y + (to.position.y - from.position.y) * t,
      }
    }

    const extrapolationMs = Math.min(
      MAX_EXTRAPOLATION_MS,
      Math.max(0, renderTime - latest.serverTime),
    )
    return {
      x: latest.position.x + latest.velocity.x * (extrapolationMs / 1000),
      y: latest.position.y + latest.velocity.y * (extrapolationMs / 1000),
    }
  }

  getInterpolationDelayMs(): number {
    if (this.intervalsMs.length === 0) {
      return MIN_INTERPOLATION_DELAY_MS
    }
    const average =
      this.intervalsMs.reduce((sum, interval) => sum + interval, 0) /
      this.intervalsMs.length
    const variance =
      this.intervalsMs.reduce(
        (sum, interval) => sum + (interval - average) ** 2,
        0,
      ) / this.intervalsMs.length
    return Math.min(
      MAX_INTERPOLATION_DELAY_MS,
      Math.max(MIN_INTERPOLATION_DELAY_MS, average + Math.sqrt(variance) * 2),
    )
  }
}
