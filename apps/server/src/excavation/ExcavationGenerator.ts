import {
  EXCAVATION_GRID_HEIGHT,
  EXCAVATION_GRID_WIDTH,
  EXCAVATION_MAX_ROCK,
  TreasureRarity,
  type TreasureType as TreasureTypeId,
} from "@excave/shared"
import { hashInt } from "../world/hash.js"
import {
  TREASURE_CATALOG,
  normalizeShape,
  rotateShape,
  type TreasureDefinition,
} from "./TreasureCatalog.js"

export interface PlacedTreasure {
  instanceId: string
  type: TreasureTypeId
  cells: Array<{ x: number; y: number }>
  recovered: boolean
}

export interface GeneratedExcavation {
  width: number
  height: number
  /** Diggable rock layers. */
  rock: number[]
  /** Unbreakable metal — secret until revealed. */
  metal: boolean[]
  treasures: PlacedTreasure[]
}

/**
 * Deterministic excavation layout from a node seed.
 * Secrets stay on the server.
 */
export function generateExcavation(nodeSeed: number): GeneratedExcavation {
  const width = EXCAVATION_GRID_WIDTH
  const height = EXCAVATION_GRID_HEIGHT
  const size = width * height

  const rock = new Array<number>(size)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const roll = hashInt(nodeSeed, 0x524f43, x, y) % 100
      let layers = 2
      if (roll < 15) layers = 1
      else if (roll < 50) layers = 2
      else if (roll < 80) layers = 3
      else layers = EXCAVATION_MAX_ROCK
      rock[y * width + x] = layers
    }
  }

  const occupied = new Set<string>()
  const treasureCount = 2 + (hashInt(nodeSeed, 0x544354) % 3) // 2–4
  const treasures: PlacedTreasure[] = []

  for (let i = 0; i < treasureCount; i += 1) {
    const def = pickTreasure(nodeSeed, i)
    const placed = tryPlaceTreasure(nodeSeed, i, def, width, height, occupied)
    if (!placed) {
      continue
    }
    for (const cell of placed.cells) {
      occupied.add(`${cell.x}:${cell.y}`)
    }
    treasures.push(placed)
  }

  // Metal obstacles: a few cells not occupied by treasures.
  const metal = new Array<boolean>(size).fill(false)
  const metalTarget = 2 + (hashInt(nodeSeed, 0x4d4554) % 3) // 2–4
  let placedMetal = 0
  for (let attempt = 0; attempt < size * 2 && placedMetal < metalTarget; attempt += 1) {
    const pick = hashInt(nodeSeed, 0x4d4554, attempt) % size
    const x = pick % width
    const y = Math.floor(pick / width)
    const key = `${x}:${y}`
    if (occupied.has(key) || metal[pick]) {
      continue
    }
    // Keep treasure reachable: avoid sealing too many cells near treasures.
    metal[pick] = true
    placedMetal += 1
  }

  return { width, height, rock, metal, treasures }
}

function pickTreasure(nodeSeed: number, index: number): TreasureDefinition {
  // Weighted toward commons, still deterministic.
  const roll = hashInt(nodeSeed, 0x5049434b, index) % 100
  let pool = TREASURE_CATALOG.filter((t) => t.rarity === TreasureRarity.Common)
  if (roll >= 55) {
    pool = TREASURE_CATALOG.filter((t) => t.rarity === TreasureRarity.Uncommon)
  }
  if (roll >= 80) {
    pool = TREASURE_CATALOG.filter((t) => t.rarity === TreasureRarity.Rare)
  }
  if (roll >= 95) {
    pool = TREASURE_CATALOG.filter((t) => t.rarity === TreasureRarity.Epic)
  }
  if (pool.length === 0) {
    pool = [...TREASURE_CATALOG]
  }
  const choice = hashInt(nodeSeed, 0x545950, index) % pool.length
  return pool[choice]!
}

function tryPlaceTreasure(
  nodeSeed: number,
  index: number,
  def: TreasureDefinition,
  width: number,
  height: number,
  occupied: Set<string>,
): PlacedTreasure | null {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rotation = (hashInt(nodeSeed, 0x524f54, index, attempt) % 4) as
      | 0
      | 1
      | 2
      | 3
    const shape = normalizeShape(rotateShape(def.shape, rotation))
    const maxDx = Math.max(...shape.map((c) => c.dx))
    const maxDy = Math.max(...shape.map((c) => c.dy))
    const originX =
      hashInt(nodeSeed, 0x58, index, attempt) % Math.max(1, width - maxDx)
    const originY =
      hashInt(nodeSeed, 0x59, index, attempt) % Math.max(1, height - maxDy)

    const cells = shape.map((c) => ({
      x: originX + c.dx,
      y: originY + c.dy,
    }))

    if (
      cells.some(
        (cell) =>
          cell.x < 0 ||
          cell.y < 0 ||
          cell.x >= width ||
          cell.y >= height ||
          occupied.has(`${cell.x}:${cell.y}`),
      )
    ) {
      continue
    }

    return {
      instanceId: `${def.type}:${index}:${originX}:${originY}`,
      type: def.type,
      cells,
      recovered: false,
    }
  }
  return null
}
