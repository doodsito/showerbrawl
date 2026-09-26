import {getImage} from './sprites.js';
export function drawSleep(g,p,time,quiet){
 const img=getImage('sprites/biden_sleep.png'),t=quiet?1:Math.min(1,(2.4-p.nap)/.22,p.nap/.28);
 if(t<.95)return false;
 g.save();g.translate(p.x,p.y);g.scale(p.fx>=0?1:-1,1);
 const breath=quiet?0:Math.sin(time*5)*1.2;
 if(img)g.drawImage(img,650,420,440,180,-42,-27-breath,84,35);
 else{g.fillStyle='#203453';g.fillRect(-36,-15,66,15);}
 g.strokeStyle='#bdefff';g.lineWidth=1.5;
 for(let i=0;i<3;i++){const t=quiet?i/3:(time*.5+i/3)%1;g.globalAlpha=1-t;g.strokeRect(-32-t*12,-27-t*25,3+t*4,3+t*4);}
 g.restore();return true;
}
export function drawBicycle(g,z,project,kx,ky,quiet){
 const [x,y]=project(z.x,z.y),img=getImage('sprites/biden_bicycle.svg');
 g.save();g.translate(x,y-8);g.scale(z.ux>=0?1:-1,1);
 g.rotate(quiet?0:Math.sin(z.age*20)*.025);
 g.fillStyle='#16263566';g.beginPath();g.ellipse(0,8,40,8,0,0,Math.PI*2);g.fill();
 if(img)g.drawImage(img,-43,-46,86,57);
 else{g.strokeStyle='#ebce68';g.lineWidth=3;g.strokeRect(-26,-22,52,20);}
 if(!quiet){g.strokeStyle='#e5eaf0';g.lineWidth=1;for(const cx of [-25,25])for(let i=0;i<4;i++){const a=z.age*17+i*Math.PI/2;g.beginPath();g.moveTo(cx,-5);g.lineTo(cx+Math.cos(a)*12,-5+Math.sin(a)*12);g.stroke();}}
 g.restore();
}
