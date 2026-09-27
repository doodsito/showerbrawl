import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { networkInterfaces } from 'node:os';
import { execSync } from 'node:child_process';
import QRCode from 'qrcode';
import { MSG } from '../shared/protocol.js';
import { characters, arena, watchCharacters } from './loader.js';
import { Game } from './game.js';

const PORT = process.env.PORT || 3000;
const DEV_PORT = process.env.DEV_PORT || 5173;

// Premiere IPv4 LAN non interne, pour que les telephones du reseau local scannent le QR.
function lanIp() {
  for (const list of Object.values(networkInterfaces()))
    for (const a of list || []) if ((a.family === 'IPv4' || a.family === 4) && !a.internal) return a.address;
  return 'localhost';
}

const PUBLIC_URL = process.env.PUBLIC_URL
  || (process.env.NODE_ENV !== 'production' ? `http://${lanIp()}:${DEV_PORT}` : 'https://showerbrawl.doodsito.com');
const PLAY_URL = `${PUBLIC_URL.replace(/\/$/, '')}/play/`;
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url));

const app = express();
const httpServer = createServer(app);
// Detection rapide des connexions mortes (telephone en veille, perte reseau).
const io = new Server(httpServer, { pingInterval: 5000, pingTimeout: 5000 });

// SHA du commit qui tourne: injecte au build Docker (GIT_SHA), sinon lu dans git en local.
let SHA = process.env.GIT_SHA && process.env.GIT_SHA !== 'dev' ? process.env.GIT_SHA : null;
if (!SHA) { try { SHA = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { SHA = 'dev'; } }

app.get('/health', (req, res) => res.json({ ok: true, players: io.engine.clientsCount, sha: SHA }));
app.use(express.static(clientDist, {setHeaders(res, path) {
  if (path.endsWith('.html') || path.endsWith('/build-version.json')) res.setHeader('Cache-Control', 'no-store');
}}));

let qr = null;
try { qr = await QRCode.toDataURL(PLAY_URL, { width: 512, margin: 1 }); } catch {}

const game = new Game(io, { characters, arena, lobbyExtra: { url: PLAY_URL, qr } });
watchCharacters(() => { game.dropMissingCharacters(); game.sendLobby(); });

io.on('connection', (socket) => {
  io.emit(MSG.COUNT, io.engine.clientsCount);
  game.sendLobby(socket);

  // Client measures round-trip time with the ack callback
  socket.on(MSG.LATENCY, (ack) => typeof ack === 'function' && ack());

  socket.on(MSG.HOST, () => { console.log(`[host] ${socket.id}`); socket.data.host = true; socket.join('hosts'); game.sendLobby(); });
  socket.on(MSG.JOIN, (data, ack) => {
    let res;
    try { res = game.join(socket, data); } catch { res = { ok: false, error: 'error' }; }
    console.log(`[join] ${socket.id} key=${String(data?.playerKey || '').slice(0, 8)} char=${data?.character} ->`, res.ok ? 'ok' : `${res.error} (${res.takenBy || ''})`);
    if (typeof ack === 'function') ack(res);
  });
  // Retour volontaire au roster : liberation immediate, sans delai de reconnexion.
  socket.on('leave', (ack) => {
    if (game.phase === 'playing' && !game.queued(socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'match in progress' });
      return;
    }
    game.leave(socket.id);
    if (typeof ack === 'function') ack({ ok: true });
  });
  socket.on(MSG.INPUT, (d) => { try { game.input(socket.id, d); } catch {} });
  socket.on(MSG.START, (ack) => {
    try { game.start(); } catch (e) { console.warn('[start] erreur', e.message); }
    console.log(`[start] recu de ${socket.id}, phase=${game.phase}, joueurs=${game.players.size}`);
    if (typeof ack === 'function') ack({ ok: game.phase === 'playing', phase: game.phase, players: game.players.size });
  });

  // Hote: libere a la main le perso d'un joueur (fantome bloque).
  socket.on('kick', (id, ack) => {
    const ok = !!socket.data.host && game.kick(id);
    console.log(`[kick] ${id} par ${socket.id} ->`, ok);
    if (typeof ack === 'function') ack({ ok });
  });

  socket.on(MSG.RESET, (ack) => {
    try { game.reset(); } catch (e) { console.warn('[reset] erreur', e.message); }
    console.log(`[reset] recu de ${socket.id}, phase=${game.phase}, joueurs=${game.players.size}`);
    if (typeof ack === 'function') ack({ ok: game.phase === 'lobby' });
  });

  socket.on('disconnect', () => {
    if (!socket.data.replaced) game.disconnect(socket.id); // remplace par une reprise: rien a liberer
    if (socket.data.host) game.sendLobby(); // plus d'ecran hote: le premier joueur recupere le bouton START
    io.emit(MSG.COUNT, io.engine.clientsCount);
  });
});

httpServer.listen(PORT, () => console.log(`showerbrawl listening on :${PORT}`));
