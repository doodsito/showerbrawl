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
| Infra | 1 process (le serveur sert le client buildé), Docker Compose sur VM Oracle ARM (US) derrière nginx + Cloudflare, `showerbrawl.doodsito.com` |

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
  docker-compose.yml
  infra/nginx/       config du site nginx
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
- [ ] Dockerfile + compose sur la VM Oracle, `showerbrawl.doodsito.com` accessible depuis un téléphone
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
- [ ] Vérifier sur la VM Oracle : Docker installé, image ARM qui build, `showerbrawl.doodsito.com` accessible en HTTPS
- [ ] Préparer les prompts IA pour le style pixel art grosses têtes

## Chantier infra (Robin)

Le `server/index.js` actuel est le squelette infra (test de latence), pas le serveur de jeu.

Objectif : un pipeline de déploiement validé de bout en bout avant le jour J, sur lequel l'équipe n'a plus qu'à pousser son code.

### État de la VM (vérifié)
- Ubuntu 24.04 aarch64, 4 cœurs, 24 Go RAM, 36 Go libres, Docker 29 installé
- Déjà en place : nginx (80/443) avec cert Cloudflare Origin wildcard `*.doodsito.com`, n8n (5678), eivom-api (127.0.0.1:8000)
- DNS `doodsito.com` sur Cloudflare
- Donc on réutilise ce pattern au lieu de cloudflared : `showerbrawl.doodsito.com` -> nginx (TLS) -> app Docker sur `127.0.0.1:3000`. URL fixe pour le QR code.

### Sur la VM Oracle (manuel)
- [x] `uname -m` -> confirmer `aarch64`
- [x] Cloudflare : enregistrement A `showerbrawl` -> `141.253.101.248`, proxied (orange)
- [x] `sudo usermod -aG docker ubuntu` puis se reconnecter
- [x] `git clone` du repo dans `~/showerbrawl`
- [x] Installer le site nginx `showerbrawl.doodsito.com` (headers WebSocket `Upgrade`/`Connection`), puis `sudo nginx -t && sudo systemctl reload nginx`

### À coder ensemble (dans le repo)
- [x] `server/index.js` minimal : Express sert `client/dist`, Socket.io répond aux `ping`, route `/health`
- [x] Page de test `client/` : affiche la latence mesurée (téléphone -> serveur US) et le nombre de connectés
- [x] `Dockerfile` multi-stage : build Vite puis image Node slim (build ARM directement sur la VM)
- [x] `docker-compose.yml` : service `app` lié à `127.0.0.1:3000`
- [x] `infra/nginx/showerbrawl.doodsito.com` : config nginx (copie du pattern eivom-api + WebSocket)
- [x] `deploy.sh` : `git pull && docker compose up -d --build` puis vérifie `/health`
- [x] `loadtest.js` : ouvre 20 clients Socket.io qui envoient des inputs à 20/s, mesure la latence (sert au test de H5)

### Validation
- [x] Ouvrir https://showerbrawl.doodsito.com sur un téléphone en 4G : page chargée, WebSocket connecté, latence affichée (203 ms depuis le PC)
- [x] `loadtest.js` contre la VM : 20/20 connectés, p50 195 ms, p95 307 ms (sans le jeu, à refaire avec le moteur)

### Suite infra
- [ ] Déploiement automatique : GitHub Action sur push `main` -> SSH sur la VM -> `./deploy.sh`
- [ ] Adapter `Dockerfile` / `deploy.sh` à la structure du moteur d'Axel dès qu'il pousse
- [ ] Refaire le loadtest avec le vrai jeu


## Jeu v1 (moteur) - Responsable : Axel

Axel code le moteur en adaptant `references/magic-arena-main` aux contrats `shared/`. Il remplace `server/index.js` et `client/`, garde le port 3000 et la route `/health`, et pousse souvent sur `main`. La liste ci-dessous est une checklist indicative, pas une affectation.

Base : les contrats d'Axel dans `shared/` (`protocol.js`, `config.js`, `characters.json`, `arena.json`). Le moteur lit ces fichiers, les équipes persos/arène ne touchent qu'aux JSON. Pas de changement de contrat : l'id du joueur = `socket.id`, un `join` refusé répond via l'ack Socket.io.

### Serveur
- [ ] `server/game.js` : état du lobby (équipes, persos pris par équipe), START, boucle à `TICK_RATE`
- [ ] Déplacement + collision cercle / cases `#` de `arena.json` + `obstacles`
- [ ] `server/abilities.js` : les 5 briques (projectile, burst, zone, dash, shield) + auto-aim sur l'ennemi le plus proche
- [ ] Dégâts, recul, mort, respawn `RESPAWN_TIME`, protection `SPAWN_PROTECTION`, kills par équipe
- [ ] Timer `MATCH_DURATION`, `end {score, mvp}`, retour au lobby après 10 s
- [ ] `server/index.js` : brancher `MSG.*` (join, input, host, start), diffusion `state` à `BROADCAST_RATE`

### Client (Phaser 3, ajouté en dépendance)
- [ ] Écran d'accueil : choix équipe A/B + perso, persos déjà pris dans l'équipe grisés
- [ ] Scène de jeu : arène depuis `arena.json`, joueurs, projectiles, zones ; interpolation (~100 ms de retard) ; caméra qui suit
- [ ] Contrôles : joystick virtuel gauche (codé maison, pas de dépendance) + 3 boutons avec cooldown visible ; clavier (ZQSD + J/K/L) pour tester sur PC
- [ ] HUD : score par équipe, timer, PV ; écran de fin
- [ ] Sprites : utilise `client/public/sprites/<sprite>.png` s'il existe, sinon cercle coloré + nom. L'équipe art dépose juste ses fichiers.

### Écran hôte (`/?host`)
- [ ] QR code de l'URL (dépendance `qrcode`), lobby en direct des 2 équipes, bouton START
- [ ] Pendant le match : vue spectateur de toute l'arène + score + timer

### Vérification
- [ ] `loadtest.js` mis à jour pour faire `join` + inputs : 20 joueurs en local puis sur la VM
- [ ] Partie complète à 2 onglets + 1 hôte en local, puis déployé et testé sur téléphone

### Plus tard si la latence (200 ms) gêne
- Prédiction locale du déplacement du joueur (le serveur reste l'autorité)

## Risques
1. Latence depuis les US (100-150 ms) : compensée par l'auto-aim et l'interpolation, à valider au test de charge.
2. Volume de contenu (30 capacités, 10 sprites) : tient uniquement si tout passe par les 5 briques.
