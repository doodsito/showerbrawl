// Contrat réseau Shower Brawl. Ne pas renommer sans prévenir les 3 équipes.
// Un seul endroit qui nomme les messages socket.io, importé serveur ET client.

export const MSG = {
  // Client -> serveur
  JOIN: 'join', // { team, character }  team: 'A' | 'B', character: id dans characters.json
  INPUT: 'input', // { dx, dy, attack, defense, super }  dx/dy dans [-1,1], boutons = bool
  // Hôte (écran) -> serveur
  HOST: 'host', // aucun payload, déclare ce socket comme écran hôte
  START: 'start', // aucun payload, lance la manche depuis le lobby
  RESET: 'reset', // aucun payload, arrete la manche en cours et revient au lobby (joueurs gardes)
  // Serveur -> tous
  LOBBY: 'lobby', // { teams: { A: [{id,name,character}], B: [...] } }
  STATE: 'state', // { t, players[], projectiles[], zones[], score, timeLeft } a 20/s
  ME: 'me', // { hp, maxHp, alive, respawnIn, energy, cd, score, timeLeft, countdown } a 20/s, a chaque joueur sur son socket
  END: 'end', // { score, mvp }
  // Infra (deja utilise par server/index.js actuel)
  COUNT: 'count', // nombre de connectes
  LATENCY: 'latency', // ping avec ack callback
};

// Types de briques de pouvoir autorises. characters.json ne peut utiliser QUE ceux-la.
export const ABILITY_TYPES = ['projectile', 'burst', 'zone', 'dash', 'shield'];
