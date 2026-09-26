// Smoke-test the production bundle with a snapshot emitted by qa-combat-server.js.
// This local-only replay never connects to production or changes a live match.
import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {fileURLToPath} from 'node:url';
const fixtures=await(await fetch('http://127.0.0.1:3011/fixtures')).json();
const picked=fixtures.cases.find(c=>c.id===(process.argv[2]||'macron-super'));
if(!picked)throw new Error('Unknown QA case');
const root=fileURLToPath(new URL('../client/dist',import.meta.url)),app=express(),http=createServer(app),io=new Server(http);
app.get('/health',(_,res)=>res.json({ok:true,sha:'qa-production-bundle'}));app.use(express.static(root));
io.on('connection',socket=>{
 const state=picked.frames[Number(process.argv[3]||12)];
 const lobby={phase:'playing',characters:fixtures.characters,arena:fixtures.arena,teams:{A:state.players.filter(p=>p.team==='A'),B:state.players.filter(p=>p.team==='B')}};
 socket.emit('lobby',lobby);socket.on('host',()=>socket.emit('lobby',lobby));
 const timer=setInterval(()=>socket.emit('state',{...state,t:Date.now(),events:[]}),50);
 socket.on('disconnect',()=>clearInterval(timer));
});
http.listen(3012,'127.0.0.1',()=>console.log('Built multiplayer QA: http://127.0.0.1:3012'));
