import {
  ExcavationSessionStatus,
  type ExcavationNodeId,
  type ExcavationSessionId,
  type PlayerId,
  type WorldId,
  type WorldPosition,
} from "@excave/shared"
import type { PlacedTreasure } from "./ExcavationGenerator.js"

/**
 * Authoritative in-memory excavation session (server-only secrets included).
 */
export interface ExcavationSessionState {
  sessionId: ExcavationSessionId
  nodeId: ExcavationNodeId
  worldId: WorldId
  playerId: PlayerId
  width: number
  height: number
  rock: number[]
  metal: boolean[]
  revealedMetal: boolean[]
  treasures: PlacedTreasure[]
  stability: number
  maxStability: number
  status: (typeof ExcavationSessionStatus)[keyof typeof ExcavationSessionStatus]
  position: WorldPosition
  lastHitAt: number
}
