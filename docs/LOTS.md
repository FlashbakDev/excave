# Excave — Lots

> Checklist compacte. État détaillé : [STATE.md](./STATE.md). Méthode : un lot à la fois ; attendre `continue` avant le suivant.

## Méthode

1. Finir le lot · 2. `pnpm test` / `typecheck` / `build` · 3. MAJ `STATE.md` + ce fichier · 4. Compte rendu · 5. **STOP**

## Gameplay POC

| Lot | Statut | Contenu |
| --- | --- | --- |
| 0 | done | Monorepo pnpm / TS |
| 1 | done | Pixi canvas |
| 2 | done | Session Socket.IO guest |
| 3 | done | Monde + chunks |
| 4 | done | Déplacement serveur-autoritaire (base) |
| 5 | done | AOI multijoueur |
| 6 | done | Filons + scan |
| 7 | done | UI excavation |
| 8 | done | Moteur excav autoritaire |
| 9 | done | Persistence loot / nodes |

## Visuel / polish

| Lot | Statut | Contenu |
| --- | --- | --- |
| 10 | done | Direction artistique (docs) |
| 11 | done | Pipeline pixel (nearest, zoom 1–3, assets) |
| 12 | done | Sol / murs variants |
| 13 | done | Lumière / obscurité (lampe ; off par défaut) |
| 14 | done | Personnage explorateur |
| 15 A/B/C | done | Décor grotte (atlas + placement + polish) |
| Murs 3D | done | `wall_top` + falaise sud ; pas de lèvres E/W |
| Netcode mvmt | done | Commandes 60 Hz, sim fixe, replay, remotes buffer |
| **16A** | **done** | Feedback scan (pulse pixel-art immédiat) |
| **16B** | **done** | Filon mural ; clic à portée pour examiner |
| **16C** | **done** | Polish scan/filons mobile-first (tap ~48px) |
| **17A** | **done** | Overlay excavation UI mobile-first |
| **17B** | **done** | Juice excavation (pioche/marteau/révélation) |
| 17C | todo | Collapse / fin de session polish |
| 18 | todo | HUD / inventaire propre |
| 19 | todo | Juice léger |
| 20 | todo | Validation slice visuelle |

## Art refs (lots visuels)

- [ART_DIRECTION.md](./ART_DIRECTION.md)
- [PIXEL_ART.md](./PIXEL_ART.md)

## Hors scope

→ [FUTURE_IDEAS.md](./FUTURE_IDEAS.md)
