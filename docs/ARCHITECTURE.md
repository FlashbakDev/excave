# Excave — Architecture (Lot 9)

## Vue d'ensemble

- `apps/web` — Nuxt / Vue / Pixi + overlay excavation + inventaire
- `apps/server` — Fastify + Socket.IO + monde + AOI + filons + excavation + **persistence loot**
- `packages/shared` — DTOs publics uniquement
- PostgreSQL — `worlds`, `players`, `excavation_nodes`, `player_items`, `excavation_history`

## Persistence (Lot 9)

`PersistenceStore` :

- upsert joueur guest
- transaction fin d’excavation : historique (unique `session_id`) + incrément items + node `DEPLETED`
- hydratation des filons épuisés au démarrage
- fallback mémoire si pas de DB (tests / offline)

Identité guest : client stocke `excave.guestPlayerId` et le renvoie via `socket.auth.playerId`.

## Client

- `InventoryPanel` (liste `Nom xN`)
- `session:ready.inventory` + `inventory:update`

## Serveur excavation

Inchangé Lot 8 (générateur / hits / secrets) + finalize persistée à la fin de session.
