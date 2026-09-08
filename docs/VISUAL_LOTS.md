# Excave — Lots visuels (10–20)

Phase **identité visuelle**. Aucun nouveau gameplay.  
Références : [ART_DIRECTION.md](./ART_DIRECTION.md) · [PIXEL_ART.md](./PIXEL_ART.md)

Règle : **ne jamais enchaîner automatiquement** le lot suivant. Attendre `continue`.

## Checklist

- [x] **LOT 10** — Direction artistique  
      Docs vision / palette / règles. Aucun gros refactor rendu.
- [x] **LOT 11** — Pipeline pixel art  
      Nearest-neighbor, zoom 1×/2×/3×, `GameAssets`, placeholders 16×16.
- [x] **LOT 12** — Sol et murs  
      Tileset minimal, variants déterministes, autotiling simple, relief.
- [x] **LOT 13** — Lumière et obscurité  
      Halo lampe (local + remotes), obscurité stylisée.
- [x] **LOT 14** — Personnage  
      Explorateur casque/lampe, idle/walk 4 directions.
- [x] **LOT 15** — Vie environnementale  
      Décor sparse déterministe, couches de rendu.
  - [x] **LOT 15A** — Assets environnement  
        Atlas `cave_decor` (pierres, cailloux, fissures, poussière, racines, champignons, murs, traces minérales). Pas de placement.
  - [x] **LOT 15B** — Placement décor  
        `DecorResolver` déterministe, couches `groundDecor` / `wallDecor` / `foregroundDecor`, lifecycle chunk.
  - [x] **LOT 15C** — Polish environnement  
        Densité/clusters, hiérarchie visuelle, prune AOI, contraste décor vs joueur/filon.
- [x] **LOT murs 3D** — Relief top-down + autotiling  
      `wall_top` / `wall_face` / void, `resolveTerrainPlacements`, layers Pixi.
- [ ] **LOT 16** — Scanner et filons  
      Onde de scan, scintillement, prompt `[E] EXAMINER` (logique serveur intacte).
- [ ] **LOT 17** — Excavation  
      Overlay immersif, roche pixel, feedback outils, révélation trésor, stabilité.
- [ ] **LOT 18** — HUD et interface  
      Debug F3, inventaire compact, menu, plus de chrome POC.
- [ ] **LOT 19** — Juice et polish  
      Particules légères, shake, transitions — parcimonie.
- [ ] **LOT 20** — Validation visuelle  
      Vertical slice ~1 min, desktop + mobile, critère « vrai jeu ».

## Contraintes transverses

- Toucher surtout `apps/web` + assets.
- Logique serveur / protocole / chunks / AOI / DB / excavation engine : **intacts** sauf justification explicite.
- Idées hors scope → `docs/FUTURE_IDEAS.md` (pas d’implémentation).
