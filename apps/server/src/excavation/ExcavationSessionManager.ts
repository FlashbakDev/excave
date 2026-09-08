import {
  EXCAVATION_HIT_COOLDOWN_MS,
  EXCAVATION_MAX_STABILITY,
  ExcavationSessionStatus,
  ExcavationTool,
  type ExcavationNodeId,
  type ExcavationSessionId,
  type ExcavationStartedPayload,
  type ExcavationTool as ExcavationToolId,
  type ExcavationUpdatePayload,
  type PlayerId,
  type RecoveredTreasurePublic,
} from "@excave/shared"
import { randomUUID } from "node:crypto"
import type { ExcavationNode } from "./generateNodes.js"
import { nodeWorldPosition } from "./generateNodes.js"
import { generateExcavation } from "./ExcavationGenerator.js"
import { resolveHit } from "./ExcavationHitResolver.js"
import type { ExcavationSessionState } from "./ExcavationSession.js"
import { getTreasureDefinition } from "./TreasureCatalog.js"

/**
 * Authoritative excavation sessions (Lot 8).
 * Treasure positions / metal map never leave this module via public payloads.
 */
export class ExcavationSessionManager {
  private readonly bySessionId = new Map<ExcavationSessionId, ExcavationSessionState>()
  private readonly byPlayerId = new Map<PlayerId, ExcavationSessionId>()
  private readonly byNodeId = new Map<ExcavationNodeId, ExcavationSessionId>()

  create(node: ExcavationNode, playerId: PlayerId): ExcavationStartedPayload {
    const existingId = this.byNodeId.get(node.id)
    if (existingId) {
      const existing = this.bySessionId.get(existingId)
      if (existing && existing.playerId === playerId) {
        return toStartedPayload(existing)
      }
    }

    const generated = generateExcavation(node.seed)
    const sessionId = randomUUID() as ExcavationSessionId
    const session: ExcavationSessionState = {
      sessionId,
      nodeId: node.id,
      worldId: node.worldId,
      playerId,
      width: generated.width,
      height: generated.height,
      rock: generated.rock,
      metal: generated.metal,
      revealedMetal: new Array(generated.width * generated.height).fill(false),
      treasures: generated.treasures,
      stability: EXCAVATION_MAX_STABILITY,
      maxStability: EXCAVATION_MAX_STABILITY,
      status: ExcavationSessionStatus.Active,
      position: nodeWorldPosition(node),
      lastHitAt: 0,
    }

    this.bySessionId.set(sessionId, session)
    this.byPlayerId.set(playerId, sessionId)
    this.byNodeId.set(node.id, sessionId)
    return toStartedPayload(session)
  }

  get(sessionId: ExcavationSessionId): ExcavationSessionState | undefined {
    return this.bySessionId.get(sessionId)
  }

  /** Test/debug helper — never expose over the network. */
  getSecretsForTests(sessionId: ExcavationSessionId) {
    return this.bySessionId.get(sessionId)
  }

  hit(
    playerId: PlayerId,
    sessionId: ExcavationSessionId,
    x: number,
    y: number,
    tool: ExcavationToolId,
    now = Date.now(),
  ): ExcavationUpdatePayload | { error: string } {
    const session = this.bySessionId.get(sessionId)
    if (!session) {
      return { error: "not_found" }
    }
    if (session.playerId !== playerId) {
      return { error: "not_owner" }
    }
    if (session.status !== ExcavationSessionStatus.Active) {
      return { error: "inactive" }
    }
    if (session.stability <= 0) {
      return { error: "inactive" }
    }
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return { error: "bad_coords" }
    }
    if (x < 0 || y < 0 || x >= session.width || y >= session.height) {
      return { error: "bad_coords" }
    }
    if (tool !== ExcavationTool.Pickaxe && tool !== ExcavationTool.Hammer) {
      return { error: "bad_tool" }
    }
    if (now - session.lastHitAt < EXCAVATION_HIT_COOLDOWN_MS) {
      return { error: "cooldown" }
    }

    session.lastHitAt = now
    const resolution = resolveHit(session, x, y, tool)
    session.stability = Math.max(0, session.stability - resolution.stabilityDelta)

    let message: string | undefined
    if (resolution.newlyRecovered.length > 0) {
      message = resolution.newlyRecovered
        .map((t) => `${t.name} récupéré !`)
        .join(" ")
    }

    const allRecovered = session.treasures.every((t) => t.recovered)
    if (session.stability <= 0) {
      session.status = ExcavationSessionStatus.Collapsed
      message = message
        ? `${message} La galerie s'effondre !`
        : "La galerie s'effondre !"
    } else if (session.treasures.length > 0 && allRecovered) {
      session.status = ExcavationSessionStatus.Completed
      message = message
        ? `${message} Tous les trésors sont récupérés.`
        : "Tous les trésors sont récupérés."
    }

    const update: ExcavationUpdatePayload = {
      sessionId: session.sessionId,
      changedCells: resolution.changedCells,
      stability: session.stability,
      status: session.status,
      newlyRecoveredTreasures: resolution.newlyRecovered,
      recoveredTreasures: listRecovered(session),
    }
    if (message !== undefined) {
      update.message = message
    }
    return update
  }

  releasePlayer(playerId: PlayerId): ExcavationNodeId[] {
    const sessionId = this.byPlayerId.get(playerId)
    if (!sessionId) {
      return []
    }
    const session = this.bySessionId.get(sessionId)
    this.removeSession(sessionId)
    return session ? [session.nodeId] : []
  }

  finishSession(sessionId: ExcavationSessionId): ExcavationNodeId | null {
    const session = this.bySessionId.get(sessionId)
    if (!session) {
      return null
    }
    const nodeId = session.nodeId
    this.removeSession(sessionId)
    return nodeId
  }

  private removeSession(sessionId: ExcavationSessionId): void {
    const session = this.bySessionId.get(sessionId)
    if (!session) {
      return
    }
    this.bySessionId.delete(sessionId)
    this.byPlayerId.delete(session.playerId)
    this.byNodeId.delete(session.nodeId)
  }
}

function listRecovered(session: ExcavationSessionState): RecoveredTreasurePublic[] {
  return session.treasures
    .filter((t) => t.recovered)
    .map((t) => {
      const def = getTreasureDefinition(t.type)
      return { type: def.type, rarity: def.rarity, name: def.name }
    })
}

function toStartedPayload(session: ExcavationSessionState): ExcavationStartedPayload {
  return {
    sessionId: session.sessionId,
    nodeId: session.nodeId,
    worldId: session.worldId,
    position: session.position,
    activePlayerId: session.playerId,
    width: session.width,
    height: session.height,
    cells: [...session.rock],
    revealedMetal: [...session.revealedMetal],
    stability: session.stability,
    maxStability: session.maxStability,
    status: session.status,
    treasureCount: session.treasures.length,
    recoveredTreasures: listRecovered(session),
  }
}
