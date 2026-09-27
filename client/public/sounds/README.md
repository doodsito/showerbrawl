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
- Volume harmonisé autour de -16 dB moyen, pic sous -1 dB (sons d'action).

## Régler le volume d'un son sans le réencoder

La table `VOLUME` en tête de `client/sfx.js` applique un gain de lecture par fichier (clé = nom sans `.mp3`, valeur 0..1, absent = 1) :

```js
export const VOLUME = {
  musk_attack: 0.22, // lance-flammes: joué à 22 %
};
```

Un son trop fort : ajouter une ligne `nom_du_fichier: 0.5,` et c'est tout. Le MP3 n'est pas touché.

Le bip de coup pendant le lance-flammes de Musk (jet et brûlure) est limité à un toutes les 0,3 s toutes cibles confondues, à 30 % du volume (`FLAME_HIT_GAP` / `FLAME_HIT_VOL` dans `client/host.js`).

Sons générés avec ElevenLabs (offre gratuite) : créditer `elevenlabs.io` dans le jeu.

## Mixage

- `MUSIC_VOLUME = 0.4` en tête de `client/music.js` : volume de la musique (boucle chiptune du lobby, `music_circus.mp3` en combat).
- `SFX_MASTER = 0.2` en tête de `client/sfx.js` : gain maître de tous les effets. `VOICE_VOLUME` (fichiers MP3) et la table `VOLUME` (par fichier) s'appliquent par-dessus.
- Le bouton 🔊 de l'écran hôte coupe musique et effets ensemble.
