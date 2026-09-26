# Showerbrawl - Plan hackathon (7h)

Brawl Stars avec des politiciens, 10v10 en ligne sur mobile (navigateur), octogone UFC sur le toit de la Maison Blanche. Objectif unique : la démo.

## Décisions figées

| Sujet | Décision |
|---|---|
| Format | 10v10 humains, 1 salle publique, deathmatch équipe 2 min, respawn 3 s, plus de kills gagne |
| Persos | Trump, Biden, Musk, Obama, Harris, Maduro, Sanders, Schwarzenegger, Macron, Zelensky. Pas d'équilibrage |
| Capacités | Attaque / Défense / Super, construites à partir de 5 briques : projectile, rafale, zone, dash, bouclier |
| Visée | Auto-aim sur l'ennemi le plus proche |
| Contrôles | Joystick gauche (déplacement) + 3 boutons |
| Lobby | QR code -> choix équipe + perso, pas de doublon dans une équipe |
| Écran hôte | Vidéoprojecteur : QR + lobby + bouton START, puis vue spectateur |
| Déco | Joueur retiré, pas de reconnexion |
| Arène | Vue de dessus, octogone UFC sur le toit, 2 héliports (spawns), obstacles rectangulaires |
| Style | Pixel art IA retouché main, grosses têtes |
| Stack | Client Phaser 3 + Vite (JS). Serveur Node + Express + Socket.io, autoritaire 20 ticks/s |
| Infra | 1 process (le serveur sert le client buildé), Docker Compose sur VM Oracle ARM (US) + cloudflared tunnel (HTTPS) |

## Architecture

```
showerbrawl/
  client/            Phaser + Vite
    scenes/          Lobby, Game, Host (lobby + spectateur), End
    ui/              joystick, 3 boutons, HUD (score, timer, PV)
    assets/          sprites persos, arène, effets
  server/
    index.js         Express (sert client/dist) + Socket.io
    game.js          boucle 20 ticks/s : entrées -> mouvements -> capacités -> collisions -> morts/respawn -> score
    abilities.js     les 5 briques
    arena.js         octogone (8 demi-plans) + obstacles + spawns
  shared/
    characters.js    config des 10 persos (stats + 3 capacités)
    protocol.js      noms des messages réseau
  Dockerfile
  docker-compose.yml (app + cloudflared)
```

## Contrats à figer en première demi-heure (avant de se séparer)

**Réseau (Socket.io)**
- Client -> serveur : `join {team, character}`, `input {dx, dy, attack, defense, super}`
- Hôte -> serveur : `host`, `start`
- Serveur -> tous : `lobby {teams}`, `state {t, players[], projectiles[], zones[], score, timeLeft}` à 20/s, `end {score, mvp}`

**Config perso**
```js
trump: {
  name: 'Trump', hp: 100, speed: 200, sprite: 'trump',
  attack:  { type: 'projectile', damage: 15, cooldown: 0.4, range: 400, label: 'Tweet' },
  defense: { type: 'shield',     duration: 1.5, cooldown: 6,  label: 'Le Mur' },
  super:   { type: 'zone',       radius: 150, damage: 30, cooldown: 15, label: 'Tariffs' },
}
```

## Jalons

### H0 - H1 : Squelette déployé
- [ ] Repo : structure client/server/shared, Vite + Express + Socket.io
- [ ] Figer `protocol.js` et le format de `characters.js`
- [ ] Carré qui bouge, visible par plusieurs clients
- [ ] Dockerfile + compose + cloudflared sur la VM Oracle, URL HTTPS accessible depuis un téléphone
- [ ] Style graphique figé (1 perso de référence grosse tête)

### H1 - H3 : Combat jouable avec 2 persos
- [ ] Boucle serveur : déplacement, collisions arène (octogone + obstacles), PV, mort, respawn 3 s
- [ ] Les 5 briques de capacités + auto-aim
- [ ] Client : joystick, 3 boutons avec cooldown visible, interpolation des positions, caméra qui suit
- [ ] Timer 2 min, score par équipe, écran de fin
- [ ] Sprites de 2 persos + arène v1

### H3 - H5 : Contenu complet
- [ ] Config des 10 persos (30 capacités, uniquement avec les 5 briques)
- [ ] Sprites des 10 persos + effets des capacités
- [ ] Arène finale : octogone, héliports, signes distinctifs Maison Blanche
- [ ] Lobby : choix équipe + perso, persos pris grisés
- [ ] Écran hôte : QR code, lobby en direct, START, vue spectateur de toute l'arène

### H5 - H6 : Stabilisation
- [ ] Test de charge : 20 onglets / téléphones simultanés sur le serveur US
- [ ] Correctifs perf mobile (taille des messages, nombre de sprites)
- [ ] Polish : effets de coups, noms de capacités affichés, sons si le temps le permet

### H6 : Gel des fonctionnalités
- [ ] Plus aucune feature, uniquement des correctifs
- [ ] Répétition complète de la démo : QR -> lobby -> START -> match -> fin

### H7 : Démo

**Règle** : si un jalon glisse, on coupe des persos, jamais le multijoueur.

## Répartition (à confirmer)

| Personne | Périmètre |
|---|---|
| 1 | Serveur : boucle de jeu, capacités, collisions, déploiement |
| 2 | Client Phaser : rendu, contrôles, interpolation, HUD |
| 3 | Pixel art : 10 persos, arène, effets |
| 4 | Config persos, lobby, écran hôte/spectateur, écran de fin, intégration |

## À faire avant le jour J
- [ ] Vérifier sur la VM Oracle : Docker installé, image ARM qui build, tunnel cloudflared fonctionnel
- [ ] Préparer les prompts IA pour le style pixel art grosses têtes

## Risques
1. Latence depuis les US (100-150 ms) : compensée par l'auto-aim et l'interpolation, à valider au test de charge.
2. Volume de contenu (30 capacités, 10 sprites) : tient uniquement si tout passe par les 5 briques.
