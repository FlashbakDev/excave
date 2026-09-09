# Excave — Current State

> Ce fichier est la source de vérité compacte pour les agents IA. Lire celui-ci en premier.

## Goal

POC multijoueur 2D web : souterrain partagé, exploration par chunks, scan de filons, mini-jeu d’excavation, loot persisté. Pas de combat / craft / comptes réels.

## Stack

| Couche | Techno |
| --- | --- |
| Monorepo | pnpm workspaces, TypeScript |
| Client | Nuxt 4, Vue 3, PixiJS 8, Socket.IO |
| Serveur | Fastify, Socket.IO, Drizzle |
| Shared | `@excave/shared` — constantes, `stepMovement`, DTOs, events |
| DB | PostgreSQL optionnel (Docker) ; fallback mémoire si absente |

## Gameplay

- Déplacement libre (ZQSD / WASD / flèches ; joystick dynamique mobile à droite)
- Scan `E` / Espace / bouton HUD (portée + cooldown) → détection filon
- Filon détecté à portée : tap/click sur la fissure → `excavation:start` (serveur autoritaire)
- Excavation grille 12×8 (pioche / marteau, couches, métal, stabilité) — UI Lot 17A/B look « kit » (cadre bois, dalles fissurées, HUD badges)
- Loot → inventaire `Nom ×N`
- Guest `playerId` repris via `localStorage` + `socket.auth`

## World

| Constante | Valeur | Fichier |
| --- | --- | --- |
| `TILE_SIZE` | 32 | `packages/shared/src/constants.ts` |
| `CHUNK_SIZE` | **16** | idem |
| `WORLD_ROOM_PERIOD` | 16 | idem |
| `AOI_RADIUS` | 1 → voisinage 3×3 | idem |
| `DEFAULT_WORLD_ID` | `"main"` | idem |
| Seed | `WORLD_SEED` / défaut `excave-poc-seed-1` | serveur |

Générateur déterministe salles/couloirs. Streaming chunks via `world:chunkRequest`. Tuile absente côté client = mur.

## Networking

| Élément | Réel |
| --- | --- |
| Input client | Batches `player:input` : `{ movementEpoch, commands[] }` à ~20 Hz d’envoi |
| Commandes | Pas fixe **60 Hz** (`MOVEMENT_COMMAND_HZ`) |
| Sim serveur | **20 Hz** pas fixe + accumulateur / catch-up borné (`GameLoop`) |
| Broadcast | **10 Hz** `player:state` filtré AOI |
| Autorité | Serveur ; client n’envoie jamais une position absolue |
| Prédiction | `LocalMovementController` — sim locale + journal |
| Reconciliation | Reset à l’ack + **replay** des commandes non acquittées |
| Ack | `lastProcessedSequence` + `lastProcessedTick` + `movementEpoch` |
| Anti-abus | File serveur bornée + crédit temporel |
| Remotes | `RemoteSnapshotBuffer` — délai adaptatif, extrapolation bornée |
| Vélocité | Déduite du déplacement réel (pas le vecteur demandé si mur) |
| Reconnect | Grace ~15 s ; idle forcé ; même epoch/position si reprise |

Fichiers clés : `LocalMovementController.ts`, `PlayerRuntimeStore.ts`, `GameLoop.ts`, `playerPayloads.ts`.

## Rendering

- Pixi 8, art source 16×16, display ×2, zoom entier 1/2/3
- Sol variants déterministes ; murs `wallTop` + falaise sud `wall_face_s` seulement (pas de lèvres E/W)
- Décor sparse (`DecorResolver`)
- Lampe Lot 13 présente mais **off par défaut** (`lightingEnabled = false`)
- Scan pulse Lot 16A : onde ambre pixel-art ~550 ms au press (`ScanPulseEffect`) + bouton HUD cooldown
- Filons Lot 16B/C : signal mural (`ExcavationNodeView`) ; tap/click à portée (~48 CSS px) ; mobile-first
- F3 (dev) : HUD debug mouvement

## Excavation

- Nodes sur murs ; secrets (seed/trésors) **server-only**
- Sessions autoritaires : hits, cooldown, collapse / completed
- UI : overlay 17A + juice 17B + look kit (dalles gris/beige + fissures + terre, cadre bois, outils SVG colorés)
- Fin → finalize atomique + `inventory:update`

## Persistence

- Tables : `worlds`, `players`, `excavation_nodes`, `player_items`, `excavation_history`
- `PersistenceStore` : Postgres ou Map mémoire
- Loot + nodes `DEPLETED` hydratés au boot ; position runtime non persistée hors grace reconnect

## Completed

POC gameplay Lots 0–9 · Visuel 10–15 + relief murs · Netcode mouvement production (prediction/replay) · Scan/filons 16A–C · Excavation UI 17A + juice 17B

## Next

1. **Lot 17C** — collapse / fin de session polish
2. **Lot 18** — HUD / inventaire propre
3. **Lot 19** — juice léger

Détail checklist : [LOTS.md](./LOTS.md)

## Known limits

- Guest only ; pas d’auth réelle
- Position perdue après expiration grace reconnect → respawn monde
- Un monde / un process
- Overlay excavation 17A mobile-first + juice coups 17B ; inventaire encore brut
- Docs spécialisées art : [ART_DIRECTION.md](./ART_DIRECTION.md), [PIXEL_ART.md](./PIXEL_ART.md)
- Idées hors scope : [FUTURE_IDEAS.md](./FUTURE_IDEAS.md)
