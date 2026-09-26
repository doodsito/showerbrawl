# Showerbrawl

Brawler multijoueur local: ecran hote (/) avec QR + arene, manettes mobiles (/play/). Serveur autoritaire socket.io.

- `server/loader.js` lit `shared/characters.json` + `shared/arena.json`
- `server/physics.js` grille, cercles, knockback, chute hors toit
- `server/abilities.js` 5 briques (projectile, burst, zone, dash, shield) parametrees par le JSON
- `server/game.js` boucle a CONFIG.TICK_RATE, equipes A/B, timer, MVP
- `client/` ecran hote (host.js, scene.js, sprites.js, sfx.js), `client/play/` manette
- Contrats figes: `shared/protocol.js`, `shared/config.js`

Dev: `npm run build && npm start` puis http://localhost:3000 (hote) et /play/ (manette).

## Execution Rules
- Stack ES modules partout (`import`, jamais `require`).
- Port 3000 (env PORT defaut 3000) et `GET /health` => `{ok:true}` intouchables.
- Subagents paralleles uniquement sur des fichiers distincts; protocol.js et config.js ne se modifient pas.
- Commit apres chaque fichier fonctionnel, commits atomiques.
- Push sur main des que ca compile, meme a moitie. Build casse => corriger et repush.
- Ne jamais toucher `references/` ni `perso/`.
