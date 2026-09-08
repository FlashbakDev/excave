# Excave — Protocole réseau

## HTTP

| Méthode | Chemin | Réponse |
| ------- | ------ | ------- |
| `GET` | `/health` | `{ status, worldId }` |
| `GET` | `/debug/players` | sessions + AOI |
| `GET` | `/debug/world` | seed, spawn |
| `GET` | `/debug/chunk/:x/:y` | tiles |
| `GET` | `/debug/nodes/:x/:y` | filons (sans seed) |
| `GET` | `/debug/inventory/:playerId` | inventaire public |

## Handshake guest (Lot 9)

Socket.IO `auth: { playerId? }` — reprise d’un UUID déjà connu s’il n’est pas connecté.

`session:ready` : `{ playerId, serverTime, inventory[] }`

## Events excavation (Lots 6–8)

### Client → Server

| Événement | Payload |
| --------- | ------- |
| `player:scan` | `{ clientTime? }` |
| `excavation:start` | `{ nodeId }` |
| `excavation:hit` | `{ sessionId, x, y, tool }` |

### Server → Client (scan)

| Événement | Payload |
| --------- | ------- |
| `player:scanned` | `{ position, rangePx, detected }` — zone touchée |
| `player:scanRejected` | `{ reason: "cooldown", remainingMs }` |
| `node:detected` | filon scanné |

### Server → Client (excavation / inventaire)

| Événement | Payload |
| --------- | ------- |
| `node:updated` | état public filon |
| `excavation:started` | grille visible + `treasureCount` |
| `excavation:rejected` | raison |
| `excavation:update` | deltas + loot récupéré |
| `inventory:update` | `{ items: [{ type, rarity, name, quantity }] }` |

Fin d’excavation (`COMPLETED` / `COLLAPSED`) → persistence atomique puis `inventory:update`.

## Autres events

Lots 2–5 : `session:*`, `world:*`, `player:input` / `player:state`, rooms AOI.
