# Excave — Conventions pixel art

> Conventions art seulement. État runtime : [STATE.md](./STATE.md).

Complète [ART_DIRECTION.md](./ART_DIRECTION.md).  
Implémentation pipeline / Pixi : **Lot 11**.

---

## 1. Tailles

| Concept | Valeur | Notes |
|---------|--------|-------|
| Tile logique (`TILE_SIZE`) | **32** | `packages/shared` — **ne pas modifier** pour l’art |
| Chunk | **16×16** tiles | Streaming / AOI (`CHUNK_SIZE`) |
| Asset source (convention principale) | **16×16** | Dessiné en 16×16 |
| Affichage monde | **×2** → 32×32 | Un tile source = une tile logique affichée |
| Zoom caméra | **1×, 2×, 3×** | Entiers uniquement |

### Convention retenue : Option B

```
dessin 16×16  →  scale ×2 (nearest)  →  32×32 à l’écran (zoom 1×)
```

Si un asset exceptionnel doit être natif 32×32, le documenter dans le nom (`*_32.png`) — **exception**, pas la norme.

---

## 2. Scaling

- Toujours **nearest-neighbor** (pas de bilinéaire / flou)
- Pas de scale fractionnaire type `1.13847`
- Alignement caméra sur la grille pixel autant que possible (détail Lot 11)
- Sur écran HiDPI : gérer `resolution` / densités sans interpoler les textures art

---

## 3. Animations

| Type | Frames | FPS indicatif | Notes |
|------|--------|---------------|-------|
| Idle | 1–2 | bas | Lot 14 : 1 frame statique (souterrain calme) |
| Walk | 3–4 | ~8–12 | Lot 14 : 3 frames, cycle `0-1-2-1` @ 8 fps |
| Scan onde | procédural / peu de frames | 400–700 ms | Lot 16 |
| Scintillement filon | 2–3 | lent | ✦ / ✧ |
| Impact outil | 2–4 + particules | court | Lot 17 / 19 |

Pas de moteur d’animation générique excessif : `CharacterView` + `facingFromDelta` (Lot 14) suffisent.

### Personnage explorateur (Lot 14)

| Concept | Valeur |
|---------|--------|
| Résolution source | **16×16** par frame |
| Affichage | **×2** nearest → 32×32 monde |
| Spritesheet | `app/assets/game/characters/explorer/explorer.png` (**64×48**) |
| Metadata | `explorer.json` + `character.config.ts` (`EXPLORER_FRAME_RECTS`) |
| Régénération | `pnpm --filter @excave/web assets:explorer` |

#### Noms de frames

```
explorer_idle_down_0
explorer_idle_up_0
explorer_idle_left_0
explorer_walk_down_0|1|2
explorer_walk_up_0|1|2
explorer_walk_left_0|1|2
```

**Mirroring** : RIGHT = flip horizontal de LEFT (lampe frontale + sac restent cohérents). Pas de frames `*_right_*` dans le sheet.

Layout sheet (colonnes × lignes) :

```
idle | walk0 | walk1 | walk2
────────────────────────────
down
up
left
```

---

## 4. Contraintes Pixi (Lot 11 — implémenté)

Stack : **PixiJS 8.20.x**.

Réglages appliqués :

- `TextureStyle.defaultOptions.scaleMode = 'nearest'` avant tout chargement
- `antialias: false` + `roundPixels: true` sur l’Application
- `resolution` entière (`Math.round(devicePixelRatio)`)
- canvas CSS `image-rendering: pixelated`
- caméra : offset arrondi ; zoom **1 / 2 / 3** uniquement (touches clavier)
- chargement centralisé : `app/game/assets/GameAssets.ts`

POC Lots 0–10 : rendu `Graphics`.  
Lot 11 : tiles + joueur via **sprites** 16×16 ×2.

---

## 5. Conventions de fichiers

Racine progressive (Nuxt : sous `app/` pour que Vite résolve les imports) :

```
apps/web/app/assets/game/
  tiles/
  characters/
  environment/
  nodes/
  particles/
  excavation/
  ui/
  icons/
```

### Nommage

| Pattern | Exemple | Usage |
|---------|---------|-------|
| `ground_0N.png` | `ground_01.png` | Variants sol |
| `wall_*.png` | `wall_edge_n.png` | Autotile mur |
| `player_<anim>_<dir>.png` ou atlas | `player_walk_down.png` | Personnage |
| `decor_*.png` / atlas | `decor_pebbles` dans `cave_decor` | Décor non interactif |
| `gem_*.png` / `node_*.png` | `gem_amethyst.png` | Trésors / filons |
| Placeholders Lot 11 | `ground.png`, `wall.png`, `player_idle.png` | Pipeline only |

- Minuscules, `snake_case`, extension `.png` (index alpha)
- Pas d’espaces
- Une intention = un nom stable (éviter `final_v3_really.png`)

### Organisation code (progressive)

```
apps/web/app/
  game/
    assets/          # GameAssets (Lot 11)
    characters/      # CharacterView + facing (Lot 14)
    environment/     # Cave decor atlas (Lot 15A)
    renderer/        # existant
    camera/          # si extrait plus tard
    world/           # TileVariantResolver (Lot 12)
    lighting/        # Lot 13
    effects/         # particules / shake (Lot 19)
  components/
    game/
    excavation/      # existant
    hud/             # Lot 18
```

Ne créer les dossiers que lorsqu’un lot en a besoin.

---

## 6. Placeholders & tileset

### Lot 11

| Fichier | Taille | Usage |
|---------|--------|-------|
| `app/assets/game/characters/player_idle.png` | 16×16 | Legacy idle (régénéré depuis explorateur Lot 14) |

### Lot 14 — explorateur

| Fichier | Usage |
|---------|--------|
| `characters/explorer/explorer.png` | Spritesheet idle/walk |
| `characters/explorer/explorer.json` | Atlas metadata (doc / outils) |
| `app/game/characters/*` | `CharacterView`, facing, config |

### Lot 15A — décor de grotte

| Fichier | Usage |
|---------|--------|
| `environment/cave_decor.png` | Atlas 64×64 (16×16 × 4×4) |
| `environment/cave_decor.json` | Metadata frames |
| `app/game/environment/*` | `CaveDecorTextures`, clés ground/wall |
| Régénération | `pnpm --filter @excave/web assets:cave-decor` |

Frames (noms atlas) :

```
decor_stone_sm | decor_stone_md | decor_pebbles | decor_pebbles_loose
decor_crack_floor | decor_crack_floor_y | decor_dust | decor_dust_scatter
decor_root | decor_root_fork | decor_mushroom | decor_mushroom_pair
decor_wall_crack | decor_wall_crack_diag | decor_wall_chip | decor_mineral_trace
```

Règles art : palette roche/sol uniquement (+ olive muet champignons) ; pas de glow ; pas de saturation gemme ; silhouette ≤ 1 tile ; nearest only.

### Lot 15B — placement

| Concept | Valeur |
|---------|--------|
| Resolver | `app/game/environment/DecorResolver.ts` |
| Rendu | `WorldContainer` — layers `groundDecor` / `wallDecor` / `foregroundDecor` |
| Hash | `hashDecorCell(seed, worldX, worldY, salt)` — jamais `Math.random()` |
| Flip | `flipX` déterministe optionnel |
| Polish 15C | `clusterFactor`, alpha par frame, prune AOI client |

### Lot 12 / relief — sol / mur (faux 3D top-down)

| Fichier | Usage |
|---------|--------|
| `ground_01` … `ground_03` | Variants sol (`hash(worldX, worldY)`) |
| `wall_top_01` … `wall_top_03` | Masse rocheuse (void-adjacent) |
| `wall_face_s/e/w` | Falaises (overlays alpha) |
| `wall_corner_ne/nw/se/sw` | Coins externes (overlays) |
| `ground_04` / `wall_center` / `wall_edge_*` | Alias legacy (régénérés, non chargés) |

Resolver : `resolveTerrainPlacements` → layers `wallTop` / `ground` / `wallFace`  
Régénération : `pnpm --filter @excave/web assets:placeholders`

## 7. Validation visuelle (pipeline)

- Chrome, 1080p, zoom navigateur **100 %**
- Fenêtre redimensionnée : pixels nets
- Comparer zoom 1× / 2× / 3× (touches **1** / **2** / **3**) : pas de flou
- MUR ≠ SOL lisible ; face sud = falaise claire ; wall top = masse sombre
- Couloirs / coins L / intersections sans trous ni seams de chunk
- Décor Lot 15A : frames nettes à zoom 1/2/3 ; moins saturées que joueur / futurs filons

Détail des tests d’écran : Lots 11–12 et 20.
