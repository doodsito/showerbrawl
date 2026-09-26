// Simulates N players sending inputs at 20/s and reports round-trip latency.
// Usage: node scripts/loadtest.js [url] [players] [seconds]
import { io } from 'socket.io-client';

const url = process.argv[2] || 'http://localhost:3000';
const players = Number(process.argv[3] || 20);
const seconds = Number(process.argv[4] || 20);
const samples = [];

const sockets = Array.from({ length: players }, () => {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  socket.on('connect_error', (err) => console.error('connect_error:', err.message));
  setInterval(() => socket.emit('input', { dx: Math.random() - 0.5, dy: Math.random() - 0.5, attack: true }), 50);
  setInterval(() => {
    const start = performance.now();
    socket.emit('latency', () => samples.push(performance.now() - start));
  }, 500);
  return socket;
});

setTimeout(() => {
  const connected = sockets.filter((s) => s.connected).length;
  const sorted = samples.sort((a, b) => a - b);
  const pct = (p) => Math.round(sorted[Math.floor((sorted.length - 1) * p)] ?? NaN);
  console.log(`${connected}/${players} connected, ${sorted.length} samples`);
  console.log(`latency ms: p50=${pct(0.5)} p95=${pct(0.95)} max=${pct(1)}`);
  process.exit(connected === players ? 0 : 1);
}, seconds * 1000);
