import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { MSG } from '../shared/protocol.js';
import { characters, arena } from './loader.js';
import { Game } from './game.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://showerbrawl.doodsito.com';
const PLAY_URL = `${PUBLIC_URL.replace(/\/$/, '')}/play/`;
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.get('/health', (req, res) => res.json({ ok: true, players: io.engine.clientsCount }));
app.use(express.static(clientDist));

let qr = null;
try { qr = await QRCode.toDataURL(PLAY_URL, { width: 512, margin: 1 }); } catch {}

const game = new Game(io, { characters, arena, lobbyExtra: { url: PLAY_URL, qr } });

io.on('connection', (socket) => {
  io.emit(MSG.COUNT, io.engine.clientsCount);
  game.sendLobby(socket);

  // Client measures round-trip time with the ack callback
  socket.on(MSG.LATENCY, (ack) => typeof ack === 'function' && ack());

  socket.on(MSG.HOST, () => { socket.data.host = true; game.sendLobby(socket); });
  socket.on(MSG.JOIN, (data, ack) => {
    let res;
    try { res = game.join(socket, data); } catch { res = { ok: false, error: 'erreur' }; }
    if (typeof ack === 'function') ack(res);
  });
  socket.on(MSG.INPUT, (d) => { try { game.input(socket.id, d); } catch {} });
  socket.on(MSG.START, () => { try { game.start(); } catch {} });

  socket.on('disconnect', () => {
    game.leave(socket.id);
    io.emit(MSG.COUNT, io.engine.clientsCount);
  });
});

httpServer.listen(PORT, () => console.log(`showerbrawl listening on :${PORT}`));
