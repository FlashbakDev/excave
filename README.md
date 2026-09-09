# Excave

POC multijoueur 2D web : souterrain partagé, exploration, scan de filons, excavation, loot.

## Stack

pnpm monorepo · Nuxt 4 / Vue / PixiJS 8 · Fastify / Socket.IO · `@excave/shared` · Postgres optionnel

## Lancer

```bash
pnpm install
cp .env.example .env   # si besoin
docker compose up -d   # Postgres hôte :5433 (optionnel)
pnpm --filter @excave/shared build
pnpm dev
```

- Web : http://127.0.0.1:3000/game  
- API / Socket : http://127.0.0.1:3001  

Sans DB : serveur en seed + persistence mémoire.

```bash
pnpm typecheck && pnpm test && pnpm build
```

## Contrôles

| Input | Action |
| --- | --- |
| ZQSD / WASD / flèches | Déplacement |
| E / Espace | Scan puis démarrer excavation |
| F3 (dev) | HUD debug |
| 1 / 2 / 3 | Zoom pixel |

## Docs

| Fichier | Quand le lire |
| --- | --- |
| [docs/STATE.md](docs/STATE.md) | **Toujours en premier** (état réel) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tâche architecture / netcode |
| [docs/LOTS.md](docs/LOTS.md) | Checklist lots |
| [docs/FUTURE_IDEAS.md](docs/FUTURE_IDEAS.md) | Hors scope |
| [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md) / [PIXEL_ART.md](docs/PIXEL_ART.md) | Travail art |
