# showerbrawl

## Lancer le jeu en local

Une seule commande :

```sh
npm run dev:all
```

Elle libère d'abord le port 3000 (tue le process qui l'occupe, pour éviter `EADDRINUSE`), puis lance ensemble le serveur node (port 3000) et Vite (port 5173) dans le même terminal. Ctrl+C arrête les deux. `npm run start:all` fait la même chose.

Écran hôte : http://localhost:5173/ · Manette : scanner le QR affiché (ou http://<IP LAN>:5173/play/).

## Arène Maison Blanche — prototype pixel art

[Présentation et commandes](laboratoire/maison-blanche/README.md). Décor Canvas, combat local contre une IA, commandes clavier et tactiles.

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory laboratoire
```

Ouvrir http://127.0.0.1:8765/maison-blanche/.

```sh
node --test laboratoire/maison-blanche/tests/*.test.js
```


## Trump et Obama en multijoueur

Les deux personnages utilisent les dessins de l’équipe et les pouvoirs du labo Maison Blanche.

| Personnage | Attaque | Défense | Super chargé |
|---|---|---|---|
| Trump | Direct au contact | Mur MAGA : obstacle de 36 PV, 6 s, destructible | You’re fired! : projection animée jusqu’au bord opposé |
| Obama | Énergie : projectile et recul de 125 unités | Esquive de 238 unités, joystick ou recul automatique | Mic Drop : zone annoncée pendant 0,85 s puis impact unique |

Les supers se chargent en combat. Leur pourcentage et les recharges viennent du serveur et sont affichés sur les manettes `/play/`. Le mur bloque les deux équipes, les déplacements et les projectiles ; le Mic Drop touche les ennemis dans sa zone. Les projections respectent la cage. Relâcher l’attaque et reculer accélère la fuite à proximité d’un ennemi.

Les événements et champs existants du réseau restent disponibles ; les snapshots ajoutent `walls`, `effects`, `energy` et les états d’animation. Les cinq types de capacité restent identiques, avec des variantes `behavior` pour les pouvoirs du labo. Les tests du combat sont dans `tests/multiplayer-combat.test.js` (`node --test tests/*.test.js`).
