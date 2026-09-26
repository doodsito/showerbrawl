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

`<perso>` = la clé du perso dans `shared/characters.json`, en minuscules.

## Format

- MP3 128 kb/s, 44,1 kHz.
- Silences de début et de fin coupés, fondu de 30 ms en fin pour éviter les clics.
- Volume harmonisé autour de -16 dB moyen, pic sous -1 dB.

Sons générés avec ElevenLabs (offre gratuite) : créditer `elevenlabs.io` dans le jeu.
