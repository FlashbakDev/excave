import {
  MOVEMENT_COMMAND_HZ,
  MOVEMENT_MAX_PENDING_COMMANDS,
  MOVEMENT_MAX_SERVER_QUEUE,
  replayMovementCommands,
  stepMovement,
  type MovementButtons,
  type PlayerInputPayload,
  type PlayerStateEntry,
  type WalkabilityFn,
  type WorldPosition,
} from "@excave/shared"

const COMMAND_STEP_MS = 1000 / MOVEMENT_COMMAND_HZ
const COMMAND_STEP_SECONDS = 1 / MOVEMENT_COMMAND_HZ
const MAX_FRAME_CATCH_UP_MS = 250

export interface LocalReconcileResult {
  accepted: boolean
  position: WorldPosition
  correctionPx: number
  pendingCount: number
}

/**
 * Deterministic local movement timeline.
 * The exact commands generated here are applied by the server and replayed
 * after each authoritative acknowledgement.
 */
export class LocalMovementController {
  private movementEpoch = ""
  private nextSequence = 1
  private lastSentSequence = 0
  private lastAcknowledgedSequence = 0
  private lastAcknowledgedServerTick = 0
  private accumulatorMs = 0
  private position: WorldPosition = { x: 0, y: 0 }
  private readonly pending: PlayerInputPayload["commands"] = []

  reset(
    movementEpoch: string,
    lastProcessedSequence: number,
    position: WorldPosition,
  ): void {
    this.movementEpoch = movementEpoch
    this.nextSequence = Math.max(1, lastProcessedSequence + 1)
    this.lastSentSequence = lastProcessedSequence
    this.lastAcknowledgedSequence = lastProcessedSequence
    this.lastAcknowledgedServerTick = 0
    this.accumulatorMs = 0
    this.position = { ...position }
    this.pending.length = 0
  }

  simulate(
    elapsedMs: number,
    buttons: MovementButtons,
    isWalkable: WalkabilityFn,
  ): WorldPosition {
    this.accumulatorMs = Math.min(
      MAX_FRAME_CATCH_UP_MS,
      this.accumulatorMs + Math.max(0, elapsedMs),
    )
    while (
      this.accumulatorMs + 1e-7 >= COMMAND_STEP_MS &&
      this.pending.length < MOVEMENT_MAX_PENDING_COMMANDS
    ) {
      this.accumulatorMs = Math.max(0, this.accumulatorMs - COMMAND_STEP_MS)
      this.queueImmediate(buttons, isWalkable)
    }
    return { ...this.position }
  }

  queueImmediate(
    buttons: MovementButtons,
    isWalkable: WalkabilityFn,
  ): WorldPosition {
    if (this.pending.length >= MOVEMENT_MAX_PENDING_COMMANDS) {
      return { ...this.position }
    }
    const command = {
      ...buttons,
      sequence: this.nextSequence,
    }
    this.nextSequence += 1
    this.position = stepMovement(
      this.position,
      command,
      COMMAND_STEP_SECONDS,
      isWalkable,
    ).position
    this.pending.push(command)
    return { ...this.position }
  }

  /**
   * Returns new commands plus a short acknowledged-overlap window. Socket.IO
   * is ordered/reliable, while this redundancy also makes duplicate delivery
   * and reconnect races harmless.
   */
  takeBatch(forceRetransmit = false): PlayerInputPayload | null {
    if (!this.movementEpoch) {
      return null
    }
    const firstNew = this.pending.findIndex(
      (command) => command.sequence > this.lastSentSequence,
    )
    if (firstNew < 0 && (!forceRetransmit || this.pending.length === 0)) {
      return null
    }
    // Always start at the oldest unacknowledged command. This guarantees that
    // a queue-window rejection can heal without creating another sequence gap.
    const commands = this.pending
      .slice(0, MOVEMENT_MAX_SERVER_QUEUE)
      .map((command) => ({ ...command }))
    this.lastSentSequence = commands.at(-1)?.sequence ?? this.lastSentSequence
    return {
      movementEpoch: this.movementEpoch,
      commands,
    }
  }

  reconcile(
    authoritative: PlayerStateEntry,
    isWalkable: WalkabilityFn,
  ): LocalReconcileResult {
    if (
      authoritative.movementEpoch !== this.movementEpoch ||
      authoritative.lastProcessedSequence < this.lastAcknowledgedSequence ||
      authoritative.lastProcessedTick < this.lastAcknowledgedServerTick
    ) {
      return {
        accepted: false,
        position: { ...this.position },
        correctionPx: 0,
        pendingCount: this.pending.length,
      }
    }

    const before = this.position
    let removeCount = 0
    while (
      removeCount < this.pending.length &&
      (this.pending[removeCount]?.sequence ?? Number.POSITIVE_INFINITY) <=
        authoritative.lastProcessedSequence
    ) {
      removeCount += 1
    }
    if (removeCount > 0) {
      this.pending.splice(0, removeCount)
    }
    this.lastAcknowledgedSequence = authoritative.lastProcessedSequence
    this.lastAcknowledgedServerTick = authoritative.lastProcessedTick
    this.nextSequence = Math.max(
      this.nextSequence,
      authoritative.lastProcessedSequence + 1,
    )
    this.lastSentSequence = Math.max(
      this.lastSentSequence,
      authoritative.lastProcessedSequence,
    )

    this.position = { x: authoritative.x, y: authoritative.y }
    this.position = replayMovementCommands(
      this.position,
      this.pending,
      isWalkable,
    )

    return {
      accepted: true,
      position: { ...this.position },
      correctionPx: Math.hypot(
        before.x - this.position.x,
        before.y - this.position.y,
      ),
      pendingCount: this.pending.length,
    }
  }

  getPosition(): WorldPosition {
    return { ...this.position }
  }

  getPendingCount(): number {
    return this.pending.length
  }

  getLastAcknowledgedSequence(): number {
    return this.lastAcknowledgedSequence
  }
}
