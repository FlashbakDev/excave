import {
  TreasureRarity,
  TreasureType,
  type TreasureRarity as TreasureRarityId,
  type TreasureType as TreasureTypeId,
} from "@excave/shared"

export type CellOffset = { dx: number; dy: number }

export interface TreasureDefinition {
  type: TreasureTypeId
  rarity: TreasureRarityId
  name: string
  /** Base shape before rotation (local offsets). */
  shape: readonly CellOffset[]
}

/**
 * Server-only treasure catalog for the POC (~10 items).
 */
export const TREASURE_CATALOG: readonly TreasureDefinition[] = [
  {
    type: TreasureType.Quartz,
    rarity: TreasureRarity.Common,
    name: "Quartz",
    shape: [{ dx: 0, dy: 0 }],
  },
  {
    type: TreasureType.Amethyst,
    rarity: TreasureRarity.Common,
    name: "Améthyste",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
    ],
  },
  {
    type: TreasureType.Pyrite,
    rarity: TreasureRarity.Common,
    name: "Pyrite",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 1 },
    ],
  },
  {
    type: TreasureType.RoughRuby,
    rarity: TreasureRarity.Uncommon,
    name: "Rubis brut",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
    ],
  },
  {
    type: TreasureType.RoughSapphire,
    rarity: TreasureRarity.Uncommon,
    name: "Saphir brut",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 1, dy: 1 },
    ],
  },
  {
    type: TreasureType.Ammonite,
    rarity: TreasureRarity.Uncommon,
    name: "Ammonite",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
    ],
  },
  {
    type: TreasureType.FossilTooth,
    rarity: TreasureRarity.Rare,
    name: "Dent fossilisée",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: 2 },
    ],
  },
  {
    type: TreasureType.Trilobite,
    rarity: TreasureRarity.Rare,
    name: "Trilobite",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 1 },
    ],
  },
  {
    type: TreasureType.AncientCoin,
    rarity: TreasureRarity.Rare,
    name: "Pièce antique",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 2, dy: 0 },
      { dx: 1, dy: 1 },
    ],
  },
  {
    type: TreasureType.StatueFragment,
    rarity: TreasureRarity.Epic,
    name: "Fragment de statuette",
    shape: [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: 2 },
      { dx: 1, dy: 2 },
    ],
  },
]

export function getTreasureDefinition(
  type: TreasureTypeId,
): TreasureDefinition {
  const found = TREASURE_CATALOG.find((entry) => entry.type === type)
  if (!found) {
    throw new Error(`Unknown treasure type: ${type}`)
  }
  return found
}

export function rotateShape(
  shape: readonly CellOffset[],
  rotation: 0 | 1 | 2 | 3,
): CellOffset[] {
  return shape.map(({ dx, dy }) => {
    switch (rotation) {
      case 1:
        return { dx: -dy, dy: dx }
      case 2:
        return { dx: -dx, dy: -dy }
      case 3:
        return { dx: dy, dy: -dx }
      default:
        return { dx, dy }
    }
  })
}

export function normalizeShape(shape: readonly CellOffset[]): CellOffset[] {
  const minX = Math.min(...shape.map((c) => c.dx))
  const minY = Math.min(...shape.map((c) => c.dy))
  return shape.map((c) => ({ dx: c.dx - minX, dy: c.dy - minY }))
}
