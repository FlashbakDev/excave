import {
  EXCAVATION_RANGE_PX,
  SCAN_RANGE_PX,
  chunksInRadius,
  type ChunkCoordinate,
  type ExcavationNodeId,
  type ExcavationRejectedPayload,
  type NodeDetectedPayload,
  type NodeUpdatedPayload,
  type PlayerId,
  type WorldId,
  type WorldPosition,
} from "@excave/shared"
import type { WorldManager } from "../world/WorldManager.js"
import {
  generateNodesForChunk,
  nodeVisualState,
  nodeWorldPosition,
  type ExcavationNode,
} from "./generateNodes.js"

const DETECTED_MESSAGE = "Quelque chose semble être enfoui ici"

export type StartResult =
  | { ok: true; node: ExcavationNode }
  | { ok: false; reason: ExcavationRejectedPayload["reason"]; nodeId: ExcavationNodeId }

/**
 * Server-authoritative excavation nodes (filons).
 * Treasure contents stay server-only (Lot 8).
 */
export class ExcavationNodeManager {
  private readonly byId = new Map<ExcavationNodeId, ExcavationNode>()
  private readonly byChunk = new Map<string, ExcavationNodeId[]>()
  private readonly generatedChunks = new Set<string>()
  private readonly detectedByPlayer = new Map<PlayerId, Set<ExcavationNodeId>>()
  private readonly depletedIds = new Set<ExcavationNodeId>()

  constructor(private readonly world: WorldManager) {}

  /** Apply persisted DEPLETED node ids (Lot 9 restart). */
  hydrateDepleted(nodeIds: Iterable<string>): void {
    for (const id of nodeIds) {
      this.depletedIds.add(id as ExcavationNodeId)
      const existing = this.byId.get(id as ExcavationNodeId)
      if (existing) {
        existing.status = "DEPLETED"
        existing.activePlayerId = null
      }
    }
  }

  ensureChunk(chunk: ChunkCoordinate): ExcavationNode[] {
    const key = chunkKey(chunk)
    if (this.generatedChunks.has(key)) {
      return this.nodesInChunk(chunk)
    }

    const nodes = generateNodesForChunk(
      this.world.numericSeed,
      this.world.id,
      chunk,
    )
    this.generatedChunks.add(key)
    const ids: ExcavationNodeId[] = []
    for (const node of nodes) {
      if (this.depletedIds.has(node.id)) {
        node.status = "DEPLETED"
        node.activePlayerId = null
      }
      this.byId.set(node.id, node)
      ids.push(node.id)
    }
    this.byChunk.set(key, ids)
    return nodes
  }

  ensureNeighborhood(center: ChunkCoordinate, radius: number): void {
    for (const chunk of chunksInRadius(center, radius)) {
      this.ensureChunk(chunk)
    }
  }

  get(nodeId: ExcavationNodeId): ExcavationNode | undefined {
    return this.byId.get(nodeId)
  }

  nodesInChunk(chunk: ChunkCoordinate): ExcavationNode[] {
    const ids = this.byChunk.get(chunkKey(chunk)) ?? []
    return ids
      .map((id) => this.byId.get(id))
      .filter((node): node is ExcavationNode => Boolean(node))
  }

  scan(
    playerId: PlayerId,
    position: WorldPosition,
  ): NodeDetectedPayload | null {
    const center = this.world.worldPositionToChunk(position)
    this.ensureNeighborhood(center, 1)

    let best: ExcavationNode | null = null
    let bestDist = Number.POSITIVE_INFINITY

    for (const chunk of chunksInRadius(center, 1)) {
      for (const node of this.nodesInChunk(chunk)) {
        if (node.status === "DEPLETED") {
          continue
        }
        const nodePos = nodeWorldPosition(node)
        const dist = distance(position, nodePos)
        if (dist <= SCAN_RANGE_PX && dist < bestDist) {
          best = node
          bestDist = dist
        }
      }
    }

    if (!best) {
      return null
    }

    this.markDetected(playerId, best.id)

    return {
      nodeId: best.id,
      worldId: best.worldId as WorldId,
      position: nodeWorldPosition(best),
      visualState: nodeVisualState(best),
      message: DETECTED_MESSAGE,
    }
  }

  tryStart(playerId: PlayerId, nodeId: ExcavationNodeId, position: WorldPosition): StartResult {
    const node = this.byId.get(nodeId)
    if (!node) {
      return { ok: false, reason: "not_found", nodeId }
    }

    const dist = distance(position, nodeWorldPosition(node))
    if (dist > EXCAVATION_RANGE_PX) {
      return { ok: false, reason: "out_of_range", nodeId }
    }

    if (node.status === "DEPLETED") {
      return { ok: false, reason: "depleted", nodeId }
    }

    if (node.status === "IN_PROGRESS") {
      if (node.activePlayerId === playerId) {
        return { ok: true, node }
      }
      return { ok: false, reason: "busy", nodeId }
    }

    // AVAILABLE
    const detected = this.detectedByPlayer.get(playerId)
    if (!detected?.has(nodeId)) {
      // Require prior scan detection for this player.
      return { ok: false, reason: "not_available", nodeId }
    }

    node.status = "IN_PROGRESS"
    node.activePlayerId = playerId
    return { ok: true, node }
  }

  releasePlayer(playerId: PlayerId): NodeUpdatedPayload[] {
    const updates: NodeUpdatedPayload[] = []
    for (const node of this.byId.values()) {
      if (node.status === "IN_PROGRESS" && node.activePlayerId === playerId) {
        node.status = "AVAILABLE"
        node.activePlayerId = null
        updates.push({
          nodeId: node.id,
          visualState: nodeVisualState(node),
          activePlayerId: null,
        })
      }
    }
    this.detectedByPlayer.delete(playerId)
    return updates
  }

  markDepleted(nodeId: ExcavationNodeId): NodeUpdatedPayload | null {
    const node = this.byId.get(nodeId)
    if (!node) {
      return null
    }
    node.status = "DEPLETED"
    node.activePlayerId = null
    this.depletedIds.add(nodeId)
    return {
      nodeId: node.id,
      visualState: nodeVisualState(node),
      activePlayerId: null,
    }
  }

  toPublicUpdate(node: ExcavationNode): NodeUpdatedPayload {
    return {
      nodeId: node.id,
      visualState: nodeVisualState(node),
      activePlayerId: node.activePlayerId,
    }
  }

  listAll(): ExcavationNode[] {
    return [...this.byId.values()]
  }

  private markDetected(playerId: PlayerId, nodeId: ExcavationNodeId): void {
    let set = this.detectedByPlayer.get(playerId)
    if (!set) {
      set = new Set()
      this.detectedByPlayer.set(playerId, set)
    }
    set.add(nodeId)
  }
}

function chunkKey(chunk: ChunkCoordinate): string {
  return `${chunk.x}:${chunk.y}`
}

function distance(a: WorldPosition, b: WorldPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
