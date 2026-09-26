# Équilibrage du multijoueur — 26 septembre 2026

Première passe locale sur `codex/roster-balance`, non déployée. Comparaison du moteur autoritaire `server/game.js` et de la configuration multijoueur. Aucun combat du laboratoire n’entre dans les résultats.

## Méthode

Base Git : `8432e3f`, même code de combat que la production `c32c079` observée pendant cet audit. Le script `scripts/balance-duels.js` exécute les vrais dégâts, collisions, capacités, recharges et conditions de KO du serveur, sans connexion à la production.

- 10 personnages, 45 confrontations différentes.
- Avant/après : 720 duels par version, soit 144 apparitions par personnage. Quatre tactiques (attaque continue, distance, esquive, bord), positions et ordre serveur inversés.
- Vérification supplémentaire : 2 880 duels avec les 16 combinaisons de tactiques opposées, sans réajuster les valeurs ensuite. Cette série inclut les 720 scénarios à tactique identique.
- Pas de temps de 50 ms ; décisions toutes les 150 ms ; premier KO ou arrêt après 40 s. Un match nul compte pour une demi-victoire.
- Les bots utilisent leurs capacités selon les mêmes règles générales, avec les différences nécessaires pour le mur et les esquives. Ils ne représentent ni le niveau humain, ni la latence réseau, ni les combats en équipe.

## Résultats

Pourcentage de victoires simulées (match nul = moitié). Ce sont des diagnostics de ces scénarios déterministes, pas des probabilités mesurées auprès de joueurs.

| Personnage | Avant, mêmes tactiques | Après, mêmes tactiques | Après, tactiques croisées | Premier super après* |
|---|---:|---:|---:|---:|
| Trump | 9.7 % | 52.8 % | 57.3 % | 3.8 s |
| Biden | 45.8 % | 45.8 % | 52.3 % | 3.6 s |
| Musk | 8.3 % | 51.4 % | 59.2 % | 4.8 s |
| Obama | 22.9 % | 52.8 % | 53.2 % | 4 s |
| Harris | 89.6 % | 47.9 % | 44.6 % | 4.2 s |
| Maduro | 51.4 % | 45.8 % | 34.4 % | 5.7 s |
| Sanders | 88.2 % | 56.3 % | 51.2 % | 4.5 s |
| Schwarzenegger | 72.9 % | 50 % | 56.3 % | 3.5 s |
| Macron | 63.9 % | 43.8 % | 44.4 % | 4.6 s |
| Zelensky | 47.2 % | 53.5 % | 47.1 % | 3.6 s |

*Moyenne parmi les duels où ce personnage a effectivement lancé son super ; ce chiffre ne mesure pas le temps de charge en restant hors combat.

Les résultats à tactique identique passent de 8,3–89,6 % à 43,8–56,3 %. La série croisée reste plus dispersée : Maduro 34,4 %, Musk 59,2 %. Maduro doit surtout être vérifié face aux joueurs qui gardent leurs distances et en équipe : son attaque de zone pourrait compenser, mais cela n’a pas été mesuré ici. Aucune promesse d’équilibre 50/50 entre humains.

Les KO par chute passent de 480/720 à 94/720 ; la durée moyenne avant le premier KO passe de 4.5 s à 6.4 s.

## Règles corrigées

- Choix utilisateur : les coups normaux et charges défensives repoussent jusqu’au bord ; seules les impulsions des supers peuvent éjecter. Les vitesses de recul normales et de super restent séparées, y compris quand les coups se chevauchent.
- Les boucliers empêchent les dégâts et l’éjection du coup bloqué. Les projections animées de Trump, Obama et du Cybertruck conservent leur trajet spécifique et leur arrêt aux obstacles.
- Tous les personnages ralentissent brièvement après une attaque, puis retrouvent leur vitesse, même si le pouvoir recharge encore. Auparavant, quatre personnages étaient ralentis pendant toute la recharge.
- La fuite au contact gagne 35 % de vitesse, plafonnée à 300, pour tout le monde hors récupération. Les différences de vitesse restent présentes.
- Les supers ne rechargent plus leur lanceur avec leurs propres dégâts différés. Gain normal : 1,6 énergie par dégât infligé, 0,6 par dégât reçu ; le jet de Musk garde sa charge par impact.
- Frapper son propre mur ou un mur allié ne donne plus de charge.
- Les charges offensives ne sont plus invulnérables ; lancer une autre capacité pendant un dash est bloqué pour tous.
- Les délais des supers ciblés laissent une possibilité de sortir du cercle, vérifiée pour la vitesse de base du personnage le plus lent. Le temps de réaction et une éventuelle récupération consomment une partie de cette marge.

## Forces et faiblesses

| Personnage | Force | Faiblesse |
|---|---|---|
| Trump | 115 PV, direct renforcé, mur pour couper le passage | 185 unités/s, aucune esquive |
| Biden | 110 PV et charge pour se repositionner | Vitesse 180 ; charge désormais vulnérable |
| Musk | Portée 150, brûlure, grande esquive | Jet limité à 0,75 s ; recharge 1,2 s ; visée figée pendant le jet |
| Obama | Vitesse 215, esquive de 238 unités | 100 PV ; Mic Drop annoncé 0,85 s avant impact |
| Harris | Coups rapides toutes les 0,38 s, vitesse 210 | 90 PV ; protection 1,1 s toutes les 7 s |
| Maduro | 125 PV, onde qui touche plusieurs ennemis, bouclier 1,8 s | Vitesse 165 ; difficultés à poursuivre en duel |
| Sanders | 110 PV, bouclier et coups de 13 dégâts | Vitesse 175 ; bouclier toutes les 8 s |
| Schwarzenegger | 17 dégâts par coup, charge offensive | Attaque toutes les 0,95 s ; récupération 0,32 s ; vitesse 170 |
| Macron | 8 dégâts toutes les 0,3 s, portée 90, lunettes 1,4 s | Recul limité à 140 ; bouclier toutes les 7 s |
| Zelensky | Portée 90, vitesse 205, trois impacts de super | Charge vulnérable ; impacts annoncés et décalés |

## Paramètres de la version candidate

| Personnage | PV | Vitesse | Dégâts de base | Recharge attaque | Récupération | Recharge défense | Recharge super |
|---|---:|---:|---|---:|---:|---:|---:|
| Trump | 115 | 185 | 12 | 0.5 s | 0.2 s | 8 s | 5 s + 100 énergie |
| Biden | 110 | 180 | 12 | 0.52 s | 0.18 s | 5 s | 6 s + 100 énergie |
| Musk | 100 | 210 | 32 / s + brûlure 7 / s | 1.2 s | 0.2 s | 4.5 s | 6 s + 100 énergie |
| Obama | 100 | 215 | 11 | 0.42 s | 0.14 s | 4 s | 5 s + 100 énergie |
| Harris | 90 | 210 | 10 | 0.38 s | 0.12 s | 7 s | 6 s + 100 énergie |
| Maduro | 125 | 165 | 12 | 0.85 s | 0.25 s | 8.5 s | 6 s + 100 énergie |
| Sanders | 110 | 175 | 13 | 0.62 s | 0.22 s | 8 s | 6 s + 100 énergie |
| Schwarzenegger | 110 | 170 | 17 | 0.95 s | 0.32 s | 6 s | 6 s + 100 énergie |
| Macron | 100 | 205 | 8 | 0.3 s | 0.12 s | 7 s | 6 s + 100 énergie |
| Zelensky | 100 | 205 | 12 | 0.46 s | 0.16 s | 5 s | 6 s + 100 énergie |

## Confrontations après réglage

Ligne contre colonne, pourcentage de victoires sur 16 duels à tactique identique. Les petites séries peuvent donner 0 ou 100 % ; ne pas les interpréter comme un résultat universel.

| |Trump|Biden|Musk|Obama|Harris|Maduro|Sanders|Schwarzenegger|Macron|Zelensky|
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Trump | — | 38 % | 88 % | 38 % | 50 % | 69 % | 38 % | 56 % | 62 % | 38 % |
| Biden | 62 % | — | 31 % | 44 % | 38 % | 50 % | 50 % | 38 % | 44 % | 56 % |
| Musk | 12 % | 69 % | — | 50 % | 44 % | 75 % | 50 % | 75 % | 56 % | 31 % |
| Obama | 62 % | 56 % | 50 % | — | 81 % | 50 % | 44 % | 50 % | 44 % | 38 % |
| Harris | 50 % | 62 % | 56 % | 19 % | — | 31 % | 19 % | 94 % | 44 % | 56 % |
| Maduro | 31 % | 50 % | 25 % | 50 % | 69 % | — | 69 % | 25 % | 50 % | 44 % |
| Sanders | 62 % | 50 % | 50 % | 56 % | 81 % | 31 % | — | 50 % | 75 % | 50 % |
| Schwarzenegger | 44 % | 62 % | 25 % | 50 % | 6 % | 75 % | 50 % | — | 81 % | 56 % |
| Macron | 38 % | 56 % | 44 % | 56 % | 56 % | 50 % | 25 % | 19 % | — | 50 % |
| Zelensky | 62 % | 44 % | 69 % | 62 % | 44 % | 56 % | 50 % | 44 % | 50 % | — |

## Vérifications et suite

- `npm test` : 121 tests réussis, dont huit nouvelles vérifications de déplacement, éjection, bouclier et charge. La commande existante inclut aussi les tests historiques du lab ; les duels de ce rapport utilisent exclusivement le multi.
- `npm run build` : réussi.
- À jouer entre humains : Musk contre boucliers, Maduro contre personnages mobiles, Macron contre Trump, et les mêlées en équipe. Vérifier la fuite, les attaques contre un joueur au bord, et la fréquence réelle des supers.
- Les kits sont ceux du multi actuel. Par exemple, la baguette de Macron est actuellement un coup au contact dans ce moteur, et Biden garde ses capacités multi existantes. Cet audit ne remplace pas ces kits par ceux du lab.

## Reproduire

```sh
node scripts/balance-duels.js --out balance/after.json
node scripts/balance-duels.js --cross-style --out balance/cross-style.json
```

Pour la base : créer un worktree au commit `8432e3f`, y copier exactement le même script et l’exécuter depuis ce worktree. Les trois fichiers JSON conservent les paramètres complets, résultats et métriques par duel.
