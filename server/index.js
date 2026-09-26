import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3000;
const clientDist = fileURLToPath(new URL('../client/dist', import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.get('/health', (req, res) => res.json({ ok: true, players: io.engine.clientsCount }));
app.use(express.static(clientDist));

io.on('connection', (socket) => {
  io.emit('count', io.engine.clientsCount);

  // Client measures round-trip time with the ack callback
  socket.on('latency', (ack) => typeof ack === 'function' && ack());

  // Placeholder for game inputs, used by the load test
  socket.on('input', () => {});

  socket.on('disconnect', () => io.emit('count', io.engine.clientsCount));
});

httpServer.listen(PORT, () => console.log(`showerbrawl listening on :${PORT}`));
