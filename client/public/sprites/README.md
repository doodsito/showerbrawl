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

`biden.png` et `biden_sleep.png` proviennent du pack `client/personnages/biden_game_assets.json` (PNG décodés sans modification). Le renderer cadre la pose endormie à l'affichage. Les SVG glace, sieste et vélo viennent du lab local.

Le cornet est un projectile serveur : portée 400, vitesse 390, dégâts 12, recharge 0,75 s. Nap Time immobilise et protège pendant 2,4 s, recharge 7 s. Le vélo part après 0,55 s, parcourt au maximum 650 unités à 520 unités/s, frappe à 30 dégâts et transporte la cible jusqu'à un obstacle ou la fin de trajet. La direction reste fixe et permet l'esquive. Les murs MAGA se brisent sur le vélo ; boucliers et sieste l'arrêtent.
