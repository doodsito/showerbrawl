import {getImage} from './sprites.js';

// Tight crops within the existing 11-frame strip. Frames 0–5 belong to the
// caster; 6–9 belong to the impact. The title card is never drawn as a fighter.
const CROPS=[[102,57,82,103],[92,95,98,65],[91,65,104,94],[90,50,106,109],[43,32,200,127],[92,7,101,153],
  [92,39,101,121],[75,26,135,134],[58,20,170,139],[19,6,248,154]];
function frame(g,n,x,y,h,flip=1,alpha=1){
  const img=getImage('sprites/harris_super_anim.png');if(!img)return false;
  const [sx,sy,sw,sh]=CROPS[n],w=h*sw/sh;
  g.save();g.globalAlpha*=alpha;g.translate(x,y);g.scale(flip,1);
  g.drawImage(img,n*286+sx,sy,sw,sh,-w/2,-h,w,h);g.restore();return true;
}
export function drawKamalaPose(g,p,z,quiet){
  if(!z||!p.alive||z.age>=z.delay)return false;
  const n=quiet?0:Math.min(5,Math.floor(z.age/z.delay*6));
  return frame(g,n,p.x,p.y,n===1?58:n===2?72:96,p.fx>=0?1:-1);
}
export function drawKamalaImpact(g,z,project,quiet){
  if(z.age<z.delay)return;
  const after=z.age-z.delay,n=quiet?9:6+Math.min(3,Math.floor(after/.12));
  const [x,y]=project(z.x,z.y);
  frame(g,n,x,y+15,120,z.ux>=0?1:-1,Math.min(1,(z.duration-z.age)/.35));
}
export function drawSonicWave(g,shot,project,kx,ky){
  const [x,y]=project(shot.x,shot.y);
  g.save();g.translate(x,y-55);g.rotate(Math.atan2(shot.vy*ky,shot.vx*kx));
  g.lineCap='round';
  for(let i=0;i<2;i++){
    g.strokeStyle=i?'#f2d9ff':'#b35cff';g.lineWidth=i?3:5;
    g.beginPath();g.arc(-8-i*8,0,19+i*6,-.85,.85);g.stroke();
  }
  g.restore();
}
export function drawSpeaking(g,e,project,kx,ky,front){
  const [x,y]=project(e.x,e.y),t=e.age/e.duration;
  g.save();g.globalAlpha=Math.min(1,(1-t)*2);
  if(front){
    g.font='900 13px monospace';g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='#241733';g.fillRect(x-60,y-145,120,25);
    g.strokeStyle='#f4ce77';g.lineWidth=2;g.strokeRect(x-60,y-145,120,25);
    g.fillStyle='#ffe4a6';g.fillText("I'M SPEAKING",x,y-132);
  }else{
    const r=e.r*Math.min(1,.4+t*2);g.strokeStyle='#f4ce77';g.lineWidth=4;
    g.beginPath();g.ellipse(x,y,r*kx,r*ky,0,0,Math.PI*2);g.stroke();
  }
  g.restore();
}
