# Excave — Protocole réseau

## HTTP

| Méthode | Chemin | Réponse |
| ------- | ------ | ------- |
| `GET` | `/health` | `{ status, worldId }` |
| `GET` | `/debug/players` | joueurs connectés |
| `GET` | `/debug/world` | seed, spawn, constantes |
| `GET` | `/debug/chunk/:x/:y` | payload chunk |

## Socket.IO

Constantes : `ServerToClientEvent` / `ClientToServerEvent` (`@excave/shared`).

### Server → Client

| Événement | Payload |
| --------- | ------- |
| `session:ready` | `{ playerId, serverTime }` |
| `session:pong` | `{ clientTime, serverTime }` |
| `world:joined` | `{ worldId, spawn, chunks[] }` |
| `world:chunks` | `{ worldId, chunks[] }` |

`ChunkPayload` : `{ worldId, chunk:{x,y}, tiles:number[] }` (row-major, `CHUNK_SIZE²`, `0=FLOOR` `1=WALL`).

### Client → Server

| Événement | Payload |
| --------- | ------- |
| `session:ping` | `{ clientTime }` |
| `world:join` | `{ worldId? }` |
| `world:chunkRequest` | `{ worldId, chunks:[{x,y}] }` |
