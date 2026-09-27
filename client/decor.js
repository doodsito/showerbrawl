// Decor de l'arene Maison Blanche, repris de laboratoire/maison-blanche/src/renderer.js (Ilan).
// Uniquement le decor: pas de combattants ni de monde. Tout est dessine en code, zero asset.
export const OCTAGON = [[275,338],[685,338],[825,390],[853,438],[735,502],[225,502],[107,438],[135,390]];
export const DECOR_W = 960, DECOR_H = 540;

export function createDecor() {
  const background=document.createElement('canvas');background.width=960;background.height=540;
  const bg=background.getContext('2d');bg.imageSmoothingEnabled=false;
  let g=bg,seed=4281;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(points,color,stroke)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.closePath();g.fillStyle=color;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}};
  const line=(x,y,x2,y2,c,width=1)=>{g.strokeStyle=c;g.lineWidth=width;g.beginPath();g.moveTo(Math.round(x),Math.round(y));g.lineTo(Math.round(x2),Math.round(y2));g.stroke();};
  const label=(text,x,y,size,color,align='center')=>{g.fillStyle=color;g.font=`900 ${size}px monospace`;g.textAlign=align;g.fillText(text,Math.round(x),Math.round(y));};
  const tones=['#172843','#1b304f','#2e3e60','#4d4563','#77506b','#a56874','#c9847d','#e5a47f','#ecc08d'];
  for(let y=0;y<320;y+=4)rect(0,y,960,4,tones[Math.min(8,Math.floor(y/34))]);
  // Sunset cloud banks, snapped to a two-pixel grid.
  for(let i=0;i<175;i++){
    const x=Math.floor(rand()*480)*2,y=46+Math.floor(rand()*95)*2,w=10+Math.floor(rand()*43)*2;
    rect(x,y,w,2+Math.floor(rand()*3)*2,['#59617a','#bc7d83','#e0a18a','#343d5c'][i%4]);
    if(i%3===0)rect(x+8,y+4,w*.6,2,'#f1b591');
  }
  rect(0,278,960,90,'#213831');rect(0,295,960,75,'#3c4c35');
  for(let i=0;i<230;i++)rect(rand()*960,288+rand()*73,4+rand()*13,2,['#586342','#4c583b','#283b30'][i%3]);
  // Distant trees around the presidential residence.
  function tree(x,y,size){
    rect(x-size*.04,y-size*.6,size*.08,size*.68,'#192c2e');
    const colors=['#142830','#1b3436','#243e3b','#304740','#405443'];
    for(let layer=0;layer<3;layer++)for(let i=0;i<36;i++){
      const a=rand()*Math.PI*2,r=Math.sqrt(rand())*size*.48;
      const px=Math.round((x+Math.cos(a)*r)/3)*3,py=Math.round((y-size*.5+Math.sin(a)*r*.85-layer*size*.1)/3)*3;
      const s=9+Math.floor(rand()*6)*3;rect(px,py,s,s*.7,colors[Math.floor(rand()*colors.length)]);
    }
  }
  for(let i=0;i<12;i++)tree(20+i*87,281,65+rand()*24);
  // White House: south facade, curved central portico, colonnade, balustrade.
  function window(x,y,w=11,h=18,lit=false){
    rect(x-2,y-2,w+4,h+5,'#ddd5b5');rect(x,y,w,h,'#3d4a52');
    rect(x+2,y+2,w-4,h-4,lit?'#b69159':'#687576');
    rect(x+Math.floor(w/2),y,1,h,'#e6ddc1');rect(x,y+h*.45,w,1,'#d5d2bb');
    rect(x-3,y+h+1,w+6,2,'#b3ac96');
  }
  rect(247,169,466,116,'#c9c8b6');rect(255,178,450,100,'#e1dcc6');
  rect(254,264,452,20,'#bcbba9');
  for(let y=185;y<279;y+=9)line(257,y,704,y,'#d6d2bd');
  rect(240,159,480,8,'#abaeaa');rect(246,154,468,5,'#ece6cf');rect(252,140,456,14,'#8e9b9e');
  rect(249,137,462,4,'#e2ddc7');
  for(let x=258;x<708;x+=11){rect(x,140,3,12,'#e3dfc9');rect(x-1,138,5,3,'#f3e7cc');}
  rect(257,151,448,3,'#e8dec6');rect(251,167,458,4,'#f8e5c4');
  for(const x of [274,314,374,573,628,674]){rect(x,119,10,18,'#aeb6b5');rect(x-3,117,16,4,'#d6d7c5');rect(x+2,112,6,5,'#53677a');rect(x+7,122,3,13,'#7b8d96');}
  for(const x of [274,302,332,363,394,554,585,616,647,675]){
    window(x,184,12,19,true);window(x,219,12,22,x%3===0);window(x+1,259,10,17,false);
    rect(x-4,211,20,3,'#a7a998');
  }
  for(const x of [255,412,542,699]){rect(x,173,7,88,'#f2e5c9');rect(x+5,176,3,86,'#b3b8a7');}
  // Projecting rounded south portico; faceted to preserve the pixel language.
  poly([[414,172],[427,160],[446,155],[512,155],[535,161],[547,172],[546,273],[414,273]],'#c9c6ac');
  poly([[414,172],[436,177],[521,177],[547,171],[543,183],[520,188],[438,188],[416,182]],'#e9dfbf');
  rect(434,188,93,74,'#b5b39e');
  for(const x of [443,471,501]){window(x,192,14,20,true);window(x,226,14,27,true);}
  // Six tall, bright columns define the recognizable curved facade.
  for(const [x,y,h] of [[418,182,78],[435,187,79],[455,189,79],[498,189,79],[519,187,79],[536,182,78]]){
    rect(x-2,y-2,11,5,'#fcf0d2');rect(x,y+3,7,h-5,'#ede5cd');rect(x+5,y+3,3,h-5,'#aaa994');
    rect(x+1,y+4,2,h-8,'#fff0d0');rect(x-2,y+h-1,12,5,'#e8dec0');
  }
  poly([[412,271],[437,276],[523,276],[549,270],[545,278],[521,284],[439,284],[415,278]],'#e4dbc0');
  rect(465,260,28,25,'#43504f');rect(471,260,15,25,'#263a42');
  for(let i=0;i<5;i++)rect(453-i*5,283+i*3,54+i*10,3,i%2?'#a6ab99':'#d9d5bb');
  poly([[411,157],[433,149],[522,149],[549,157],[549,163],[522,157],[435,157],[411,164]],'#ebe4cb');
  for(let x=418;x<547;x+=8){const yy=x<435?153:x>523?153:148;rect(x,yy-11,3,11,'#dddcc7');}
  poly([[411,143],[434,135],[523,135],[549,143],[549,147],[522,139],[435,139],[411,147]],'#eee4ca');
  // Building floodlit foundations, clipped hedges and central lawn.
  for(const x of [263,301,339,377,571,609,647,687]){
    poly([[x-7,277],[x-3,245],[x+3,245],[x+7,277]],'#e9cf9540');rect(x,278,3,2,'#ffe2a3');
  }
  for(let i=0;i<18;i++){rect(246+i*26,293,20,5,'#173a32');rect(248+i*26,290,16,5,'#355345');}
  // Fountain on the lawn, recognizable in the reference composition.
  poly([[437,309],[448,304],[511,304],[525,309],[511,314],[448,314]],'#768b86');
  rect(451,307,59,4,'#476676');rect(478,291,5,17,'#b2d7d9');rect(480,286,2,8,'#deece0');
  rect(473,298,3,8,'#9fc4cb');rect(485,298,3,8,'#9fc4cb');
  tree(231,299,95);tree(723,299,92);
  for(const [x,y,s] of [[14,269,131],[88,281,97],[856,277,108],[935,270,128]])tree(x,y,s);
  // Event lighting trusses.
  for(const x of [77,881]){
    rect(x,204,4,133,'#7d8782');rect(x+9,204,4,133,'#5a686d');
    for(let y=214;y<333;y+=13){line(x,y,x+12,y+10,'#9ca394');line(x+12,y,x,y+10,'#687c7d');}
    rect(x-16,184,46,23,'#101e2b');
    for(let row=0;row<2;row++)for(let col=0;col<4;col++){
      rect(x-14+col*11,184+row*12,11,11,'#e9b96822');rect(x-12+col*11,186+row*12,7,7,'#fff0be');
      rect(x-11+col*11,187+row*12,5,5,'#fffbe1');
    }
    poly([[x-12,208],[x+29,208],[x+120,370],[x-100,370]],'#f4d99005');
  }
  // Audience: seeded silhouettes, varied clothing, faces, raised arms, seats.
  const people=[];
  const clothes=['#384f6a','#883e4e','#cdc0a1','#182638','#5a6f7c','#b58b6e','#526153','#a1a5a5'];
  function person(x,y,s,variant,animated=false,t=0){
    const skin=['#d5a17b','#a87154','#efc39a','#75523d'][variant%4],c=clothes[variant%clothes.length];
    rect(x-s*2,y-s*5,s*4,s*5,c);rect(x-s,y-s*8,s*2,s*3,skin);rect(x-s,y-s*8,s*2,s,'#262b31');
    rect(x-s*2,y,s,s*3,'#162632');rect(x+s,y,s,s*3,'#162632');
    if(variant%5===0){const bounce=animated?Math.floor(Math.sin(t*3+variant)*1.3):0;rect(x-s*4,y-s*7+bounce,s,s*5,c);rect(x+s*3,y-s*8-bounce,s,s*6,c);rect(x-s*4,y-s*8+bounce,s,s,skin);rect(x+s*3,y-s*9-bounce,s,s,skin);}
  }
  for(let row=0;row<7;row++)for(let col=0;col<116;col++){
    const x=col*8.5+(row%2)*4+rand()*3,y=314+row*7+rand()*4,s=.8+row*.08,v=Math.floor(rand()*80);
    person(x,y,s,v);if(v%5===0&&row<4)people.push({x,y,s,v});
  }
  for(let row=0;row<13;row++)for(let col=0;col<17;col++){
    const left=col*8.4-(row*5),right=960-left,y=358+row*13+rand()*5,s=1.1+row*.06,v=Math.floor(rand()*80);
    person(left,y,s,v);person(right,y,s,v+9);
  }
  // Walkway, raised octagonal platform, mat and inset markings.
  const lower=OCTAGON.map(([x,y])=>[x,y+12]);poly(lower,'#111d2b','#09111b');
  poly(OCTAGON,'#c4c6c3','#edf0d6');
  const center=[480,422];
  const inset=amount=>OCTAGON.map(([x,y])=>[center[0]+(x-center[0])*amount,center[1]+(y-center[1])*amount]);
  poly(inset(.92),'#697784');poly(inset(.903),'#d0cfca');poly(inset(.76),'#87939a');poly(inset(.745),'#d0cfca');
  poly([[281,342],[340,342],[205,488],[232,486]],'#e6dfc830');
  for(let i=0;i<100;i++){const x=230+rand()*500,y=370+rand()*110;rect(x,y,2,1,'#9caaa31c');}
  g.save();g.translate(480,452);g.transform(1,0,-.28,.62,0,0);label('UFC',0,0,65,'#65717b');g.restore();

  function fenceEdge(a,b,height,front=false){
    const [x,y]=a,[xx,yy]=b;
    g.save();g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.lineTo(xx,yy-height);g.lineTo(x,y-height);g.closePath();g.clip();
    if(!front){g.fillStyle='#152c3920';g.fillRect(0,270,960,250);}
    const minX=Math.min(x,xx),maxX=Math.max(x,xx),minY=Math.min(y,yy)-height,maxY=Math.max(y,yy);
    for(let k=minX-120;k<maxX+120;k+=9){line(k,minY,k+100,maxY,front?'#17233370':'#2539448a');line(k,minY,k-100,maxY,front?'#17233370':'#b2bab64a');}
    g.restore();
    line(x,y-height,xx,yy-height,'#0b1727',front?5:7);line(x,y-height-2,xx,yy-height-2,'#78838c',2);
    line(x,y,xx,yy,'#263444',3);
  }
  function post(x,y,h,color){rect(x-5,y-h-3,10,h+7,'#081421');rect(x-3,y-h,6,h,color);rect(x-2,y-h,2,h,'#ffffff20');rect(x-5,y-h-3,10,3,'#949f9e');}
  // Rear cage is part of the cached scenery; foreground is drawn after fighters.
  for(const i of [6,7,0,1,2])fenceEdge(OCTAGON[i],OCTAGON[(i+1)%8],53);
  for(const i of [0,1,2,3,6,7]){const [x,y]=OCTAGON[i];post(x,y,53,i===0?'#c64652':i===1?'#386fc0':'#223343');}

  // Un seul modele de drapeau (ratio US 1.9:1), meme taille, meme onde; seul le mat s'adapte au support.
  const FLAG_W=40,FLAG_H=22;
  function flag(x,y,pole,t){
    const w=FLAG_W,h=FLAG_H,sh=h/13;
    rect(x-1,y-5,2,pole,'#aab7b8');rect(x-2,y-7,4,3,'#e4c38b');
    for(let col=0;col<w;col+=2){
      const wave=Math.round(Math.sin(col*.11-t*3)*col/w*3);
      for(let stripe=0;stripe<13;stripe++)rect(x+2+col,y+wave+Math.floor(stripe*sh),2,Math.ceil(sh),stripe%2?'#e7e2cd':'#b93e53');
      if(col<w*.4)rect(x+2+col,y+wave,2,Math.round(h*7/13),'#254c7c');
      if(col<w*.4&&col%4===2)for(let sy=2;sy<h*7/13-1;sy+=3)rect(x+2+col,y+wave+sy,1,1,'#eef0d9');
    }
  }
  return {
    // Fond fige (ciel, Maison Blanche, foule, octogone, cage arriere), rendu une seule fois.
    background,
    // Elements animes par-dessus le fond: drapeaux et foule qui leve les bras.
    animate(target, time) {
      g = target;
      flag(193,139,185,time); flag(763,139,185,time); flag(477,96,44,time);
      for (const p of people) person(p.x,p.y,p.s,p.v,true,time);
    },
    // Cage avant, dessinee apres les joueurs.
    foreground(target) {
      g = target;
      for (const i of [3,4,5]) fenceEdge(OCTAGON[i],OCTAGON[(i+1)%8],19,true);
      for (const i of [4,5]) { const [x,y]=OCTAGON[i]; post(x,y,20,'#253445'); }
    },
  };
}
