import { io } from 'socket.io-client';

const socket = io();
const $ = (id) => document.getElementById(id);

socket.on('connect', () => ($('status').textContent = `connecté (${socket.io.engine.transport.name})`));
socket.on('disconnect', () => ($('status').textContent = 'déconnecté'));
socket.on('count', (n) => ($('count').textContent = `${n} connecté(s)`));

setInterval(() => {
  const start = performance.now();
  socket.emit('latency', () => ($('latency').textContent = `${Math.round(performance.now() - start)} ms`));
}, 1000);
