# Arène Maison Blanche

Carte en pixel art dessinée en Canvas, avec un combat local contre une IA. Le décor reste celui validé dans le prototype ; l’image de conception n’est pas utilisée comme fond.

Les designs de Trump et Obama fournis par l’équipe sont disponibles via le sélecteur « Jouer avec ». L’adversaire prend automatiquement l’autre personnage. Changer de personnage réinitialise le combat. Voir la [provenance des images](assets/README.md). Le labo reste un prototype autonome : ces capacités ne modifient pas le jeu multijoueur principal.

« Mouvements améliorés » permet de comparer le rendu initial avec un balancement lié à la distance parcourue, une inclinaison de marche, une respiration légère, un retour progressif après les coups et une transition de garde. L’animation s’arrête quand le personnage bute sur la cage. Les positions et les dégâts du combat restent gérés par la simulation ; les animations sont uniquement visuelles.

Pour articuler réellement les jambes et les bras, le prochain livrable graphique est une planche d’animation alignée sur les mêmes pieds : repos (4 poses), marche (6 poses), coup (4 poses), garde (2 poses), coup reçu (2 poses) et KO (4 poses). Le personnage, sa taille et sa palette doivent rester cohérents d’une pose à l’autre. La phase de contact du coup devra être synchronisée avec l’application des dégâts.

## Lancer

Depuis la racine du projet :

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory laboratoire
```

Ouvrir [l’arène locale](http://127.0.0.1:8765/maison-blanche/).

- Déplacement : flèches, ZQSD ou WASD, ou pavé tactile.
- Attaque : J / 1 ; capacité défensive (mur ou esquive) : K / 2 ; super chargé : L / 3.
- Garde classique : maintenir Maj au clavier.
- Espace : pause/reprise ; R : recommencer.
- Désactiver « Adversaire actif » pour s’entraîner.
- Le plein écran inclut les commandes et un bouton de sortie.

## Obama — kit expérimental local

Le dépôt fournit les images d’Obama, du projectile et du Mic Drop, mais aucune configuration de capacités pour Obama dans `shared/characters.json` au moment de l’intégration. Ce kit est donc une proposition locale à tester.

- J / 1 : énergie, projectile rectiligne à 440 unités/seconde, portée 340, 10 dégâts, coût 15 endurance. Un impact charge le super de 20 % et projette la cible progressivement sur 125 unités (45 en garde), en respectant les murs et la cage. Le mur MAGA le bloque et perd 12 PV.
- K / 2 : esquive de 238 unités environ sur 0,28 seconde dans la direction tenue, ou à l’opposé de l’adversaire sans direction. Coût 25 endurance, recharge 3,5 secondes. Respecte cage, corps et murs ; ne rend pas invulnérable.
- L / 3 : Mic Drop, à 100 % de charge. La zone est fixée au lancement, à 300 unités maximum. Le micro tombe après 0,85 seconde ; rayon 110, 28 dégâts, projection de 100 unités et destruction des murs dans la zone. La cible peut sortir du cercle avant l’impact. Le gros micro marque une suspension puis accélère vers le sol ; le choc produit trois vagues, un cratère temporaire, des poussières, un rebond et un bref tremblement. Aucun texte n’est affiché dans l’effet : le visuel typographique fourni sert uniquement d’icône.
- L’IA sait tirer à distance et utiliser l’esquive et le Mic Drop lorsqu’on joue Trump.

## Déplacement et fuite

Les deux combattants se déplacent à 180 unités/seconde (contre 135 auparavant), avec un facteur vertical de 0,72 adapté à la perspective. Une attaque réduit temporairement la vitesse à 45 % pendant sa récupération. Un coup normal immobilise la cible 0,10 seconde. Relâcher l’attaque et la garde permet donc de sortir de portée après un coup reçu ; maintenir l’attaque ralentit la fuite. Les mêmes règles s’appliquent à Trump et à son adversaire. L’endurance faible ne ralentit pas la course. Pour vraiment décrocher, un déplacement qui s’éloigne d’un adversaire proche passe automatiquement à 300 unités/seconde, dès que la récupération du coup est finie et que la garde est relâchée. Le bonus cesse à 160 unités de distance ; avancer vers l’adversaire reste à 180. Aucun bouton supplémentaire.

## Super « You’re fired! »

À 100 % de charge, L / 3 déclenche une courte réplique « YOU’RE FIRED! » au-dessus de Trump. À portée (105 unités), la cible subit 30 dégâts puis traverse le ring en 0,56 seconde jusqu’à la cage opposée. La garde réduit les dégâts à 8, mais pas la projection. Le déplacement est animé avec une trajectoire visuelle en arc et une traînée ; la pause fige aussi cette animation. Un KO est annoncé après l’arrivée.

Un mur entre les deux personnages absorbe le coup et se brise. Une fois projetée, la cible détruit les murs rencontrés derrière elle. Un super hors de portée consomme sa charge sans toucher la cible.

## Mur MAGA

Un appui pose un obstacle fixe devant Trump si l’emplacement est libre et dans l’octogone. Il bloque les deux combattants et intercepte les attaques. Il possède 36 PV : trois directs (12 dégâts au mur) ou un super (36 dégâts) le détruisent. Le coup qui le détruit ne traverse pas jusqu’au combattant derrière. Les impacts sur le mur chargent aussi le super.

Le mur disparaît après 6 secondes, avec une recharge de 9 secondes à partir de la pose. Les timers s’arrêtent en pause. L’IA frappe le mur si celui-ci bloque son approche. L’interface affiche sa vie, sa durée restante puis la recharge. Sa maçonnerie est dessinée en perspective oblique ; les collisions suivent les mêmes sommets que sa base visible. Le PNG frontal reste utilisé pour l’icône. Son rendu possède une montée à l’apparition, une ombre au sol, des fissures et des débris.

## Vérification

```sh
node --test laboratoire/maison-blanche/tests/*.test.js
```

Simulation : déplacements, limites de cage, dégâts, garde, super, KO, chronomètre, placement du mur, collisions, destruction, expiration et comportement de l’IA. Régressions de l’interface : frappes rapides, plusieurs touches maintenues, pause sur perte de focus, plein écran et stabilité des textes.

Le contrôle visuel est fait dans le navigateur. Voir les [vérifications](VERIFICATION.md).

Les impacts sont rendus sans onomatopées, image POW ni nombres flottants : vitesse de projection, compression puis rebond du personnage, vibration locale du grillage, onde au sol, poussière et fragments animés. Les vies et la charge restent lisibles dans l’interface.
