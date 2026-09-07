# Excave — Architecture (Lot 3)

## Vue d'ensemble

- `apps/web` — Nuxt / Vue / Pixi + session Socket.IO
- `apps/server` — Fastify + Socket.IO + monde déterministe
- `packages/shared` — constantes (`TILE_SIZE`, `CHUNK_SIZE`), tiles, DTOs, événements
- PostgreSQL — table `worlds` (id, seed, createdAt)

## Client

Vue : HUD (connexion, player, ping, chunk X:Y).
Pixi : rendu des chunks reçus (FLOOR/WALL), bordures debug, joueur local.
Exploration locale ZQSD/WASD (pas encore autoritaire — Lot 4).

## Serveur

### Monde

- `WorldManager` / `ChunkManager` / `Chunk`
- Générateur pur : `tileTypeAt(seed, worldTileX, worldTileY)` (pièces + couloirs)
- Border-safe : décisions en coordonnées monde
- Tiles non stockés en base (reproductibles depuis le seed)

### Persistence

Table `worlds` uniquement. Seed figé au premier boot (`WORLD_SEED` ou défaut).

### Réseau

- `world:join` → `world:joined` (spawn + 3×3 chunks)
- `world:chunkRequest` → `world:chunks`

## Lots suivants

Lot 4 : déplacement serveur-autoritaire.
Lot 5 : AOI / rooms Socket.IO.
