# Excave

POC d'un jeu multijoueur 2D web-first : souterrain persistant partagé, exploration par chunks, excavation archéologique.

## Stack

| Couche   | Techno |
| -------- | ------ |
| Monorepo | pnpm workspaces + TypeScript |
| Client   | Nuxt 4, Vue 3, PixiJS 8, Socket.IO client |
| Serveur  | Node.js, Fastify, Socket.IO, Drizzle ORM |
| Shared   | `@excave/shared` (types, constantes, événements) |
| DB       | PostgreSQL (Docker Compose) |

## Prérequis

- Node.js ≥ 22
- pnpm 10
- Docker (recommandé pour Postgres)

## Installation

```bash
pnpm install
cp .env.example .env   # si besoin
docker compose up -d
pnpm --filter @excave/shared build
```

## Développement

```bash
pnpm dev
```

- Web : http://127.0.0.1:3000
- API / Socket.IO : http://127.0.0.1:3001

Variables :

```bash
DATABASE_URL=postgresql://excave:excave@127.0.0.1:5433/excave
WORLD_SEED=excave-poc-seed-1
NUXT_PUBLIC_SOCKET_URL=http://127.0.0.1:3001
```

Postgres Docker écoute sur le port hôte **5433** (pour éviter le conflit avec un Postgres local sur 5432).

```bash
docker compose up -d
```

Sans DB joignable, le serveur démarre quand même en seed mémoire (log d’erreur + fallback).

## Vérifications

```bash
pnpm typecheck
pnpm test
pnpm build

curl http://127.0.0.1:3001/debug/world
curl http://127.0.0.1:3001/debug/chunk/0/0
```

## Contrôles (Lot 3)

Sur `/game` : ZQSD / WASD / flèches pour explorer localement (collision locale). Le HUD affiche `Chunk X:Y`.

## État actuel

**Lot 3 terminé** — monde déterministe chunké + persistence du seed. Pas encore de mouvement serveur-autoritaire (Lot 4).
