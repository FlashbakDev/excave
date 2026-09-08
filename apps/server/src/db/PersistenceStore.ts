import {
  ExcavationSessionStatus,
  TreasureRarity,
  type InventoryItemPublic,
  type InventoryUpdatePayload,
  type PlayerId,
  type RecoveredTreasurePublic,
  type TreasureType as TreasureTypeId,
  type WorldId,
} from "@excave/shared"
import { and, eq, sql } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import type { Database } from "./client.js"
import {
  excavationHistory,
  excavationNodes,
  playerItems,
  players,
} from "./schema.js"
import type { ExcavationNode } from "../excavation/generateNodes.js"
import { getTreasureDefinition } from "../excavation/TreasureCatalog.js"

export type ExcavationEndStatus =
  | typeof ExcavationSessionStatus.Completed
  | typeof ExcavationSessionStatus.Collapsed

export interface FinalizeExcavationInput {
  sessionId: string
  node: ExcavationNode
  playerId: PlayerId
  status: ExcavationEndStatus
  recovered: RecoveredTreasurePublic[]
}

/**
 * Loot + node persistence for Lot 9.
 * Uses Postgres when available; otherwise an in-process fallback (tests / no DB).
 */
export class PersistenceStore {
  private readonly memoryItems = new Map<PlayerId, Map<string, number>>()
  private readonly memoryDepleted = new Set<string>()
  private readonly memoryHistory = new Set<string>()

  constructor(private readonly db: Database["db"] | null) {}

  async ensurePlayer(playerId: PlayerId): Promise<void> {
    if (!this.db) {
      if (!this.memoryItems.has(playerId)) {
        this.memoryItems.set(playerId, new Map())
      }
      return
    }

    const now = new Date()
    await this.db
      .insert(players)
      .values({ id: playerId, createdAt: now, lastSeenAt: now })
      .onConflictDoUpdate({
        target: players.id,
        set: { lastSeenAt: now },
      })
  }

  async getInventory(playerId: PlayerId): Promise<InventoryUpdatePayload> {
    await this.ensurePlayer(playerId)

    if (!this.db) {
      const bag = this.memoryItems.get(playerId) ?? new Map()
      return { items: toPublicItems(bag) }
    }

    const rows = await this.db
      .select()
      .from(playerItems)
      .where(eq(playerItems.playerId, playerId))

    const bag = new Map<string, number>()
    for (const row of rows) {
      bag.set(row.itemType, row.quantity)
    }
    return { items: toPublicItems(bag) }
  }

  async listDepletedNodeIds(worldId: WorldId): Promise<string[]> {
    if (!this.db) {
      return [...this.memoryDepleted]
    }

    const rows = await this.db
      .select({ id: excavationNodes.id })
      .from(excavationNodes)
      .where(
        and(
          eq(excavationNodes.worldId, worldId),
          eq(excavationNodes.status, "DEPLETED"),
        ),
      )
    return rows.map((row) => row.id)
  }

  /**
   * Atomic finalize: history (once) + loot increments + node DEPLETED.
   * Duplicate sessionId awards no loot twice.
   */
  async finalizeExcavation(
    input: FinalizeExcavationInput,
  ): Promise<InventoryUpdatePayload> {
    await this.ensurePlayer(input.playerId)

    if (!this.db) {
      return this.finalizeInMemory(input)
    }

    const node = input.node
    await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(excavationHistory)
        .values({
          id: randomUUID(),
          sessionId: input.sessionId,
          nodeId: node.id,
          playerId: input.playerId,
          worldId: node.worldId,
          status: input.status,
          recoveredJson: JSON.stringify(input.recovered),
        })
        .onConflictDoNothing({ target: excavationHistory.sessionId })
        .returning({ id: excavationHistory.id })

      if (inserted.length > 0) {
        for (const treasure of input.recovered) {
          await tx
            .insert(playerItems)
            .values({
              playerId: input.playerId,
              itemType: treasure.type,
              quantity: 1,
            })
            .onConflictDoUpdate({
              target: [playerItems.playerId, playerItems.itemType],
              set: {
                quantity: sql`${playerItems.quantity} + 1`,
              },
            })
        }
      }

      await tx
        .insert(excavationNodes)
        .values({
          id: node.id,
          worldId: node.worldId,
          chunkX: node.chunkX,
          chunkY: node.chunkY,
          tileX: node.tileX,
          tileY: node.tileY,
          worldTileX: node.worldTileX,
          worldTileY: node.worldTileY,
          wallSide: node.wallSide,
          seed: node.seed,
          status: "DEPLETED",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: excavationNodes.id,
          set: {
            status: "DEPLETED",
            updatedAt: new Date(),
          },
        })
    })

    return this.getInventory(input.playerId)
  }

  private finalizeInMemory(
    input: FinalizeExcavationInput,
  ): InventoryUpdatePayload {
    this.memoryDepleted.add(input.node.id)
    if (!this.memoryHistory.has(input.sessionId)) {
      this.memoryHistory.add(input.sessionId)
      const bag = this.memoryItems.get(input.playerId) ?? new Map()
      for (const treasure of input.recovered) {
        bag.set(treasure.type, (bag.get(treasure.type) ?? 0) + 1)
      }
      this.memoryItems.set(input.playerId, bag)
    }
    const bag = this.memoryItems.get(input.playerId) ?? new Map()
    return { items: toPublicItems(bag) }
  }
}

function toPublicItems(bag: Map<string, number>): InventoryItemPublic[] {
  const items: InventoryItemPublic[] = []
  for (const [itemType, quantity] of bag) {
    if (quantity <= 0) continue
    try {
      const def = getTreasureDefinition(itemType as TreasureTypeId)
      items.push({
        type: def.type,
        rarity: def.rarity,
        name: def.name,
        quantity,
      })
    } catch {
      items.push({
        type: itemType as TreasureTypeId,
        rarity: TreasureRarity.Common,
        name: itemType,
        quantity,
      })
    }
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "fr"))
  return items
}
