import type { PlayerId, WorldId, WorldPosition } from "../ids.js"
import type {
  RecoveredTreasurePublic,
  TreasureRarity,
  TreasureType,
} from "./treasurePayloads.js"

/** Public visual states only — never includes treasure contents. */
export const NodeVisualState = {
  Detected: "detected",
  Busy: "busy",
  Depleted: "depleted",
} as const

export type NodeVisualState =
  (typeof NodeVisualState)[keyof typeof NodeVisualState]

export type ExcavationNodeId = string
export type ExcavationSessionId = string

export const ExcavationTool = {
  Pickaxe: "PICKAXE",
  Hammer: "HAMMER",
} as const

export type ExcavationTool =
  (typeof ExcavationTool)[keyof typeof ExcavationTool]

export const ExcavationSessionStatus = {
  Active: "ACTIVE",
  Collapsed: "COLLAPSED",
  Completed: "COMPLETED",
} as const

export type ExcavationSessionStatus =
  (typeof ExcavationSessionStatus)[keyof typeof ExcavationSessionStatus]

/** Client → server SCAN action (no payload fields required). */
export interface PlayerScanPayload {
  /** Optional client timestamp for debugging. */
  clientTime?: number
}

/** Server → client: SCAN executed (shows radius feedback). */
export interface PlayerScannedPayload {
  position: WorldPosition
  rangePx: number
  /** True when a node was revealed by this scan. */
  detected: boolean
}

/** Server → client: SCAN refused. */
export interface PlayerScanRejectedPayload {
  reason: "cooldown"
  remainingMs: number
}

/** Server → client: a nearby node was revealed by SCAN. */
export interface NodeDetectedPayload {
  nodeId: ExcavationNodeId
  worldId: WorldId
  position: WorldPosition
  visualState: NodeVisualState
  message: string
}

/** Client → server: attempt to begin excavation on a detected node. */
export interface ExcavationStartPayload {
  nodeId: ExcavationNodeId
}

/**
 * One visible cell in the excavation grid.
 * Never includes hidden treasure identity or unrevealed metal.
 */
export interface ExcavationCellPublic {
  x: number
  y: number
  /** Remaining rock layers the client is allowed to see (0–4). */
  remainingRock: number
  /** Present only once the server has revealed a metal obstacle here. */
  isMetal?: boolean
}

/** Server → client: excavation session granted + visible grid. */
export interface ExcavationStartedPayload {
  sessionId: ExcavationSessionId
  nodeId: ExcavationNodeId
  worldId: WorldId
  position: WorldPosition
  activePlayerId: PlayerId
  width: number
  height: number
  /** Row-major remainingRock values (length = width * height). */
  cells: number[]
  /** Parallel flags for already-revealed metal (usually all false at start). */
  revealedMetal: boolean[]
  stability: number
  maxStability: number
  status: ExcavationSessionStatus
  treasureCount: number
  recoveredTreasures: RecoveredTreasurePublic[]
}

/** Client → server: dig at a cell with a tool. */
export interface ExcavationHitPayload {
  sessionId: ExcavationSessionId
  x: number
  y: number
  tool: ExcavationTool
}

/** Server → client: visible deltas after a hit (no hidden treasures). */
export interface ExcavationUpdatePayload {
  sessionId: ExcavationSessionId
  changedCells: ExcavationCellPublic[]
  stability: number
  status: ExcavationSessionStatus
  newlyRecoveredTreasures: RecoveredTreasurePublic[]
  recoveredTreasures: RecoveredTreasurePublic[]
  message?: string
}

/** Server → client: excavation could not start. */
export interface ExcavationRejectedPayload {
  nodeId: ExcavationNodeId
  reason: "not_found" | "not_available" | "out_of_range" | "busy" | "depleted"
}

/** Server → client: public visual update for a known node. */
export interface NodeUpdatedPayload {
  nodeId: ExcavationNodeId
  visualState: NodeVisualState
  activePlayerId?: PlayerId | null
}

export type { RecoveredTreasurePublic, TreasureRarity, TreasureType }
