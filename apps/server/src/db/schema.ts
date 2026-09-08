import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const worlds = pgTable("worlds", {
  id: text("id").primaryKey(),
  seed: text("seed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const excavationNodes = pgTable("excavation_nodes", {
  id: text("id").primaryKey(),
  worldId: text("world_id").notNull(),
  chunkX: integer("chunk_x").notNull(),
  chunkY: integer("chunk_y").notNull(),
  tileX: integer("tile_x").notNull(),
  tileY: integer("tile_y").notNull(),
  worldTileX: integer("world_tile_x").notNull(),
  worldTileY: integer("world_tile_y").notNull(),
  wallSide: text("wall_side").notNull(),
  seed: integer("seed").notNull(),
  status: text("status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const playerItems = pgTable(
  "player_items",
  {
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    itemType: text("item_type").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.itemType] })],
)

export const excavationHistory = pgTable("excavation_history", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  nodeId: text("node_id").notNull(),
  playerId: text("player_id")
    .notNull()
    .references(() => players.id),
  worldId: text("world_id").notNull(),
  status: text("status").notNull(),
  recoveredJson: text("recovered_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export type WorldRow = typeof worlds.$inferSelect
export type PlayerRow = typeof players.$inferSelect
export type ExcavationNodeRow = typeof excavationNodes.$inferSelect
export type PlayerItemRow = typeof playerItems.$inferSelect
export type ExcavationHistoryRow = typeof excavationHistory.$inferSelect
