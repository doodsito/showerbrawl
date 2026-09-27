import {getImage} from './sprites.js';
// Both the pose and its nameplate follow the same settle / wake-up progress.
export function sleepLayout(nap,quiet,height=76){
 const t=quiet?1:Math.max(0,Math.min(1,(2.4-nap)/.22,nap/.28));
 const blend=t*t*(3-2*t);
 return {blend,height:height+(35-height)*blend};
}
export function drawSleep(g,p,time,quiet,standing,height=76){
 const img=getImage('sprites/biden_nap_v2.png'),layout=sleepLayout(p.nap,quiet,height),{blend}=layout;
 g.save();g.translate(p.x,p.y);g.scale(p.fx>=0?1:-1,1);
 // Fold around the body’s centre, then use the resting pose. Draw one body per frame.
 if(standing&&blend<.96){
  const w=height*standing.naturalWidth/standing.naturalHeight,angle=blend*Math.PI/2;
  const bounds=height*Math.cos(angle)+w*Math.sin(angle);
  g.save();g.translate(0,-layout.height/2);g.scale(1,layout.height/bounds);g.rotate(angle);
  g.drawImage(standing,-w/2,-height/2,w,height);g.restore();
  g.restore();return true;
 }
 const breath=quiet?0:Math.sin(time*5)*.8;
 // Keep his contact with the floor fixed while the chest expands.
 if(img)g.drawImage(img,30,248,1480,540,-46,-35-breath,92,35+breath);
 else if(standing){g.save();g.translate(0,-15);g.rotate(Math.PI/2);const w=height*standing.naturalWidth/standing.naturalHeight;g.drawImage(standing,-w/2,-height/2,w,height);g.restore();}
 else{g.fillStyle='#203453';g.fillRect(-36,-15,66,15);}
 g.strokeStyle='#bdefff';g.lineWidth=1.5;
 for(let i=0;i<3;i++){const t=quiet?i/3:(time*.5+i/3)%1;g.globalAlpha=(1-t)*blend;g.strokeRect(32+t*12,-27-t*25,3+t*4,3+t*4);}
 g.restore();return true;
}
// Velo de Biden dessine en code (plus de SVG etire): roues a jantes et rayons qui tournent autour du vrai moyeu,
// cadre diamant, fourche, guidon, selle, pedalier. Taille calee sur le sprite de Biden (~64 px de haut).
const BIKE={R:11,rear:[-19,-11],front:[19,-11],bb:[-2,-11],seat:[-8,-30],head:[13,-29]};
export function drawBicycle(g,z,project,kx,ky,quiet){
 const [x,y]=project(z.x,z.y),{R,rear,front,bb,seat,head}=BIKE,spin=quiet?0:z.age*17;
 const ln=(a,b,c,w)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();};
 g.save();g.translate(Math.round(x),Math.round(y));
 g.fillStyle='#16263555';g.beginPath();g.ellipse(0,0,30,5,0,0,Math.PI*2);g.fill();
 g.scale(z.ux>=0?1.15:-1.15,1.15);g.rotate(quiet?0:Math.sin(z.age*20)*.02);
 g.lineCap='round';g.lineJoin='round';
 for(const [cx,cy] of [rear,front]){
  g.strokeStyle='#0d1822';g.lineWidth=3.5;g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.stroke();
  g.strokeStyle='#c9d4da';g.lineWidth=1.2;g.beginPath();g.arc(cx,cy,R-2.4,0,Math.PI*2);g.stroke();
  g.strokeStyle='#dfe6ea99';g.lineWidth=.8;
  for(let i=0;i<6;i++){const a=spin+i*Math.PI/3;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a)*(R-2.6),cy+Math.sin(a)*(R-2.6));g.stroke();}
  g.fillStyle='#e9eef0';g.fillRect(cx-1.5,cy-1.5,3,3);
 }
 const top=[head[0]-1,head[1]+3],fork=[head[0]+1,head[1]+6];
 ln(rear,bb,'#8a6a1f',3);ln(rear,[seat[0]+1,seat[1]+4],'#8a6a1f',2.5);
 ln(bb,[seat[0]+1,seat[1]+4],'#e9bc52',3.2);ln([seat[0]+1,seat[1]+4],top,'#e9bc52',3.2);ln(bb,[head[0],head[1]+6],'#e9bc52',3.4);
 ln(rear,bb,'#e9bc52',2.2);ln(head,fork,'#e9bc52',3);ln(fork,front,'#c9d4da',2);
 g.fillStyle='#12202e';g.beginPath();g.ellipse(seat[0]-1,seat[1],6,2,-.08,0,Math.PI*2);g.fill();ln([seat[0]+1,seat[1]+1],[seat[0]+1,seat[1]+4],'#c9d4da',1.5);
 g.strokeStyle='#c9d4da';g.lineWidth=1.8;g.beginPath();g.moveTo(head[0],head[1]);g.lineTo(head[0]-2,head[1]-3);g.quadraticCurveTo(head[0]+6,head[1]-5,head[0]+6,head[1]+1);g.stroke();
 g.fillStyle='#12202e';g.fillRect(head[0]+4,head[1]-1,3,3);
 g.fillStyle='#b88c2c';g.beginPath();g.arc(bb[0],bb[1],3.2,0,Math.PI*2);g.fill();
 const ca=spin*.6;for(const k of [0,Math.PI]){const px=bb[0]+Math.cos(ca+k)*5,py=bb[1]+Math.sin(ca+k)*5;ln(bb,[px,py],'#c9d4da',1.5);g.fillStyle='#0d1822';g.fillRect(px-2.5,py-1,5,2);}
 g.restore();
}
