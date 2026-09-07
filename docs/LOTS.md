# Excave — Spécification complète des lots (reprise)

Document de reprise pour continuer le POC sur une autre machine.

**Dernière progression connue :** LOT 3 terminé. Prochain lot à faire : **LOT 4**.

Boucle POC à valider au lot 9 :

```
EXPLORER → TROUVER UN FILON → INTERAGIR → EXCAVER
→ DÉCOUVRIR UN OBJET → TERMINER L'EXCAVATION → RECEVOIR LE LOOT
```

---

## 0. Méthode de travail (obligatoire)

Réaliser le projet **lot par lot**.

À la fin de chaque lot :

1. Terminer complètement le lot
2. Lancer les tests (`pnpm test`)
3. Lancer le typecheck (`pnpm typecheck`)
4. Vérifier le build (`pnpm build`)
5. Corriger les erreurs
6. Mettre à jour `README.md`
7. Mettre à jour `docs/ARCHITECTURE.md` / `docs/PROTOCOL.md` / `docs/POC.md` si besoin
8. Faire un compte rendu
9. **STOPPER** et attendre que l’humain dise explicitement `continue`

Ne jamais coder d’avance les fonctionnalités des lots futurs. Interfaces/extensions raisonnables OK, implémentation non.

Chaque compte rendu doit contenir :

- ce qui a été créé
- fichiers principaux
- choix techniques
- comment lancer/tester
- vérifications manuelles
- limitations connues
- lot suivant prévu

---

## 1. Concept

Jeu multijoueur 2D web-first dans un **immense souterrain partagé**.

Monde persistant et commun :

- tous les joueurs d’un même serveur sont dans le même monde
- découpage technique en **chunks**
- chaque joueur ne reçoit que chunks + entités proches
- filons / zones d’excavation sur certains murs
- détection puis mini-jeu d’excavation (couches, outils, stabilité, loot)

### Hors scope POC (ne pas implémenter)

Bases, capture de drapeau, guildes, combat, PvP, crafting, économie, marché, boutique, quêtes, progression, niveaux, équipement avancé, PNJ, chat, amis, matchmaking, Redis, Kubernetes, microservices, auth complète, PWA offline, push notifications.

---

## 2. Stack imposée

### Monorepo

- pnpm workspaces
- TypeScript strict

Structure :

```
/
  apps/
    web/
    server/
  packages/
    shared/
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  README.md
  docs/
```

### Client (`apps/web`)

- Nuxt 4, Vue 3, TypeScript, PixiJS 8
- Vue : pages, HUD, menus, overlays, excavation UI, inventaire minimal, connexion
- Pixi : rendu monde uniquement (tiles, chunks, joueurs, filons visibles, effets, caméra)

### Serveur (`apps/server`)

- Node.js, TypeScript, Fastify, Socket.IO
- **Même serveur HTTP** pour Fastify et Socket.IO
- Serveur **autoritaire** (position, collisions, filons, excavation, loot)

### Shared (`packages/shared`)

Uniquement :

- types publics
- DTO
- événements réseau
- constantes non sensibles

**Interdit** : algorithmes secrets d’excavation / placement de trésors.

### Base

- PostgreSQL
- Drizzle ORM + Drizzle Kit
- Stocker seulement ce qui doit survivre au redémarrage
- Ne pas écrire chaque frame en base

### Scripts racine attendus

```bash
pnpm dev
pnpm dev:web
pnpm dev:server
pnpm build
pnpm typecheck
pnpm test
```

---

## 3. Principes d’architecture

### Un seul monde, découpé en chunks

Exemple autour du joueur :

```
[-1,-1] [0,-1] [1,-1]
[-1, 0] [0, 0] [1, 0]
[-1, 1] [0, 1] [1, 1]
```

Rooms Socket.IO = canaux d’abonnement, **pas** des parties indépendantes :

```
world:main:chunk:X:Y
```

Exemple : `world:main:chunk:12:18`

### Sécurité excavation

Les trésors cachés **ne doivent jamais** être dans le bundle web ni envoyés avant découverte.

Interdit :

```json
{ "treasures": [{ "type": "rare_gem", "x": 7, "y": 3 }] }
```

Acceptable : deltas visibles seulement (`remainingRock`, `revealed` quand visible, etc.).

### Qualité

Préférer : modules courts, responsabilités claires, fonctions pures pour la génération, types stricts, constantes centralisées.

Éviter : ECS prématuré, DI framework, Pinia/Redux sans besoin, Redis, microservices, over-engineering.

Architecture minimale :

```
WORLD → CHUNKS → PLAYERS → NODES → EXCAVATIONS
```

---

## 4. Reprise sur une autre machine

### Prérequis

- Node.js ≥ 22
- pnpm 10
- Docker (Postgres)

### Bootstrap

```bash
git clone <repo>
cd excav
pnpm install
cp .env.example .env
docker compose up -d
pnpm --filter @excave/shared build
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

### URLs / ports actuels

| Service | URL |
| ------- | --- |
| Web | http://127.0.0.1:3000 |
| API / Socket.IO | http://127.0.0.1:3001 |
| Postgres (Docker hôte) | `127.0.0.1:5433` → container `5432` |

### `.env` typique

```bash
DATABASE_URL=postgresql://excave:excave@127.0.0.1:5433/excave
WORLD_SEED=excave-poc-seed-1
NUXT_PUBLIC_API_BASE=http://127.0.0.1:3001
NUXT_PUBLIC_SOCKET_URL=http://127.0.0.1:3001
```

Note : le port hôte Postgres est **5433** pour éviter les conflits avec un Postgres local sur 5432. Si la DB est injoignable, le serveur fallback en seed mémoire (log + continue).

### Où en est le code (après LOT 3)

Présent :

- monorepo pnpm
- Nuxt 4 + Pixi scène `/game`
- Socket.IO session invité + ping HUD
- monde déterministe chunks FLOOR/WALL
- table `worlds` (id, seed, createdAt)
- events `world:join` / `world:joined` / `world:chunkRequest` / `world:chunks`
- exploration locale ZQSD/WASD (collision locale uniquement)

Pas encore :

- mouvement serveur-autoritaire (LOT 4)
- voir les autres joueurs / AOI (LOT 5)
- filons, excavation, loot (LOTS 6–9)

### Pour continuer

Dire à l’agent : **`continue`** → il doit enchaîner uniquement sur le **LOT 4**.

Docs liées :

- `docs/POC.md` — checklist cochée
- `docs/ARCHITECTURE.md` — architecture actuelle
- `docs/PROTOCOL.md` — événements réseau

---

## LOT 0 — Initialisation du monorepo

**Statut : FAIT**

### Objectif

Monorepo propre qui démarre.

### Créer

- `apps/web`, `apps/server`, `packages/shared`
- pnpm workspace, TypeScript, scripts racine
- Docker Compose Postgres uniquement (pas Redis)

### `apps/web`

Nuxt 4 minimal :

- `/` : titre + bouton « Entrer dans le souterrain »
- `/game` : vide au départ

### `apps/server`

Fastify :

- `GET /health` → `{ "status": "ok" }`

### `packages/shared`

Types génériques seulement, ex. :

- `WorldId`, `PlayerId`
- `WorldPosition`, `ChunkCoordinate`, `TileCoordinate`
- Aucune logique métier

### Validation

```bash
pnpm install
pnpm dev
# ouvrir web, appeler /health, build, typecheck
```

---

## LOT 1 — Intégration PixiJS

**Statut : FAIT**

### Objectif

Scène Pixi dans `/game`.

### Exigences

- Composant type `GameCanvas` (client-only, SSR-safe)
- Cycle : mount → `Application.init` → canvas → scène → unmount → destroy propre
- Resize viewport
- Classes : `GameRenderer`, `Camera`, `WorldContainer`
- Afficher : fond sombre, grille debug, personnage cercle, coords, FPS en dev
- Personnage encore local
- Pas de réseau mouvement, pas de map procédurale, pas d’assets finaux

### Validation

- Pas d’erreur SSR
- Resize propre
- Pas de duplication de ticker après navigation
- Build + typecheck OK

---

## LOT 2 — Temps réel et session joueur temporaire

**Statut : FAIT**

### Objectif

Socket.IO sur le même HTTP que Fastify + session invité.

### Exigences

- Interfaces TypeScript partagées pour events (pas de strings dispersées)
- Guest : serveur génère `playerId` UUID (pas d’auth)
- HUD : Connexion OK / Player / Ping
- Disconnect : cleanup runtime, rien de critique persisté
- Endpoint debug joueurs connectés utile en dev

Exemple de forme :

```ts
interface ServerToClientEvents {
  "session:ready": (...)
}
interface ClientToServerEvents {
  "session:ping": (...)
}
```

### Validation

Deux onglets → deux `playerId` distincts. Déconnexion/reconnexion propre.

---

## LOT 3 — Modèle de monde et chunks

**Statut : FAIT**

### Objectif

Premier souterrain commun déterministe.

### Constantes (centralisées, shared)

Proposition :

- `TILE_SIZE = 32` pixels
- `CHUNK_SIZE = 32` tiles

### Serveur

Créer : `WorldManager`, `ChunkManager`, `Chunk`, `Tile`

Types min : `FLOOR`, `WALL`

- `worldId = "main"`
- génération déterministe : `WORLD_SEED + chunkX + chunkY`
- frontières de chunks cohérentes
- galeries / pièces / passages (algo simple et robuste)

### Persistence

Table `worlds` :

- `id`
- `seed`
- `createdAt`

Ne pas stocker tous les tiles s’ils sont reproductibles depuis le seed.

### Client (réalisé pour validation)

- Rendu des chunks reçus
- Debug `Chunk X:Y` + bordures
- Exploration locale temporaire pour traverser les chunks

### Réseau ajouté

- `world:join` → `world:joined` (spawn + voisinage 3×3)
- `world:chunkRequest` → `world:chunks`

### Validation

- Restart serveur → map identique
- Changer `WORLD_SEED` → map change
- Traverser plusieurs chunks → pas de murs incohérents aux frontières

---

## LOT 4 — Déplacement serveur-autoritaire

**Statut : À FAIRE (prochain)**

### Objectif

Le serveur est l’autorité sur les déplacements.

### Inputs client (pas une position arbitraire)

```ts
input {
  up, down, left, right, sequence
}
```

### Serveur

`PlayerRuntimeState` : `position`, `velocity`, `currentChunk`

Tick configurable, suggestion :

- simulation **20 Hz**
- broadcast **10 Hz**

Le serveur :

- applique vitesse
- valide collisions `WALL`
- calcule position / chunk
- diffuse l’état

### Client

- capture clavier (ZQSD, WASD, flèches)
- abstraction prête pour joystick mobile plus tard
- envoie inputs
- affiche positions serveur
- interpole les autres joueurs
- prédiction locale simple OK si nécessaire (pas de rollback/netcode complexe)

### Caméra

Suit le joueur local, **pas** couplée directement au réseau.

### Validation

- Impossible de traverser un mur
- Modifier la position côté client ne téléporte pas réellement le joueur

### Remarque reprise

Aujourd’hui le client a encore un mouvement **local** Lot 3. Le Lot 4 doit le remplacer / le subordonner à l’autorité serveur.

---

## LOT 5 — Multijoueur localisé / Area of Interest

**Statut : À FAIRE**

### Objectif

Deux joueurs se voient s’ils sont proches.

### Créer

`AreaOfInterestManager`

Quand le joueur est dans chunk `X:Y` :

- subscribe rooms des chunks autour
- rayon défaut : **1** → grille 3×3
- au changement de chunk : `roomsToJoin` / `roomsToLeave` (pas de leave/join inutiles)

### Diffusion

- Events joueurs uniquement aux concernés
- **Éviter** `io.emit(...)` global pour le monde
- Utiliser rooms de chunk

### Affichage

Autres joueurs : cercle + pseudo temporaire / `playerId` court

Debug optionnel : chunk courant, entités visibles, rooms suivies

### Validation

- Proches → se voient
- Très éloignés → plus d’updates mutuelles
- Vérifier AOI dans logs/devtools

### Remarque

C’est à ce lot que « je ne vois pas l’autre joueur » devient un bug s’il persiste. Avant le lot 5, c’est **normal**.

---

## LOT 6 — Filons et détection

**Statut : À FAIRE**

### Objectif

Points d’excavation = entités serveur.

### `ExcavationNode` (concept)

```
id, worldId, chunkX, chunkY, tileX, tileY, wallSide, seed, status
```

Statuses min : `AVAILABLE` | `IN_PROGRESS` | `DEPLETED`

- Uniquement sur `WALL` accessible depuis un `FLOOR` voisin
- Client reçoit seulement `{ nodeId, position, visualState }` (pas le contenu)

### Génération

0–3 filons déterministes par chunk (`worldSeed`, chunk, `nodeSeed`)

### Détection

- Action `SCAN` (desktop : `E` ou `Space`)
- Serveur vérifie rayon
- Si proche : `node:detected`
- Client : scintillement / marque / message « Quelque chose semble être enfoui ici »
- Puis `E` → `excavation:start`
- Serveur valide : node existe, `AVAILABLE`, portée, monde

### Concurrence

- Une excavation active max par filon
- `AVAILABLE` → `IN_PROGRESS` + `activePlayerId`
- Timeout/nettoyage si déconnexion
- Pas de coopération

### Validation

Deux joueurs sur le même filon → un seul obtient la session.

---

## LOT 7 — Interface du mini-jeu d’excavation

**Statut : À FAIRE**

### Objectif

Overlay Vue au-dessus du monde (pas une nouvelle page). Déplacement bloqué.

Exemples :

- `components/excavation/ExcavationOverlay.vue`
- `ExcavationGrid.vue`
- `ExcavationToolbar.vue`
- `ExcavationStability.vue`

Rendu Vue/CSS/Canvas OK. Pixi **pas obligatoire** ici.

### Grille

Proposition : 12×8

Niveaux de roche visibles (ex. 4 → 0), mais le client ne connaît que ce que le serveur autorise.

### Outils

- **PIOCHE** : petite zone, peu de dégâts stabilité, précise
- **MARTEAU** : zone large, plus de dégâts, prospection

Kernels configurables côté serveur, ex. :

```
PICKAXE     HAMMER
  1         1 2 1
1 3 1       2 4 2
  1         1 2 1
```

### Stabilité

`stability` / `maxStability` + jauge. À 0 → effondrement.

### Feedback

Impact, vibration optionnelle, poussière simple, son placeholder optionnel, fissures.

### Responsive

Souris + tactile, desktop + smartphone portrait.

### STOP

Après interface branchée à des réponses serveur simples (moteur complet = Lot 8).

---

## LOT 8 — Moteur d’excavation autoritaire

**Statut : À FAIRE (lot le plus important)**

### Objectif

Mini-jeu réellement serveur.

Créer **server-only** :

- `ExcavationManager`
- `ExcavationSession`
- `ExcavationGenerator`
- `ExcavationHitResolver`
- `TreasureCatalog`

### Session

Au start : seed du node génère profondeur, obstacles, trésors, positions, rotations éventuelles.

**Jamais** envoyer la map complète des secrets au client.

### Trésors POC (~10)

Minéraux : quartz, améthyste, pyrite  
Gemmes : rubis brut, saphir brut  
Fossiles : ammonite, dent fossilisée, trilobite  
Artefacts : pièce antique, fragment de statuette  

Raretés : `COMMON` | `UNCOMMON` | `RARE` | `EPIC`

Formes grille + rotations si simple. 2–4 trésors/excavation, pas de chevauchement, reproductible.

### Obstacles métalliques

Cellules incassables, révélées quand visibles. Ne pas rendre les trésors systématiquement impossibles.

### Hit

Client :

```ts
excavation:hit { sessionId, x, y, tool }
```

Serveur valide : session, ownership, ACTIVE, coords, outil, cooldown, stabilité > 0  
Puis applique kernel → deltas seulement :

```ts
excavation:update {
  changedCells,
  stability,
  newlyRecoveredTreasures,
  status
}
```

### Récupération

Trésor récupéré quand **toutes** ses cellules sont dégagées → message + affichage complet.

### Fin

- `stability <= 0` → `COLLAPSED` ; loot déjà récupéré conservé ; autres perdus ; node `DEPLETED`
- Tous trésors récupérés → `COMPLETED` ; node `DEPLETED`

---

## LOT 9 — Persistence du loot et fin du POC

**Statut : À FAIRE**

### Tables min

- `worlds`
- `players`
- `excavation_nodes`
- `player_items`
- `excavation_history`

`player_items` simple : `playerId`, `itemType`, `quantity`  
Pas d’équipement / poids / slots / drag & drop / marché.

### Fin d’excavation

Transaction Postgres atomique :

- état final du node
- historique
- attribution trésors
- fin de session

### UI

Petit panneau inventaire :

```
Quartz x3
Améthyste x1
Ammonite x1
```

### Tests indispensables

- Même seed → même excavation
- Placement dans la grille, sans chevauchement
- Hits pioche/marteau attendus
- Stabilité diminue
- Découverte seulement si toutes cellules dégagées
- Collapse : partiel non attribué ; déjà récupéré conservé
- Sécurité : position trésor caché absente des DTO publics
- Concurrence : pas de double attribution du même loot

### Critères de fin POC (checklist manuelle)

1. Lancer le projet  
2. Deux navigateurs  
3. Même souterrain  
4. Se voir si proches  
5. Marcher plusieurs chunks  
6. Bloqué par murs  
7. Scanner  
8. Découvrir filon  
9. S’approcher  
10. Lancer excavation  
11. Pioche + marteau  
12. Roche progressive  
13. Morceaux de trésors  
14. Stabilité ↓  
15. Dégager un trésor  
16. Le recevoir  
17. (option) Effondrement  
18. Quitter overlay  
19. Filon épuisé  
20. Loot en inventaire  
21. Restart serveur  
22. Monde + loot persistants  

Après le lot 9 : **STOP du travail actuel**. Ne pas commencer bases / CTF / guildes / combat / économie / progression.

---

## Annexe A — Constantes actuelles (Lot 3)

Dans `@excave/shared` :

- `TILE_SIZE = 32`
- `CHUNK_SIZE = 32`
- `DEFAULT_WORLD_ID = "main"`
- `WORLD_ROOM_PERIOD = 16` (générateur pièces/couloirs)

Tiles publics : `FLOOR = 0`, `WALL = 1`

---

## Annexe B — Événements réseau déjà en place (Lots 2–3)

### HTTP

| Méthode | Chemin | Rôle |
| ------- | ------ | ---- |
| `GET` | `/health` | santé (+ `worldId`) |
| `GET` | `/debug/players` | sessions connectées |
| `GET` | `/debug/world` | seed, spawn, constantes |
| `GET` | `/debug/chunk/:x/:y` | payload chunk |

### Socket.IO

| Direction | Event | Rôle |
| --------- | ----- | ---- |
| S→C | `session:ready` | `playerId` UUID |
| C→S | `session:ping` | latence |
| S→C | `session:pong` | latence |
| C→S | `world:join` | entrer dans `main` |
| S→C | `world:joined` | spawn + chunks 3×3 |
| C→S | `world:chunkRequest` | chunks manquants |
| S→C | `world:chunks` | payloads tiles |

À ajouter aux lots suivants : inputs, snapshots, AOI, nodes, excavation hits/updates, inventaire.

---

## Annexe C — Fichiers clés actuels

```
apps/web/
  app/pages/index.vue
  app/pages/game.vue
  app/components/GameCanvas.client.vue
  app/composables/useGameSession.ts
  app/game/renderer/{GameRenderer,Camera,WorldContainer}.ts

apps/server/
  src/app.ts
  src/index.ts
  src/realtime/socket.ts
  src/session/PlayerRegistry.ts
  src/world/{generator,Chunk,ChunkManager,WorldManager}.ts
  src/db/{schema,client,worldBootstrap}.ts

packages/shared/
  src/constants.ts
  src/ids.ts
  src/world/{tiles,chunk}.ts
  src/net/{events,payloads,worldPayloads}.ts
```

---

*Fin du document de reprise. Mettre à jour la section « Dernière progression connue » et `docs/POC.md` à chaque lot terminé.*
