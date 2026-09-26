# QA des animations du multijoueur — 26 septembre 2026

## Correctif des projectiles après retour en production

Le contrôle initial ci-dessous validait des effets de contact, pas les projectiles attendus. Il ne prouvait donc pas le fonctionnement de Triple Baguette et Energy.

La configuration n'engendrait plus de projectiles et le tri de rendu excluait tous les projectiles sauf ceux de Musk. Le correctif restaure trois baguettes et une boule d'énergie qui se déplacent réellement, avec collision, durée de vie, boucliers et recul limité aux bords. Les trois baguettes se partagent les 8 dégâts d'une salve ; elles sont séparées visuellement en hauteur. Obama conserve 11 dégâts. La portée et le délai entre tirs sont maintenant respectivement 185 / 0,45 s et 180 / 0,85 s pour tenir compte du tir à distance.

Les états VIEW conservaient mal les zéros (âge initial, direction verticale). Ils les conservent maintenant. L'audit compare les états complets et VIEW : 30 capacités × 91 images × 2 écrans, avec détection des coordonnées non finies que Canvas ignore normalement sans erreur.

Les nouveaux tests échouaient avant correction (5 échecs), puis passent : déplacement avant impact, dégâts totaux, expiration, bouclier, mur, absence d'éjection et conservation des zéros. Après intégration de `bab9618` : 131 tests passent et le build réussit. Contrôle visuel des trois baguettes et de l'énergie dans le module compilé partagé par l'arène et les téléphones. Les autres capacités conservent leur rendu actuel ; les personnages sans sprite dédié restent génériques.

Diagnostic d'équilibrage : 720 duels simulés avec le moteur multi et la portée réelle des projectiles. Macron 58,7 %, Obama 45,8 % ; ces scores de bots ne prédisent pas les résultats humains. Les détails sont dans `balance/projectile-fix.json`.

## Audit initial (historique)

Statut : **DONE_WITH_CONCERNS**. Correctifs vérifiés localement et réunis avec la branche d’équilibrage `codex/roster-balance`. Aucun de ces correctifs n’a été déployé pendant cet audit.

## Production observée

- URL : https://showerbrawl.doodsito.com/
- Version initiale : `d0649a9`. Version observée en fin d’audit : `bc788f6`.
- Les mises à jour intermédiaires concernent les sons et la manette. Elles sont intégrées à la branche de travail.
- Les 17 PNG/SVG présents dans `client/public/sprites` sont récupérables en production et identiques octet par octet aux fichiers du dépôt.
- Aucun match public n’a été lancé ou réinitialisé pour les tests. Les capacités ont été reproduites avec le moteur multijoueur, puis rendues dans un navigateur local.

## Problèmes et corrections

### QA-001 — Animations de Macron remplacées par les effets génériques (gravité moyenne)

Reproduction : lancer Triple baguette et 49.3 avec Macron. Le coup montre un petit poing ; le 49.3 affiche un cercle, sans tampon. Les images sont pourtant présentes sur le serveur.

Cause : la configuration utilise désormais les capacités génériques du multi ; leur chemin de rendu ne sélectionne plus les effets dédiés. Le champ visuel du super n’était pas transmis dans les états réseau.

Correction : marqueur visuel `baguette` pour le coup et `decree` pour le super. Transmission du marqueur au client ; trois baguettes au point du coup et tampon tombant sur la vraie zone ciblée. Les dégâts, la portée et le délai de l’attaque restent ceux du moteur multi. Les baguettes sont un visuel du coup au contact, pas trois nouveaux projectiles physiques.

Vérification : captures avant/après ; tampon dessiné dans le véritable build Vite, alimenté par Socket.IO avec un état du serveur. Tests de dégâts, de cible et de frappe unique réussis.

- [49.3 avant](../.gstack/qa-reports/attack-qa/macron-before.png)
- [49.3 après](../.gstack/qa-reports/attack-qa/macron-after.png)
- [Baguette avant](../.gstack/qa-reports/attack-qa/baguette-before.png)
- [Baguette après](../.gstack/qa-reports/attack-qa/baguette-after.png)
- [Build de production local](../.gstack/qa-reports/attack-qa/production-build.png)

### QA-002 — Les coups ratés ou bloqués perdent leur effet dédié (gravité moyenne)

Le chemin `whiff` supprimait le marqueur visuel d’Obama et Macron. Il transmet maintenant ce marqueur, et le rendu conserve l’énergie ou les baguettes avec un effet réduit. Tests des trois situations : touche, rate, bouclier.

### QA-003 — Images demandées au premier coup et échec réseau conservé (gravité moyenne)

Le lance-flammes et le Cybertruck demandaient leur image seulement au premier rendu du pouvoir. Sur une connexion lente, la première animation pouvait finir avant le chargement. Après une erreur réseau, le cache ne réessayait jamais.

Correction : préchargement des six images de combat essentielles et des portraits configurés dès la réception du lobby ; nouvelle tentative après trois secondes en cas d’échec, limitée à trois essais. Les effets de remplacement restent disponibles pendant le chargement. Le comportement de nouvelle tentative est testé avec des échecs simulés ; le cas réseau lent n’a pas été reproduit sur un téléphone réel.

## Couverture

- 30 capacités : 10 personnages × attaque, défense, super.
- 91 états serveur par capacité, couvrant les trois secondes suivant le déclenchement.
- Avant et après : 30 déclenchements réussis, aucune exception dans le rendu de ces états.
- Relevé des images réellement dessinées : mur, énergie, microphone, lance-flammes et Cybertruck ; tampon désormais présent dans les états de Macron.
- Contrôle visuel détaillé du tampon, des baguettes, du lance-flammes, du Cybertruck et du Mic Drop.
- Contrôle du client compilé avec Socket.IO, sans exception remontée dans la console.
- Après intégration avec l’équilibrage et les dernières modifications de l’équipe : **127 tests réussis, aucun ignoré ; build réussi**.

Les listes avant/après et les résultats de téléchargement sont conservés dans `.gstack/qa-reports/attack-qa/`. Les captures sont des preuves locales, non livrées au client de production.

## Limites

Les personnages sans illustration dédiée (Biden, Harris, Maduro, Sanders, Schwarzenegger, Zelensky) utilisent encore les crânes et effets génériques du multi. Cet audit n’invente pas des assets absents et ne remplace pas leurs capacités par celles du lab.

Les tests n’établissent pas que tous les téléphones et réseaux affichent chaque animation sans perte. Ils vérifient la livraison actuelle des fichiers, les vrais états du serveur, le chemin de rendu, puis le build de production local. La vérification après publication reste à faire lors du prochain déploiement.

## Reproduire

```sh
node scripts/qa-combat-server.js
# http://127.0.0.1:3011/ : choisir une capacité, rejouer ou auditer les 30 capacités
npm run build
node scripts/qa-packaged-server.js macron-super 12
# http://127.0.0.1:3012/ : build compilé, état figé au milieu de la chute du tampon
npm test
```

Les outils de replay écoutent uniquement sur `127.0.0.1` et sont distincts du serveur de production.
