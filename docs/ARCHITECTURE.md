# Excave — Architecture

> Lire uniquement si la tâche touche à l’architecture. État courant : [STATE.md](./STATE.md).

## Packages

| Path | Rôle |
| --- | --- |
| `apps/web` | Nuxt / Vue / Pixi, session Socket.IO, HUD, overlay excavation |
| `apps/server` | Fastify HTTP + Socket.IO, sim, monde, excavation, persistence |
| `packages/shared` | Constantes, `stepMovement` / `canOccupy`, AOI helpers, events + DTOs publics |

## Client (`apps/web`)

| Zone | Path |
| --- | --- |
| Canvas | `app/components/GameCanvas.client.vue` |
| Session | `app/composables/useGameSession.ts` |
| Rendu | `app/game/renderer/{GameRenderer,WorldContainer,Camera}.ts` |
| Mouvement local | `app/game/renderer/LocalMovementController.ts` |
| Remotes | `app/game/renderer/RemoteSnapshotBuffer.ts` |
| Visuel local | `app/game/renderer/VisualPositionSmoother.ts` |
| Terrain | `app/game/world/TileVariantResolver.ts` |
| Décor | `app/game/environment/*` |
| Personnage | `app/game/characters/*` |
| Lumière | `app/game/lighting/*` |
| Excavation UI | `app/components/excavation/*` |

Flux tick local : input → commandes 60 Hz → predire → batch `player:input` → sur snapshot : reset auth + replay → rendu (caméra sur pose visuelle).

## Serveur (`apps/server`)

| Zone | Path |
| --- | --- |
| Bootstrap | `src/app.ts`, `src/index.ts` |
| Socket | `src/realtime/socket.ts` |
| Sessions guest | `src/session/PlayerRegistry.ts` |
| Runtime joueurs | `src/player/{PlayerRuntimeStore,GameLoop,PlayerRuntimeState}.ts` |
| Monde | `src/world/{WorldManager,generator,ChunkManager}.ts` |
| AOI | `src/aoi/AreaOfInterestManager.ts` |
| Filons / excav | `src/excavation/*` |
| DB | `src/db/{schema,PersistenceStore,migrate,worldBootstrap}.ts` |

`GameLoop` : accumulateur mur → ticks `1/SIM_TICK_HZ` → broadcast AOI.  
`PlayerRuntimeStore` : file de commandes ordonnée, crédit anti-speedhack, ack exact.

## Monde / chunks

- Tile logique : FLOOR / WALL
- Chunks `CHUNK_SIZE²` tiles ; rooms Socket `world:{id}:chunk:{x}:{y}`
- Génération pure seed + coords monde (frontières cohérentes)
- Client stream 3×3 ; prune hors AOI

## Réseau (events)

### HTTP debug

`/health`, `/debug/players`, `/debug/world`, `/debug/chunk/:x/:y`, `/debug/nodes/:x/:y`, `/debug/inventory/:playerId`

### Socket

| Dir | Event | Rôle |
| --- | --- | --- |
| S→C | `session:ready` | `playerId`, inventory |
| C↔S | `session:ping` / `pong` | RTT |
| C→S | `world:join` | entrer `main` |
| S→C | `world:joined` | spawn, chunks, `movementEpoch`, `lastProcessedSequence` |
| C→S | `world:chunkRequest` | chunks manquants |
| S→C | `world:chunks` | payloads tiles |
| C→S | `player:input` | `{ movementEpoch, commands[] }` |
| S→C | `player:state` | snapshot AOI |
| C→S | `player:scan` | scan |
| S→C | `player:scanned` / `scanRejected` | feedback / cooldown |
| S→C | `node:detected` / `node:updated` | filons |
| C→S | `excavation:start` / `hit` | mini-jeu |
| S→C | `excavation:started` / `update` / `rejected` | session |
| S→C | `inventory:update` | loot |

DTOs : `packages/shared/src/net/*`. Secrets excavation jamais dans les DTO publics.

## Excavation

1. Nodes générés / hydratés (`ExcavationNodeManager`)
2. Scan → détection publique
3. Start → session (`ExcavationSessionManager`) + grille visible
4. Hits autoritaires (`ExcavationHitResolver`)
5. End → `PersistenceStore.finalizeExcavation` (history unique + items + node depleted)

## Persistence

- Drizzle + SQL migrations sous `apps/server/drizzle/`
- Sans DB : seed monde + inventaire / history en mémoire
- Guest resume : `socket.auth.playerId` si libre

## Invariants (ne pas casser)

- Serveur autoritaire
- Input-only (pas de position client)
- Prediction + replay
- AOI chunks
- Secrets excav server-only
