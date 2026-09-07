import {
  pgTable,
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

export type WorldRow = typeof worlds.$inferSelect
