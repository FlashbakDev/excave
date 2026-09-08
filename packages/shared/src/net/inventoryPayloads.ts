import type { TreasureRarity, TreasureType } from "./treasurePayloads.js"

/** Public inventory row for HUD / session ready. */
export interface InventoryItemPublic {
  type: TreasureType
  rarity: TreasureRarity
  name: string
  quantity: number
}

export interface InventoryUpdatePayload {
  items: InventoryItemPublic[]
}
