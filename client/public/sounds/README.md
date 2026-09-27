# Sons

Tous les sons du jeu, au même endroit. Servis à `/sounds/<fichier>.mp3`.

## Nommage

Même convention que `client/public/sprites/` :

| Fichier | Rôle |
|---|---|
| `<perso>_attack.mp3` | son de l'attaque |
| `<perso>_defense.mp3` | son de la défense |
| `<perso>_super.mp3` | son de la super |
| `fx_<nom>.mp3` | son commun (`fx_victory`, `fx_defeat`) |
| `music_<nom>.mp3` | musique de fond (`music_circus` : 1 min 25, "Circus" de SlimeyFox, Pixabay) |

`<perso>` = la clé du perso dans `shared/characters.json`, en minuscules.

## Format

- MP3 128 kb/s, 44,1 kHz.
- Silences de début et de fin coupés, fondu de 30 ms en fin pour éviter les clics.
- Volume harmonisé autour de -16 dB moyen, pic sous -1 dB (sons d'action). La musique garde son volume d'origine, le mixage se règle dans le code.

## Volume par fichier

Un son trop fort se règle en une ligne dans la table `VOLUME` de `client/sfx.js`, sans réencoder le MP3 :

```js
export const VOLUME = {
  musk_attack: 0.4,   // 40 % du volume d'origine
};
```

Clé = nom du fichier sans `.mp3`, valeur = multiplicateur du gain (1 = inchangé). Absent de la table = 1.

Le bip de coup pendant le lance-flammes de Musk est limité à un par cible toutes les 0,3 s, à 50 % du volume (`FLAME_HIT_GAP` / `FLAME_HIT_VOL` dans `client/host.js`).

Sons générés avec ElevenLabs (offre gratuite) : créditer `elevenlabs.io` dans le jeu.
