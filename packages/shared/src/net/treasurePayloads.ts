/** Public treasure type ids (names OK in shared; placement stays server-only). */
export const TreasureType = {
  Quartz: "quartz",
  Amethyst: "amethyst",
  Pyrite: "pyrite",
  RoughRuby: "rough_ruby",
  RoughSapphire: "rough_sapphire",
  Ammonite: "ammonite",
  FossilTooth: "fossil_tooth",
  Trilobite: "trilobite",
  AncientCoin: "ancient_coin",
  StatueFragment: "statue_fragment",
} as const

export type TreasureType = (typeof TreasureType)[keyof typeof TreasureType]

export const TreasureRarity = {
  Common: "COMMON",
  Uncommon: "UNCOMMON",
  Rare: "RARE",
  Epic: "EPIC",
} as const

export type TreasureRarity =
  (typeof TreasureRarity)[keyof typeof TreasureRarity]

/** Public recovered treasure (no grid coordinates). */
export interface RecoveredTreasurePublic {
  type: TreasureType
  rarity: TreasureRarity
  name: string
}
