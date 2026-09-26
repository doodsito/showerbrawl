# showerbrawl

## Lancer le jeu en local

Une seule commande :

```sh
npm run dev:all
```

Elle libère d'abord le port 3000 (tue le process qui l'occupe, pour éviter `EADDRINUSE`), puis lance ensemble le serveur node (port 3000) et Vite (port 5173) dans le même terminal. Ctrl+C arrête les deux. `npm run start:all` fait la même chose.

Écran hôte : http://localhost:5173/ · Manette : scanner le QR affiché (ou http://<IP LAN>:5173/play/).

## Avant le jury

**Rollback en une ligne :** GitHub > Actions > **Rollback** > Run workflow > coller le SHA d'une version qui marchait (visible sur `/health` ou en bas de l'écran hôte) : la prod revient à ce commit en ~1-2 min. Le prochain push sur `main` redéploie normalement la dernière version.

Chaque push lance d'abord `npm test` + `npm run build` : si ça échoue, rien n'est déployé et la prod garde la version précédente.

## Personnages : design vs jeu (à trancher)

`shared/characters.json` est la **seule source de vérité** du jeu. `client/personnages/trump.design.json` et `client/personnages/obama.design.json` (Leo) sont des documents de design **non branchés**. Écarts chiffrés :

| Perso | Élément | Design (Leo) | Jeu (`characters.json`) |
|---|---|---|---|
| Trump | Vitesse | 150 | 200 |
| Trump | Attaque | « POW! », melee, portée 34, dégâts 18, knockback 90 | « Direct », portée 85, dégâts 9, poussée courte (11 unités) |
| Trump | Défense | aucune | « Mur MAGA » (mur 6 s, 36 PV) |
| Trump | Super | « MAGA Wall Drop », mur-piège à distance, portée 420, dégâts 42, knockback 260, mur 120 PV | « You're fired! », portée 130, dégâts 30, projection jusqu'au bord, charge 100 |
| Obama | Vitesse | 175 | 205 |
| Obama | Attaque | « Hope Burst », projectile portée 380, dégâts 14 | « Énergie », corps à corps portée 75, dégâts 11, knockback 240 |
| Obama | Défense | aucune | « Esquive », dash 238 en arrière |
| Obama | Super | « Mic Drop Strike », ciblé à distance, portée 560, rayon 76, dégâts 55, knockback 220 | « Mic Drop », centré sur Obama (portée 0), rayon 110, dégâts 28, poussée 100, charge 100 |

Le design de Leo prévoit des attaques de base à distance, alors que la règle du jeu les veut au corps à corps (seul le super peut viser à distance, voir ci-dessous).

### Équité (validée)

**Attaque de base, PV et vitesse sont identiques pour les 10 persos**, fixés dans `shared/config.js` (valeurs = médianes des persos au moment de l'alignement) :

| Réglage | Valeur |
|---|---|
| `BASE_ATTACK` | dégâts 12, cooldown 0,51 s, portée 85, knockback 195, recovery 0,19 s |
| `BASE_HP` | 105 |
| `BASE_SPEED` | 195 |

Le serveur applique `BASE_ATTACK` à l'attaque de tous les persos et ignore toute valeur individuelle. Chaque perso garde seulement l'**apparence** de son attaque (label, icône, visuel : le Jab de Trump reste un poing, les baguettes de Macron restent des baguettes). **Seules la défense et le super sont propres à chaque perso.** Des tests vérifient l'égalité pour chaque paire de persos (dégâts, cooldown, portée, recul, dégâts sur 5 s) et les PV/vitesse.

### Règle de combat (validée)

- **Attaque de base et défense : corps à corps.** L'attaque ne touche qu'un ennemi au contact (portée plafonnée à 110), la défense est un bouclier ou une charge qui frappe et pousse sur sa trajectoire.
- **Super : peut viser à distance, avec alerte.** Il cible l'ennemi vivant le plus proche dans sa portée, pose un **cercle d'alerte** au sol (couleur d'équipe, qui se remplit puis clignote) pendant son délai, puis frappe la zone : dégâts + knockback. Sans ennemi à portée, il frappe devant le lanceur à mi-portée. **Rien ne vole à travers l'arène** et **on peut esquiver** en sortant du cercle : chaque super est réglé pour que même le perso le plus lent puisse s'échapper (rayon + 18 ≤ vitesse min × délai, vérifié par un test). Tous les supers demandent la jauge d'énergie pleine (`charge: 100`).

Champs de la brique super ciblé (`"type": "zone", "target": "enemy"`) :

| Champ | Rôle |
|---|---|
| `range` | portée de ciblage (300 à 600) |
| `radius` | rayon du cercle d'impact |
| `delay` | durée de l'alerte avant l'impact (0,5 à 0,9 s) |
| `damage`, `knockback` | dégâts et recul à l'impact |
| `hits`, `spread`, `gap` | impacts multiples décalés (ex : Aide Militaire de Zelensky, 3 impacts) |
| `charge` | énergie requise (100) |

Trump (You're fired!, saisie au contact), Obama (Mic Drop, modèle de cette brique) et Musk (Cybertruck) gardent leur kit dédié.

### Ajouter un perso sans toucher au code

Tout se déclare dans `shared/characters.json` (rechargé à chaud par le serveur) : `name`, `hp`, `speed`, `sprite` (PNG dans `client/public/sprites/` ou crâne généré), 3 pouvoirs parmi les 5 types, et optionnellement `fullBody` (rendu en pied), `labKit` (règles du kit labo), `shieldStyle`, `hint` (aide manette). Un pouvoir avec `behavior` passe par le code labo, sinon par les briques génériques.

## Déploiement automatique

**Pousser sur `main` = déploiement automatique** sur https://showerbrawl.doodsito.com, sans intervention. Délai habituel : **~1 à 2 min** après le push.

- `.github/workflows/deploy.yml` se déclenche à chaque push sur `main` et lance `deploy.sh` sur la VM (SSH, clé restreinte à ce script).
- `deploy.sh` fait `git pull`, reconstruit l'image Docker (cache npm BuildKit, couches réutilisées) avec le SHA du commit, redémarre le conteneur, puis attend que `/health` annonce ce nouveau SHA.

**Vérifier quelle version tourne :**
- https://showerbrawl.doodsito.com/health renvoie `{"ok":true,"players":N,"sha":"<commit>"}` ;
- ou en bas à gauche de l'écran hôte, en petit gris : `v <commit>`.

Le SHA de `/health` identifie le serveur. `/build-version.json` identifie le client : l’hôte et la manette vérifient cette version et se rechargent au lobby après une mise à jour. Les images utilisent cette même version dans leur URL pour éviter un ancien design en cache. Les onglets ouverts avant l’ajout de ce mécanisme doivent être actualisés une première fois.

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


### Macron — kit du labo

Macron rejoint les kits Trump et Obama :

- **Triple baguette** : trois projectiles en éventail, 5 dégâts chacun, portée 360. Chaque impact sur un ennemi donne **25 % de charge** (quatre impacts pour le super). Les boucliers et les murs bloquent les tirs.
- **Lunettes de soleil** : bouclier de 1,6 seconde, recharge de 6 secondes, lunettes visibles sur le personnage.
- **49.3** : à 100 % de charge, le tampon cible la position de l’ennemi le plus proche. Impact après 0,55 seconde, 28 dégâts dans un rayon de 60, recul et destruction des murs dans la zone. Neuf projectiles partent ensuite vers l’extérieur, dans les limites du terrain. Le super ne recharge pas sa propre jauge.

Le ciblage, les dégâts, le bouclier et la charge sont décidés par le serveur ; les alliés ne subissent pas de dégâts. Les icônes des baguettes et des lunettes viennent du labo, et le tampon est animé en Canvas.


## Musk — kit multijoueur du lab

Musk utilise le sprite de l’équipe (`Musk perso/Musk.png`) sur l’hôte et la manette. Ses capacités sont calculées côté serveur dans `server/musk-combat.js` ; l’hôte dessine les mêmes zones et trajectoires.

- **Lance-flammes** : cône de 48°, portée 150, jet de 0,85 s. 34 dégâts/s, brûlure de 8 dégâts/s pendant 0,9 s. Chaque pulsation repousse de 6 unités sans étourdir et donne 5 % de charge. Les murs, boucliers et protections de réapparition bloquent les dégâts.
- **Hyperloop** : esquive de 260 unités en 0,18 s, direction du joystick ou recul par défaut. Recharge 4 s ; bloque sur les murs et joueurs, sans dégâts ni invulnérabilité.
- **Cybertruck** : nécessite 100 % de charge. Après 0,44 s, avance à 620 unités/s et inflige 48 dégâts par ennemi touché, puis entraîne les cibles vers le bord. Le choc contre un obstacle libère les cibles et émet des billes d’acier/Dogecoins (6 dégâts chacun), sans recharger le super. Les alliés sont épargnés. La mort d’une cible transportée est comptée à sa libération.

Les autres kits conservent les règles de corps à corps de l’équipe. Le lab reste indépendant ; ce port ne publie pas les changements locaux de Biden.

Vérification ciblée : `node --test tests/musk-combat.test.js tests/multiplayer-combat.test.js`, puis `npm run build`.

### Retouches des attaques du lab

Le Mic Drop cible la position de l’ennemi vivant le plus proche sur toute la carte au lancement. Sans ennemi disponible, le super reste chargé. La zone reste fixe durant les 0,85 s d’avertissement et peut être esquivée. Le micro détaillé tombe tête en avant puis rebondit ; le 49.3 utilise un tampon doré, une empreinte et des feuilles animées. Le mur reprend la texture MAGA en perspective tout en gardant les couleurs d’équipe. L’impact d’Énergie reprend le sprite tricolore ; son fonctionnement au corps à corps en multijoueur est conservé.

### Obama — projectile à longue portée

Energy conserve un vrai projectile : portée de 600 unités, vitesse de 600 unités/s, 11 dégâts, délai de 0,85 s. Il traverse l’arène jusqu’à une collision ou sa limite de portée. Un bouclier le bloque ; son recul ne peut pas éjecter. Les attaques explicitement configurées `travel: true` conservent leur kit dans `standardAttack`. Les autres attaques de base suivent `CONFIG.BASE_ATTACK`.
