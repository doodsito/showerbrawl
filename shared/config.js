// Toutes les valeurs reglables de la partie au meme endroit.
// Le serveur lit ces valeurs, on les ajuste ici pendant les tests sans fouiller le code.

export const CONFIG = {
  TICK_RATE: 20, // ticks serveur par seconde (todo: 20/s)
  BROADCAST_RATE: 20, // envois d'etat par seconde
  MATCH_DURATION: 120, // secondes (deathmatch equipe 2 min)
  RESPAWN_TIME: 3, // secondes
  SPAWN_PROTECTION: 2, // secondes d'invulnerabilite au respawn
  MAX_PLAYERS: 20, // 10v10
  TEAMS: ['A', 'B'],
  PLAYER_RADIUS: 18,
  KNOCKBACK: 1.0, // multiplicateur de recul sur impact
  KILL_HEAL: 25, // PV rendus au tueur a chaque kill (plafonne a maxHp), comme le siphon de magic-arena
  REGEN_PER_SEC: 1, // regeneration passive en PV/s...
  REGEN_DELAY: 3, // ...seulement apres N secondes hors combat (ni coup donne ni coup recu)
};
