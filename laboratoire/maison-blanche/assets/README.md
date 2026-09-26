# Visuels fournis par l’équipe

Source : [ajout de Léo sur main](https://github.com/doodsito/showerbrawl/commit/cfd53ba5fb8d54b3e0fcf5c4af59012b93bf7955), le 26 septembre 2026.

Les PNG proviennent des données base64 de `showerball_json/showerball_assets.json`. Décodage sans modification des pixels ni réduction des fichiers source.

| Fichier | Dimensions | Utilisation locale |
|---|---|---|
| `trump.png` | 1278 × 1230 | Trump ; repère rouge pour le joueur, bleu pour l’adversaire. |
| `maga_wall.png` | 1536 × 1024 | Icône de capacité. Le mur sur le terrain est dessiné en volume par le moteur. |
| `punch_fx.png` | 1377 × 1142 | Icône de l’attaque uniquement ; les impacts dans l’arène utilisent des animations sans texte. |

Trump est fourni dans une seule pose fixe, sans planche d’animation. Le prototype anime le déplacement du visuel et les réactions aux coups ; il ne contient pas de nouvelles poses dessinées. Le mur est désormais un obstacle de la simulation : position fixe, collisions, 36 PV, durée de 6 secondes et recharge de 9 secondes. La garde classique reste disponible avec Maj.

Aucun autre design de personnage n’était présent dans l’ajout initial de Trump. Les entrées Trump/Biden de `shared/characters.json` sont des paramètres de jeu, pas des images.

Le PNG du mur contient une perspective frontale et des ombres déjà dessinées. Pour correspondre au passage gauche/droite des combattants, le rendu sur le terrain utilise désormais une maçonnerie procédurale en biais, avec une face longue, une tranche et un dessus. Le rendu et les collisions partagent exactement la même empreinte au sol.

## Obama

Source : [sprites ajoutés sur main](https://github.com/doodsito/showerbrawl/commit/2d604f65aee7f348c97baea449da8010b1d6c5e9), à partir des fichiers de Léo. Les trois PNG ont été copiés sans modifier leurs pixels.

- `obama.png` ← `client/public/sprites/obama.png` : personnage (une pose, sans planche d’animation).
- `obama_attack.png` ← `client/public/sprites/attaque.png` : projectile mobile bleu/rouge et icône.
- `mic_drop.png` ← `client/public/sprites/mic_drop.png` : icône uniquement, car l’illustration contient du texte. Le micro en chute et les ondes au sol sont dessinés en Canvas.
