# Arène Maison Blanche

Carte en pixel art dessinée en Canvas, avec un combat local contre une IA. Le décor reste celui validé dans le prototype ; l’image de conception n’est pas utilisée comme fond.

## Lancer

Depuis la racine du projet :

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory laboratoire
```

Ouvrir [l’arène locale](http://127.0.0.1:8765/maison-blanche/).

- Déplacement : flèches, ZQSD ou WASD, ou pavé tactile.
- Attaque : J / 1 ; garde maintenue : K / 2 ; super chargé : L / 3.
- Espace : pause/reprise ; R : recommencer.
- Désactiver « Adversaire actif » pour s’entraîner.
- Le plein écran inclut les commandes et un bouton de sortie.

## Vérification

```sh
node --test laboratoire/maison-blanche/tests/*.test.js
```

Simulation : déplacements, limites de cage, dégâts, garde, super, KO et chronomètre. Régressions de l’interface : frappes rapides, plusieurs touches maintenues, pause sur perte de focus, plein écran et stabilité des textes.

Le contrôle visuel est fait dans le navigateur. Voir le [rapport QA](VERIFICATION.md).

## Périmètre

Prototype autonome livré à l’équipe : aucune dépendance externe, aucun serveur de combat ni multijoueur. La navigation est limitée à l’arène ; les laboratoires de personnages du poste de développement ne sont pas inclus. Aucun changement au jeu principal ni à son déploiement.
