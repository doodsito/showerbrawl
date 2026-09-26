# Vérification de l’arène

26 septembre 2026 — prototype autonome en Canvas.

## Tests automatisés

54 tests réussis : limites de l’octogone, collisions, portée, endurance, garde, super, recul, KO, chronomètre, IA, frappes rapides, touches simultanées, plein écran, stabilité des textes et pause sur perte de focus.

```sh
node --test laboratoire/maison-blanche/tests/*.test.js
```

Les tests d’interface exécutent le vrai adaptateur et la simulation avec un DOM simulé. Le dessin Canvas est vérifié dans le navigateur.

## Nouveaux contrôles du combat

- Mur MAGA : perspective et collisions partagent la même base ; placement, dégâts, expiration et destruction testés.
- Trump : projection animée jusqu’à la cage, murs rencontrés, pause et KO après arrivée.
- Obama : projectile mobile, interception par le mur, recul progressif et garde ; esquive longue sans traverser murs, corps ou cage ; zone Mic Drop évitable, impact unique et destruction des murs.
- Fuite : distance gagnée après un échange et ralentissement pendant une attaque.
- Changement de personnage : remise à zéro du combat et mise à jour des capacités.
- Animation du Mic Drop, sprites et effets contrôlés dans le navigateur ; aucune erreur JavaScript observée.

## QA visuel et interactions

- Largeurs contrôlées : 320, 375, 768, 820, 1024 et 1440 pixels ; aucun débordement horizontal détecté.
- Les boutons Pause/Rejouer ne coupent plus leur texte sur mobile. Descriptions agrandies et contraste renforcé à l’arrêt.
- Flèches tactiles de 40 × 40 pixels ; charge du super alignée ; inscriptions des poteaux ajustées.
- Plein écran : scène et commandes incluses, bouton de sortie disponible. Accès confirmé dans l’arbre d’accessibilité et par les dimensions du DOM.
- Lancement, attaque, pause/reprise et KO vérifiés pendant le développement ; logique de revanche couverte par la réinitialisation de la simulation.
- Pas d’erreur JavaScript observée dans le navigateur intégré.

## Limites

Pas de vérification sur téléphone physique ou en multijoueur. Les captures du navigateur intégré en plein écran avec taille simulée présentent une anomalie d’échelle ; les dimensions et commandes ont été contrôlées directement. Ce prototype ne modifie ni le client principal ni le déploiement de Showerbrawl.
