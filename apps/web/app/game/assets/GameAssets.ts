import { Assets, Texture, TextureStyle } from "pixi.js"
import { ExplorerTextures } from "../characters/explorerTextures"
import { CaveDecorTextures } from "../environment/CaveDecorTextures"
import { ASSET_DISPLAY_SCALE, ASSET_SOURCE_SIZE } from "./pixelScale"
import type { TerrainTextureId } from "../world/TileVariantResolver"

import ground01Url from "../../assets/game/tiles/ground_01.png?url"
import ground02Url from "../../assets/game/tiles/ground_02.png?url"
import ground03Url from "../../assets/game/tiles/ground_03.png?url"
import wallTop01Url from "../../assets/game/tiles/wall_top_01.png?url"
import wallTop02Url from "../../assets/game/tiles/wall_top_02.png?url"
import wallTop03Url from "../../assets/game/tiles/wall_top_03.png?url"
import wallFaceSUrl from "../../assets/game/tiles/wall_face_s.png?url"
import wallFaceEUrl from "../../assets/game/tiles/wall_face_e.png?url"
import wallFaceWUrl from "../../assets/game/tiles/wall_face_w.png?url"
import wallCornerNeUrl from "../../assets/game/tiles/wall_corner_ne.png?url"
import wallCornerNwUrl from "../../assets/game/tiles/wall_corner_nw.png?url"
import wallCornerSeUrl from "../../assets/game/tiles/wall_corner_se.png?url"
import wallCornerSwUrl from "../../assets/game/tiles/wall_corner_sw.png?url"
import wallInnerSeUrl from "../../assets/game/tiles/wall_inner_se.png?url"
import wallInnerSwUrl from "../../assets/game/tiles/wall_inner_sw.png?url"
import explorerSheetUrl from "../../assets/game/characters/explorer/explorer.png?url"
import caveDecorSheetUrl from "../../assets/game/environment/cave_decor.png?url"

export type GameTextureId =
  | TerrainTextureId
  | "explorer_sheet"
  | "cave_decor_sheet"

const ASSET_URLS: Record<GameTextureId, string> = {
  ground_01: ground01Url,
  ground_02: ground02Url,
  ground_03: ground03Url,
  wall_top_01: wallTop01Url,
  wall_top_02: wallTop02Url,
  wall_top_03: wallTop03Url,
  wall_face_s: wallFaceSUrl,
  wall_face_e: wallFaceEUrl,
  wall_face_w: wallFaceWUrl,
  wall_corner_ne: wallCornerNeUrl,
  wall_corner_nw: wallCornerNwUrl,
  wall_corner_se: wallCornerSeUrl,
  wall_corner_sw: wallCornerSwUrl,
  wall_inner_se: wallInnerSeUrl,
  wall_inner_sw: wallInnerSwUrl,
  explorer_sheet: explorerSheetUrl,
  cave_decor_sheet: caveDecorSheetUrl,
}

/**
 * Central loader for game textures. Call `load()` once after configuring
 * nearest-neighbor defaults — do not scatter `Assets.load` elsewhere.
 */
export class GameAssets {
  private readonly textures = new Map<GameTextureId, Texture>()
  private explorerTextures: ExplorerTextures | null = null
  private caveDecorTextures: CaveDecorTextures | null = null
  private loaded = false

  /** Apply Pixi v8 nearest filtering before any texture is created/loaded. */
  static configurePixelPerfectDefaults(): void {
    TextureStyle.defaultOptions.scaleMode = "nearest"
  }

  get isLoaded(): boolean {
    return this.loaded
  }

  /** World-pixel size of one source art tile after ×2 display scale. */
  get tileDisplaySize(): number {
    return ASSET_DISPLAY_SCALE * ASSET_SOURCE_SIZE
  }

  async load(): Promise<void> {
    if (this.loaded) {
      return
    }

    GameAssets.configurePixelPerfectDefaults()

    const ids = Object.keys(ASSET_URLS) as GameTextureId[]
    await Promise.all(
      ids.map(async (id) => {
        const texture = await Assets.load<Texture>(ASSET_URLS[id])
        enforceNearest(texture)
        this.textures.set(id, texture)
      }),
    )

    this.explorerTextures = new ExplorerTextures(this.get("explorer_sheet"))
    this.caveDecorTextures = new CaveDecorTextures(this.get("cave_decor_sheet"))
    this.loaded = true
  }

  get(id: GameTextureId): Texture {
    const texture = this.textures.get(id)
    if (!texture) {
      throw new Error(`GameAssets: texture "${id}" not loaded — call load() first`)
    }
    return texture
  }

  getExplorerTextures(): ExplorerTextures {
    if (!this.explorerTextures) {
      throw new Error("GameAssets: explorer textures not loaded — call load() first")
    }
    return this.explorerTextures
  }

  getCaveDecorTextures(): CaveDecorTextures {
    if (!this.caveDecorTextures) {
      throw new Error("GameAssets: cave decor textures not loaded — call load() first")
    }
    return this.caveDecorTextures
  }

  destroy(): void {
    this.textures.clear()
    this.explorerTextures = null
    this.caveDecorTextures = null
    this.loaded = false
  }
}

function enforceNearest(texture: Texture): void {
  const source = texture.source
  if (!source) {
    return
  }
  source.scaleMode = "nearest"
  source.style?.update?.()
}
