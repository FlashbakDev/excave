import {
  ExcavationTool,
  type ExcavationCellPublic,
  type ExcavationTool as ExcavationToolId,
  type RecoveredTreasurePublic,
} from "@excave/shared"
import { getTreasureDefinition } from "./TreasureCatalog.js"
import type { ExcavationSessionState } from "./ExcavationSession.js"

type Kernel = ReadonlyArray<ReadonlyArray<number>>

export const PICKAXE_KERNEL: Kernel = [
  [0, 1, 0],
  [1, 3, 1],
  [0, 1, 0],
]

export const HAMMER_KERNEL: Kernel = [
  [1, 2, 1],
  [2, 4, 2],
  [1, 2, 1],
]

export const STABILITY_COST: Record<ExcavationToolId, number> = {
  [ExcavationTool.Pickaxe]: 2,
  [ExcavationTool.Hammer]: 5,
}

export interface HitResolution {
  changedCells: ExcavationCellPublic[]
  newlyRecovered: RecoveredTreasurePublic[]
  stabilityDelta: number
}

/**
 * Applies a tool kernel to session state (mutates session).
 * Reveals metal when hit; never digs metal cells.
 */
export function resolveHit(
  session: ExcavationSessionState,
  centerX: number,
  centerY: number,
  tool: ExcavationToolId,
): HitResolution {
  const kernel = tool === ExcavationTool.Hammer ? HAMMER_KERNEL : PICKAXE_KERNEL
  const changedByKey = new Map<string, ExcavationCellPublic>()
  const offsetY = Math.floor(kernel.length / 2)
  const offsetX = Math.floor((kernel[0]?.length ?? 1) / 2)

  for (let ky = 0; ky < kernel.length; ky += 1) {
    const row = kernel[ky]
    if (!row) continue
    for (let kx = 0; kx < row.length; kx += 1) {
      const damage = row[kx] ?? 0
      if (damage <= 0) continue
      const x = centerX + (kx - offsetX)
      const y = centerY + (ky - offsetY)
      if (x < 0 || y < 0 || x >= session.width || y >= session.height) {
        continue
      }

      const index = y * session.width + x
      const beforeRock = session.rock[index] ?? 0
      const isMetal = session.metal[index] === true
      const wasMetalRevealed = session.revealedMetal[index] === true

      let afterRock = beforeRock
      let metalRevealed = wasMetalRevealed

      if (isMetal) {
        if (!wasMetalRevealed) {
          metalRevealed = true
          session.revealedMetal[index] = true
        }
      } else if (beforeRock > 0) {
        afterRock = Math.max(0, beforeRock - damage)
        session.rock[index] = afterRock
      }

      const rockChanged = afterRock !== beforeRock
      const metalJustRevealed = isMetal && metalRevealed && !wasMetalRevealed
      if (!rockChanged && !metalJustRevealed) {
        continue
      }

      const cell: ExcavationCellPublic = {
        x,
        y,
        remainingRock: afterRock,
      }
      if (metalRevealed) {
        cell.isMetal = true
      }
      changedByKey.set(`${x}:${y}`, cell)
    }
  }

  return {
    changedCells: [...changedByKey.values()],
    newlyRecovered: recoverReadyTreasures(session),
    stabilityDelta: STABILITY_COST[tool],
  }
}

function recoverReadyTreasures(
  session: ExcavationSessionState,
): RecoveredTreasurePublic[] {
  const newly: RecoveredTreasurePublic[] = []
  for (const treasure of session.treasures) {
    if (treasure.recovered) {
      continue
    }
    const cleared = treasure.cells.every((cell) => {
      const index = cell.y * session.width + cell.x
      return (session.rock[index] ?? 0) <= 0
    })
    if (!cleared) {
      continue
    }
    treasure.recovered = true
    const def = getTreasureDefinition(treasure.type)
    newly.push({
      type: def.type,
      rarity: def.rarity,
      name: def.name,
    })
  }
  return newly
}
