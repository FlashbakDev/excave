# Excave — Direction artistique

Référence visuelle du projet. Toute production d’assets, choix de palette côté client et décision de rendu doit s’y conformer.

Lots associés : **10** (ce document) → **11–20** (pipeline, tiles, lumière, personnage, UI, polish).

---

## 1. Vision

Excave est une **expédition archéologique souterraine** : un monde sombre, presque monochrome, où de petits explorateurs éclairent les galeries à la lampe frontale et découvrent des trésors saturés dans la roche.

Le cœur visuel :

```
OBSCURITÉ + LUMIÈRE CHAUDE + PIXEL ART + EXPLORATION + TRÉSORS COLORÉS
```

Le joueur doit ressentir :

- un espace vaste et mystérieux ;
- un refuge chaleureux dans le cercle de lumière ;
- l’excitation de trouver quelque chose de **brillant** dans la pierre.

Ce n’est plus un POC technique dans un canvas : c’est un jeu d’exploration pixel art.

---

## 2. Ambiance

| Qualité | Intention |
|--------|-----------|
| Souterrain | Galeries, roche, profondeur, silence visuel |
| Chaleureux | Ambre / jaune de lampe, jamais un noir clinique |
| Mystérieux | Hors lumière = presque rien ; le monde se révèle |
| Accueillant | Pas d’horreur gore ; curiosité et découverte |
| Lisible | MUR / SOL / JOUEUR / TRÉSOR identifiables en un coup d’œil |
| Ludique | HUD minimal ; feedback court et satisfaisant |

**Référence d’ambiance (pas de copie)** : Core Keeper pour la lisibilité souterraine et la lumière locale.  
**Interdit** : recopier sprites, textures, personnages, HUD, palettes exactes, assets ou animations image par image.

---

## 3. Palette retenue (petite, volontaire)

Palette initiale figée au Lot 10. Hex CSS / design ; équivalents `0xRRGGBB` pour Pixi.

### Obscurité

| Nom | Hex | Rôle |
|-----|-----|------|
| Void | `#080908` | Fond hors lumière, clear color « nuit » |
| Deep | `#10110F` | Overlay d’obscurité, zones lointaines |

### Roche

| Nom | Hex | Rôle |
|-----|-----|------|
| Rock 0 | `#191A16` | Mur profond / face sombre |
| Rock 1 | `#25251F` | Mur principal |
| Rock 2 | `#343127` | Bord / relief mur |
| Rock 3 | `#454033` | Highlight discret de roche |

### Terre / sol

| Nom | Hex | Rôle |
|-----|-----|------|
| Soil 0 | `#554A37` | Sol de base |
| Soil 1 | `#675942` | Variant / micro-relief sol |

Le sol reste **peu contrasté**. Le mur est **plus contrasté** que le sol (lisibilité MUR ≠ SOL).

### Lumière (lampe)

| Nom | Hex | Rôle |
|-----|-----|------|
| Lamp dim | `#D8A75F` | Anneau moyen |
| Lamp mid | `#F2CA7C` | Halo proche |
| Lamp hot | `#FFE1A0` | Pixel lampe frontale / centre |

La **lampe frontale** est l’emblème visuel d’Excave : le monde est sombre ; le personnage porte la chaleur.

### Accent UI

| Nom | Hex | Rôle |
|-----|-----|------|
| UI gold | `#D7B16F` | Boutons, prompts, icônes HUD |

### Gemmes / trésors (seuls accents saturés du monde)

| Nom | Hex | Intention |
|-----|-----|-----------|
| Gem cyan | `#3ECFCF` | Filons / cristaux froids |
| Gem violet | `#B44CE0` | Améthyste, magie minérale |
| Gem rouge | `#E04545` | Rubis, alerte douce |
| Gem vert | `#3DBB6A` | Émeraude, vie minérale |
| Gem or | `#F0C14A` | Or, loot « précieux » |

**Règle** : le monde n’est pas un arc-en-ciel. Les gemmes sont les **seuls** points saturés. Un trésor doit attirer l’œil immédiatement.

#### Exemple de lisibilité (texte)

```
▓▓▓▓▓▓▓▓▓▓▓     ▓ = mur (roche sombre)
▓░░░░░░░░▓     ░ = sol (terre basse saturation)
▓░░👤░░✦░▓     👤 = explorateur + halo lampe
▓░░░░░░░░▓     ✦ = trésor / filon (couleur saturée)
▓▓▓▓▓▓▓▓▓▓▓
```

Le `✦` doit se lire avant le détail de la roche.

### Mapping depuis le POC actuel (Lots 0–9)

Le POC utilise déjà une famille sépia (`#12100e`, `#2a241c`, `#0c0b09`, `#c4a574`).  
La palette Lot 10 **affine** cette direction (plus d’obscurité structurée, gemmes explicites) sans rompre l’identité déjà amorcée. Remplacement progressif dans les lots 12–18 — pas de big-bang rendu au Lot 10.

---

## 4. Références

### Oui (ambiance / méthode)

- Core Keeper — lumière locale, lisibilité sol/mur, trésors qui « pop »
- Jeux d’exploration 2D pixel art avec fog of light (esprit, pas assets)
- Archéologie / grottes photographiées (tons pierre + touches de minerai)

### Non (copie)

- Sprites / tilesets Core Keeper ou tout autre jeu commercial
- Palettes 1:1 d’un titre concurrent
- HUD « clone » (barres, cadres, icônes)

### Identité Excave

Petit explorateur à **casque + lampe** dans une **roche presque monochrome**, trésors **éclatants**, UI **discrète**.

---

## 5. Règles de lisibilité

1. **MUR vs SOL** : contrastes de valeur distincts ; reconnaissable sans zoom mental.
2. **Joueur** : silhouette claire dans le halo ; jamais camouflé dans la texture du sol.
3. **Trésor / filon** : saturation > environnement ; scintillement léger autorisé.
4. **UI** : ne jamais concurrencer le monde en mode normal (pas de panneau debug permanent).
5. **Obscurité** : hors lumière ≈ illisible ; pas un gris moyen uniforme qui tue le mystère.
6. **Densité décor** : la galerie reste lisible (voir Lot 15 — faible densité).

---

## 6. Proportions

| Élément | Convention |
|---------|------------|
| Tile logique monde | **32×32 px** (`TILE_SIZE` partagé — **ne pas changer**) |
| Asset source privilégié | **16×16 px** dessinés, affichés en **×2** → 32×32 écran |
| Personnage | Silhouette ~16×16 source (corps + casque), footprint ≤ 1 tile |
| Filons / gemmes décor | 8×8 à 16×16 source |
| Décor sol | 8×8 à 16×16, sparse |
| Zoom caméra | Entiers **1× / 2× / 3×** uniquement (détail Lot 11) |

Le monde logique reste en pixels avec `TILE_SIZE = 32`. Le ×2 est une convention **asset → affichage**, pas un changement de physique serveur.

---

## 7. Règles environnement

### Sol

- Peu contrasté, texture légère
- Petits cailloux, fissures, tâches occasionnelles
- Variants déterministes `hash(worldX, worldY)` — **pas de DB décor**

### Mur

- Masse rocheuse sombre (**wall top**) + faces verticales quand le sol est adjacent
- Autotiling client `resolveTerrainPlacements` (N/S/E/W) — gameplay reste FLOOR/WALL
- Pas de face nord dédiée (top-down) ; coins externes via overlays

### Concept de profondeur mur / sol

```
████████████████  void / wall top (roche sombre)
████ WALL TOP ███
▒▒▒ WALL FACE ▒▒▒  falaise (~8 px source)
░░░░ FLOOR ░░░░░░  galerie praticable
```

### Décor vivant (Lot 15)

Cailloux, fissures, racines, pousses, champignons, cristaux décoratifs, poussière — **non interactifs**, faible densité (~80 % vide).

#### Lot 15A — bibliothèque d’assets (atlas)

| Aspect | Convention |
|--------|------------|
| Atlas | `app/assets/game/environment/cave_decor.png` + `.json` (**64×64**, 16 frames 16×16) |
| Régénération | `pnpm --filter @excave/web assets:cave-decor` |
| Code | `app/game/environment/` — `CaveDecorTextures`, `caveDecor.config.ts` |
| Chargement | `GameAssets` → `getCaveDecorTextures()` |
| Palette | Rock 0–3, Soil 0–1, deep, olive désaturé (champignons), ochre muet (trace minérale) |
| Interdit | Gemmes saturées, glow, AA, animation, collision, forme « filon » interactif |
| Taille | ≤ 1 tile source ; décor **moins saturé** que joueur / filons / loot |

Frames : pierres, cailloux, fissures sol, poussière, racines, champignons ternes, fissures/chips mur, trace minérale discrète.

#### Lot 15B — placement déterministe

| Aspect | Convention |
|--------|------------|
| Resolver | `DecorResolver.resolveDecor(visualSeed, worldX, worldY, type, neighborFloors)` |
| Seed | Client `DEFAULT_VISUAL_DECOR_SEED` (pas de seed serveur / DB) |
| Coords | **Monde** (pas locales chunk) — identique après unload/reload |
| Densité | Sparse (~80 %+ vide) ; boost léger racines/cailloux près des murs |
| Lifecycle | Création/destruction sprites avec le chunk ; textures atlas partagées intactes |

#### Lot 15C — polish

| Aspect | Convention |
|--------|------------|
| Densité | Zones larges vides + petits clusters (cellules 3×3, pas la grille chunk) |
| Bords | Plus de racines / cailloux près des murs et coins |
| Hiérarchie | void → ground → wallTop → wallFaces → décor → entities → lighting |
| Filon | Marqueur plus saturé / plus grand que tout décor |
| Champignons / traces | Ternes, rares, jamais lus comme loot |
| Mémoire | `pruneChunksOutside` à chaque changement de chunk AOI |
| Lumière | Flood-fill sol uniquement (ne traverse pas les murs) ; tops = noir opaque |

### Couches de rendu (cible)

```
(void clear #000)
→ ground → wallTop → wallFaces → decor → remotes → nodes → local player → effects
→ lighting overlay (obscurité + halo)
```

Dev terrain check : `/game?terrainTest=1` (couleurs debug C, lighting L).

---

## 8. Règles personnages

- Petit explorateur, silhouette immédiate
- **Casque + lampe frontale** obligatoires (pixel clair identifiable)
- Corps + jambes lisibles ; sac à dos optionnel
- Pas de détails minuscules inutiles
- Même sprite de base pour tous les joueurs au départ (teinte légère pour remotes uniquement)
- Pas de skins / cosmétiques / équipements visuels dans cette phase

### Character (Lot 14)

| Aspect | Convention |
|--------|------------|
| Silhouette | Casque → tête → corps → jambes ; footprint ≤ 1 tile |
| Palette | Casque beige (`#8A7A5C` / `#675942`), corps brun (`#6B523A`), pantalon `Rock 2`, bottes `Rock 0`, lampe `Lamp hot` |
| Casque | Bloc simple lisible à ×2 ; pas de détail excessif |
| Lampe | Cluster ivoire / ambre sur le casque (DOWN / profil) ; explique le halo Lot 13 |
| Proportions | Source **16×16**, affichage **×2** → 32×32 monde |
| Anchor | Pieds sur la position logique (`anchor 0.5, 1`) ; la caméra suit toujours la position logique |
| Animation | Idle 1 frame × 4 dirs ; walk 3 frames (cycle `0-1-2-1`) @ 8 fps |
| Direction | 4 facings ; RIGHT = mirror horizontal de LEFT (lampe devant, sac derrière) |
| Scaling | Entier uniquement (`CHARACTER_CONFIG.scale = 2`) |

Hiérarchie chromatique conservée : roche → sol → personnage → lumière → **trésor**.

Animations Lot 14 : idle + walk × 4 directions seulement (pas d’attaque / mine / scan).

---

## 9. Règles lumière

- Chaque joueur = halo **chaud** (ambre / jaune)
- Approximation graphique seulement (masque radial, anneaux quantifiés, overlay) — **pas** de raytracing
- Local joueur légèrement plus fort que les remotes
- Rendu stylisé / pixelisé : éviter le gradient photo-réaliste ultra-lisse
- La lumière **semble** venir de la lampe frontale
- Hors halo : proche du void (`#080908` / `#10110F`)

```
        sombre
     ░░░░░░░
   ░░░░░░░░░░░
  ░░░░░👤░░░░░
   ░░░░░░░░░░
     ░░░░░░
```

### Implémentation Lot 13

- `PlayerLightOverlay` — **calques d’obscurité à masque inverse** (union des cercles de lampe)
- Wash ambre au centre pour lire la lampe immédiatement
- `lightRings.ts` — rayons / forces (local vs remote)
- Historique : `erase` Pixi et lightmap canvas `destination-out` n’ont pas donné de halo fiable → masques inverses
- Pas d’occlusion murale (volontairement simple)
- HUD debug masqué par défaut ; **F3** pour basculer

---

## 10. Règles UI

- Mode normal : **minimaliste** (inventaire compact, prompt d’interaction, menu pause)
- Debug (connexion, ping, chunk, FPS, etc.) : **F3** / flag dev uniquement
- Pas de navigation « Accueil / Lot X » dans `/game` en immersion
- Typo : pixel lisible pour labels courts ; textes longs restent lisibles (pas de bitmap illisible)
- Excavation (Lot 17) : moment plein écran / quasi plein écran ; monde en second plan
- Prompts courts : ex. `[E] EXAMINER` — pas de `EXCAVATION NODE #382`

---

## 11. Motion & juice (principes, Lots 16–19)

- Animations **courtes** et satisfaisantes
- Scan = onde 400–700 ms environ
- Marteau = impact large ; pioche = précis
- Camera shake rare (marteau léger, effondrement plus fort)
- Juice OFF / ON doit rester confortable — jamais fatigant

---

## 12. Hors scope de cette phase visuelle

Pas de combat, bases, CTF, guildes, crafting, nouveaux systèmes réseau, biomes gameplay, progression.  
Idées futures → `docs/FUTURE_IDEAS.md` (créer si besoin), **ne pas implémenter**.

---

## 13. Critère de succès (Lot 20)

Un screenshot seul doit évoquer :

> « Un vrai jeu d’exploration souterraine pixel art »

et non :

> « Un POC technique dans un canvas »
