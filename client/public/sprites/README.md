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
