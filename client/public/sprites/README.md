# Sprites

Toutes les images du jeu, au même endroit. Servies à `/sprites/<fichier>.png`.

## Nommage

| Fichier | Rôle |
|---|---|
| `<perso>.png` | le perso en pied, référencé par `"sprite": "sprites/<perso>.png"` dans `shared/characters.json` |
| `<perso>_attack.png` | effet de l'attaque |
| `<perso>_defense.png` | effet de la défense |
| `<perso>_super.png` | effet de la super |
| `fx_<nom>.png` | effet commun à tous les persos |

`<perso>` = la clé du perso dans `characters.json` (`trump`, `obama`, `macron`...), en minuscules.

## Format

- PNG, fond transparent.
- Recadré au plus près du dessin (pas de marge), sinon le perso flotte au-dessus du sol : le jeu le dessine à hauteur fixe, pieds en bas de l'image.
- Persos : 256 px de haut. Effets : tiennent dans 256 x 256.


Macron : `macron_baguettes.svg` et `macron_sunglasses.svg` sont les icônes dessinées en code dans le labo. Le sprite existant `macron.png` et l’icône `macron_super.png` sont conservés. Les projectiles et le tampon sont dessinés en Canvas.

## Objets d’attaque du lab

`mic_object_v1.png` et `stamp_object_v1.png` sont dérivés des illustrations de l’équipe via l’outil intégré image_gen. Sources : `mic_drop.png` et `macron_super.png` du lab local. Les prompts sont dans `attack-art-prompts.json`. PNG RGBA conservés intacts ; le moteur cadre les objets lors du rendu.

## Biden — kit multijoueur

`biden.png` et `biden_sleep.png` proviennent du pack `client/personnages/biden_game_assets.json` (PNG décodés sans modification). La pose endormie du multi utilise désormais `biden_nap_v2.png`, image RGBA générée dans le lab avec image_gen et copiée sans modification. Elle reprend le costume du sprite en pied ; le cadrage conserve le corps entier et le contact au sol. L’ancien `biden_sleep.png` reste une illustration d’effet et n’est plus utilisé pour dessiner le corps. Les SVG glace, sieste et vélo viennent du lab local.

Le cornet est un projectile serveur : portée 400, vitesse 390, dégâts 12, recharge 0,75 s. Nap Time immobilise et protège pendant 2,4 s, recharge 7 s. Le vélo part après 0,55 s, parcourt au maximum 650 unités à 520 unités/s, frappe à 30 dégâts et transporte la cible jusqu'à un obstacle ou la fin de trajet. La direction reste fixe et permet l'esquive. Les murs MAGA se brisent sur le vélo ; boucliers et sieste l'arrêtent.


## Maduro et Xi — kits multijoueurs

Les sprites de personnages et les projectiles de l’équipe sont conservés. `maduro_plane_v1.png` et `xi_hammer_v2.png` sont les PNG RGBA générés dans le lab avec image_gen, copiés sans modification. L’avion est cadré à l’affichage ; le marteau contient six poses, avec des rectangles et points de contact définis dans `client/newcomer-fx.js`.

- Maduro : pétrole à portée 400, vitesse 370, 12 dégâts, recharge 0,8 s. Exfiltration : approche de 0,35 s, enlèvement, retour en parachute à 2,5 s, atterrissage à 3,15 s et reprise des commandes à 3,5 s ; recharge 8 s. Il est intouchable uniquement entre le décollage et l’atterrissage. Hyperinflation vise la position ennemie : portée 520, rayon 70, délai 0,8 s, 28 dégâts.
- Xi : étoile rouge à portée 440, vitesse 490, 10 dégâts, recharge 0,75 s. Bouclier de 1,6 s, recharge 6 s. Marteau rouge : portée 520, rayon 70, délai 0,8 s, 28 dégâts, animation calée sur l’impact serveur.

Les supers chargent avec les dégâts infligés ou reçus. Leur cible est fixée au lancement et peut esquiver. Les coups normaux repoussent jusqu’au bord ; seuls les supers peuvent éjecter. Le serveur transmet les phases d’exfiltration aux deux écrans ; la caméra téléphone s’élargit temporairement pour montrer l’avion et le parachute.
