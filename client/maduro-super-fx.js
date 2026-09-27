import {getImage} from './sprites.js';
const FRAMES={windup:[26,71,537,515],flight:[609,167,626,284],hit:[36,605,527,607],miss:[553,947,682,193]};
export function mustacheLayout(m,quiet){
  if(!m)return null;
  const height=m.phase==='flight'?65:m.phase==='miss'?35:m.phase==='hit'?110:96;
  const lift=m.phase==='flight'?22+(quiet?0:Math.sin(m.age*18)*2):m.phase==='hit'?(quiet?0:Math.sin(Math.min(1,m.age/.35)*Math.PI)*15):0;
  return {height,lift};
}
export function drawMustache(g,p,quiet){
  const m=p.mustache;if(!m||!p.alive)return false;
  const img=getImage('sprites/maduro_mustache_v1.png');if(!img)return false;
  const phase=m.phase,[sx,sy,sw,sh]=FRAMES[phase]||FRAMES.windup;
  const {height:h,lift}=mustacheLayout(m,quiet),w=h*sw/sh;
  const flip=m.ux>=0?1:-1;
  g.save();g.translate(p.x,p.y-lift);g.scale(flip,1);
  if(phase==='flight'&&!quiet){
    for(let i=0;i<3;i++){g.strokeStyle=['#6aa5ff99','#ffe591aa','#e7f2ff99'][i];g.lineWidth=2;g.beginPath();g.moveTo(-85-i*8,-22-i*12);g.lineTo(-42,-22-i*12);g.stroke();}
  }
  if(phase==='windup'){
    g.strokeStyle='#ffd467';g.lineWidth=2;g.globalAlpha=.3+.6*Math.min(1,m.age/m.delay);
    g.beginPath();g.ellipse(0,-45,38,52,0,0,Math.PI*2);g.stroke();g.globalAlpha=1;
  }
  // Place the forward fist near the authoritative contact point.
  const left=phase==='flight'?-w*.74:-w*.5;
  g.translate(left,-h);g.scale(h/sh,h/sh);
  if(phase==='hit'){
    // The two lower poses nearly touch: exclude the neighbour's trailing shoe.
    g.beginPath();g.moveTo(0,0);g.lineTo(sw,0);g.lineTo(sw,325);g.lineTo(499,325);g.lineTo(499,sh);g.lineTo(0,sh);g.closePath();g.clip();
  }
  const k=img.naturalWidth/1254; // coords de la planche d'origine 1254x1254
  g.drawImage(img,sx*k,sy*k,sw*k,sh*k,0,0,sw,sh);g.restore();return true;
}
export function drawMustacheWarning(g,p,project,kx,ky){
  const m=p.mustache;if(!m||m.phase!=='windup'||!p.alive)return;
  const [x,y]=project(p.x,p.y),[tx,ty]=project(p.x+m.ux*m.range,p.y+m.uy*m.range);
  const wx=-m.uy*24*kx,wy=m.ux*24*ky;
  g.save();g.fillStyle=p.team==='A'?'#5599ff25':'#ff776625';g.strokeStyle='#f6ce69';g.lineWidth=1.5;
  g.beginPath();g.moveTo(x+wx,y+wy);g.lineTo(tx+wx,ty+wy);g.lineTo(tx-wx,ty-wy);g.lineTo(x-wx,y-wy);g.closePath();g.fill();g.stroke();
  g.globalAlpha=.4+.5*Math.min(1,m.age/m.delay);g.setLineDash([7,5]);g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty);g.stroke();g.restore();
}
export function drawMustacheImpact(g,e,project,front,quiet){
  const [x,y]=project(e.x,e.y),t=e.age/e.duration;
  g.save();g.globalAlpha=Math.max(0,1-t);
  if(e.kind==='mustacheMiss'){
    if(!front){g.strokeStyle='#c9b49c';g.lineWidth=3;g.beginPath();g.ellipse(x,y,20+t*35,5+t*8,0,0,Math.PI*2);g.stroke();}
    else for(let i=0;i<3;i++){const a=i*2.1+(quiet?0:t*4);g.fillStyle='#ffdb68';g.fillRect(x+Math.cos(a)*22,y-42+Math.sin(a)*6,4,4);}
  }else if(front){
    g.translate(x+(e.ux||0)*22,y-45);g.strokeStyle='#ffe29b';g.lineWidth=4;
    for(let i=0;i<7;i++){const a=-2.8+i*.4,r=15+t*38;g.beginPath();g.moveTo(Math.cos(a)*r*.5,Math.sin(a)*r*.5);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.stroke();}
  }
  g.restore();
}
