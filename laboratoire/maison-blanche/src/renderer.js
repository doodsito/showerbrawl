import {OCTAGON,RULES} from './combat.js?v=obama-4';
import {wallCorners} from './wall.js';
import {createMotion,sampleMotion} from './motion.js?v=obama-4';

// The scenery stays procedural. Character art comes from the team's PNG exports.
export function createRenderer(canvas) {
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const art={};
  const motions=new WeakMap();
  let motionOptions={enhanced:true,reducedMotion:false};
  const assetsReady=Promise.all(['trump','obama','obama_attack','maga_wall','punch_fx'].map(name=>new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{art[name]=img;resolve({name,loaded:true});};
    img.onerror=()=>resolve({name,loaded:false});
    img.src=new URL(`../assets/${name}.png`,import.meta.url).href;
  }))).then(results=>({loaded:results.filter(r=>r.loaded).map(r=>r.name),failed:results.filter(r=>!r.loaded).map(r=>r.name)}));
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
  rect(477,97,2,39,'#cfd5cb');rect(476,96,4,3,'#ebd39a');
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
  function screen(x){rect(x-3,249,85,47,'#0b1724');rect(x,252,79,41,'#5d6678');rect(x+2,254,75,37,'#192d4b');poly([[x+2,254],[x+31,254],[x+77,289],[x+48,289]],'#9e3449');label('UFC',x+40,280,22,'#faf0da');rect(x+37,296,4,22,'#172730');}
  screen(119);screen(765);
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
  g.save();g.translate(480,446);g.transform(1,0,-.28,.62,0,0);label('UFC',0,0,65,'#65717b');g.restore();
  label('SOUTH LAWN',480,467,8,'#87918f');
  g.save();g.translate(246,393);g.rotate(-.31);label('RED CORNER',0,0,9,'#ad4c58');g.restore();
  g.save();g.translate(714,393);g.rotate(.31);label('BLUE CORNER',0,0,9,'#477397');g.restore();

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
  function post(x,y,h,color){rect(x-5,y-h-3,10,h+7,'#081421');rect(x-3,y-h,6,h,color);rect(x-2,y-h,2,h,'#ffffff20');rect(x-5,y-h-3,10,3,'#949f9e');if(h>35){g.save();g.translate(x,y-h+13);g.rotate(Math.PI/2);label('UFC',10,2,7,'#e5e8df');g.restore();}}
  // Rear cage is part of the cached scenery; foreground is drawn after fighters.
  for(const i of [6,7,0,1,2])fenceEdge(OCTAGON[i],OCTAGON[(i+1)%8],53);
  for(const i of [0,1,2,3,6,7]){const [x,y]=OCTAGON[i];post(x,y,53,i===0?'#c64652':i===1?'#386fc0':'#223343');}

  function flag(x,y,w,h,t){
    rect(x-1,y-5,2,185,'#aab7b8');rect(x-2,y-7,4,3,'#e4c38b');
    for(let col=0;col<w;col+=2){
      const wave=Math.round(Math.sin(col*.11-t*3)*col/w*4);
      for(let stripe=0;stripe<13;stripe++)rect(x+2+col,y+wave+stripe*h/13,2,Math.ceil(h/13),stripe%2?'#e7e2cd':'#b93e53');
      if(col<w*.43)rect(x+2+col,y+wave,2,h*7/13,'#254c7c');
      if(col<w*.43&&col%6===0)for(let sy=3;sy<h*7/13;sy+=5)rect(x+2+col,y+wave+sy,1,1,'#eef0d9');
    }
  }
  function fighter(f,time){
    const x=Math.round(f.x),y=Math.round(f.y),red=f.id===0,main=red?'#ca3f51':'#3575c3',light=red?'#fa6970':'#70a6ed';
    const step=f.walking?Math.round(Math.sin(time*15)*3):0,bob=f.walking?Math.abs(step)*.4:Math.round(Math.sin(time*3))*1;
    const sprite=art[f.character||'trump'];
    if(sprite){
      // A single supplied pose. Keep its feet planted and blend body motion.
      if(!motions.has(f))motions.set(f,createMotion(f,time));
      const sampled=sampleMotion(f,time,motions.get(f),motionOptions);
      const attacking=f.pose>0;
      const motion=motionOptions.enhanced||motionOptions.reducedMotion?sampled:{x:attacking?f.face*(f.kind==='super'?10:6):0,y:bob,angle:0,sx:1,sy:1,guard:f.guard?1:0,step:0,shadow:1};
      if(f.launch&&!motionOptions.reducedMotion){
        const t=f.launch.elapsed/f.launch.duration;
        motion.y-=Math.sin(t*Math.PI)*35;motion.angle=-f.launch.direction*.38;motion.sx=1.05;
        for(let i=0;i<4;i++)line(x-f.launch.direction*(24+i*11),y-45+motion.y+i*8,x-f.launch.direction*(44+i*13),y-45+motion.y+i*8,'#f8df9a99',2);
      }
      if(f.dash&&!motionOptions.reducedMotion){
        motion.angle=f.dash.dx*.22;motion.y-=Math.sin((1-f.dash.remaining/RULES.dashDuration)*Math.PI)*14;
        for(let i=1;i<6;i++){g.save();g.globalAlpha=.25/i;g.translate(x-f.dash.dx*i*16,y+motion.y-f.dash.dy*i*11);g.scale(f.face,1);g.drawImage(sprite,-48,-94,96,96);g.restore();}
      }
      if(f.shove&&!motionOptions.reducedMotion){
        motion.angle=-f.shove.dx*.27;motion.y-=Math.sin((1-f.shove.remaining/f.shove.duration)*Math.PI)*8;
        for(let i=0;i<4;i++)line(x-f.shove.dx*(25+i*8),y-32+i*6,x-f.shove.dx*(48+i*10),y-32+i*6,'#b2eaffaa',2);
      }
      if(f.recoil>0&&!motionOptions.reducedMotion){
        const t=1-f.recoil/.42,bounce=Math.sin(t*Math.PI),compress=Math.max(0,1-t/.22);
        motion.x-=f.recoilDirection*bounce*18;motion.y-=bounce*9;
        motion.sx=1-compress*.3;motion.sy=1+compress*.13;
        motion.angle=f.recoilDirection*(compress*.23-bounce*.3);
      }
      const shadow=22*motion.shadow;
      poly([[x-shadow,y],[x-14,y-5],[x+14,y-5],[x+shadow,y],[x+14,y+5],[x-14,y+5]],'#16263570');
      line(x-20,y+3,x+20,y+3,light,3);
      if(motion.step>.65){
        rect(x-19,y-1,3,2,'#ece4cb88');rect(x+17,y,3,2,'#ece4cb88');
      }
      g.save();g.translate(x+motion.x,y+motion.y);g.rotate(motion.angle);g.scale(f.face*motion.sx,motion.sy);
      if(f.flash>0)g.globalAlpha=.8;
      if(f.character==='obama')g.drawImage(sprite,-48,-94,96,96);else g.drawImage(sprite,-45,-87,90,87);
      g.restore();
      if(motion.guard>.03){g.save();g.globalAlpha=motion.guard;line(x-25,y-64,x+25,y-64,'#81b7e9',2);line(x+f.face*28,y-61,x+f.face*28,y-34,'#81b7e9',2);g.restore();}
      if(attacking&&f.kind==='super'){for(let i=0;i<4;i++)rect(x+f.face*(35+i*8),y-56+i%2*8,6,2,'#f1d78b');}
      if(f.id===0)poly([[x-4,y-96],[x+4,y-96],[x,y-91]],'#ff7378');
      return;
    }
    g.save();g.translate(x,y);g.scale(f.face,1);
    poly([[-18,0],[-11,-4],[13,-4],[20,0],[13,4],[-12,4]],'#34465655');
    // Feet and legs, dark contour followed by lit muscle clusters.
    rect(-12-step,-22,9,18,'#232d38');rect(5+step,-22,9,18,'#232d38');
    rect(-10-step,-21,5,15,'#c18d67');rect(7+step,-21,5,15,'#d6a078');
    rect(-13-step,-7,11,5,'#1b2937');rect(5+step,-7,13,5,'#1b2937');
    rect(-12-step,-6,9,2,'#e0ccaa');rect(6+step,-6,10,2,'#e0ccaa');
    rect(-13,-31+bob,27,14,'#132536');rect(-11,-29+bob,10,10,main);rect(3,-29+bob,9,10,main);rect(-11,-30+bob,23,3,'#e2d8bd');rect(-1,-24+bob,4,7,'#132536');
    // Torso, shoulders and chest shading.
    rect(-12,-51+bob,25,22,'#3d3435');rect(-10,-50+bob,22,20,'#d39b70');rect(-7,-48+bob,14,15,'#e5b387');rect(-9,-35+bob,7,4,'#a46c51');rect(2,-35+bob,8,3,'#ba7c56');rect(-1,-47+bob,1,12,'#bf855f');
    rect(-5,-57+bob,12,9,'#bc825b');rect(-7,-70+bob,19,17,'#332c2b');rect(-5,-67+bob,16,13,'#e1ad80');rect(8,-63+bob,6,6,'#d39b70');rect(-7,-71+bob,19,6,'#3d3028');rect(-6,-69+bob,6,9,'#4e3b2d');rect(6,-63+bob,4,2,'#25323a');rect(9,-56+bob,3,2,'#744f40');
    // Rear arm and glove; forward arm extends on strikes or rises in guard.
    rect(-16,-48+bob,7,14,'#8e644f');rect(-18,-44+bob,7,8,'#d29b71');rect(-20,-48+bob,11,10,'#162632');rect(-18,-47+bob,8,6,main);rect(-18,-47+bob,7,2,light);
    const extension=f.pose>0?(f.kind==='super'?29:21):0,gy=f.guard?-63:-47;
    if(f.guard){rect(10,-57+bob,6,17,'#e5ac7f');rect(12,-62+bob,10,12,'#142434');rect(13,-61+bob,8,8,main);rect(13,-61+bob,7,2,light);}
    else{rect(10,-49+bob,8+extension,7,'#e0aa7f');rect(14+extension,-53+bob,7,11,'#e0aa7f');rect(15+extension,gy-8+bob,12,12,'#142434');rect(17+extension,gy-7+bob,9,8,main);rect(17+extension,gy-7+bob,8,2,light);}
    if(f.flash>0){g.globalAlpha=f.flash*2;rect(-10,-50,22,22,'#fff1c6');g.globalAlpha=1;}
    if(f.guard){line(-23,-66,24,-66,'#81b7e9',2);line(26,-64,26,-37,'#81b7e9',2);}
    if(f.pose>0&&f.kind==='super'){for(let i=0;i<4;i++)rect(25+i*9,-56+i%2*8,6,2,'#f1d78b');}
    g.restore();
    if(f.id===0){poly([[x-4,y-83],[x+4,y-83],[x,y-78]],'#ff7378');}
  }
  function wall(obstacle){
    const {x,y,hp,age,ttl,flash}=obstacle;
    const rise=motionOptions.reducedMotion?1:Math.min(1,age/.24),height=60*rise;
    const floor=wallCorners(obstacle),top=floor.map(p=>({x:p.x,y:p.y-height}));
    const points=vertices=>vertices.map(p=>[p.x,p.y]);
    poly(points([floor[0],floor[1],{x:floor[2].x+18,y:floor[2].y+6},{x:floor[3].x+18,y:floor[3].y+6}]),'#10203155');
    g.save();if(ttl<1)g.globalAlpha=.65+ttl*.35;
    // West-facing long side: its base is exactly the blocking edge on the floor.
    poly(points([floor[0],floor[3],top[3],top[0]]),'#69778a','#303d50');
    g.save();g.beginPath();g.moveTo(top[0].x,top[0].y);g.lineTo(top[3].x,top[3].y);g.lineTo(floor[3].x,floor[3].y);g.lineTo(floor[0].x,floor[0].y);g.closePath();g.clip();
    // Draw brick courses and painted lettering in the plane of the long face.
    g.transform((floor[3].x-floor[0].x)/76,(floor[3].y-floor[0].y)/76,0,1,top[0].x,top[0].y);
    for(let row=0;row<6;row++)for(let col=-1;col<5;col++){
      const xx=col*20+(row%2?10:0),yy=row*10;
      rect(xx+1,yy+1,18,8,['#788697','#67768a','#8793a1'][(col+row+6)%3]);
      rect(xx+2,yy+1,16,1,'#a3adba');
    }
    if(rise>.7){label('MAGA',38,35,19,'#3e2631');label('MAGA',37,34,19,'#e05955');}
    if(hp<RULES.wallHealth){line(48,0,38,20,'#273245',2);line(38,20,47,38,'#273245',2);}
    if(hp<=12){line(15,20,27,38,'#273245',3);line(27,38,17,60,'#273245',3);}
    g.restore();
    // Near end and cap make the thickness and orientation readable.
    poly(points([floor[3],floor[2],top[2],top[3]]),'#465468','#2b384c');
    for(let row=1;row<6;row++){const yy=floor[3].y-row*10;if(yy>top[3].y)line(floor[3].x,yy,floor[2].x,yy,'#29374a',2);}
    line(floor[3].x+obstacle.width/2,top[3].y,floor[3].x+obstacle.width/2,floor[3].y,'#344155');
    poly(points(top),'#abb4bf','#465569');
    for(let i=1;i<5;i++){const t=i/5;line(top[0].x+(top[3].x-top[0].x)*t,top[0].y+obstacle.depth*t,top[1].x+(top[2].x-top[1].x)*t,top[1].y+obstacle.depth*t,'#778699',2);}
    if(flash>0){g.globalAlpha=flash*2;poly(points([floor[0],floor[3],top[3],top[0]]),'#fff1cc');}
    g.restore();
    const barY=Math.min(...top.map(p=>p.y))-10;
    rect(x-22,barY,44,5,'#172331');rect(x-21,barY+1,42*hp/RULES.wallHealth,3,obstacle.owner===0?'#fa6970':'#70a6ed');
    if(age<.3&&!motionOptions.reducedMotion)for(let i=0;i<7;i++){const t=i/6;rect(floor[0].x+(floor[3].x-floor[0].x)*t-3,floor[0].y+obstacle.depth*t,4,3,'#d6c9ab');}
  }
  function impact(e,foreground=false){
    const age=e.duration-e.ttl,quiet=motionOptions.reducedMotion;
    const fade=Math.min(1,e.ttl/.4),x=e.x,y=e.y;
    g.save();g.globalAlpha=fade;
    if(!foreground){
      // A flattened shockwave and radial cracks anchor the blow to the floor.
      const radius=quiet?76:25+Math.min(1,age/.48)*145;
      const ring=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return [x+Math.cos(a)*radius,y+Math.sin(a)*radius*.32];});
      poly(ring,'#f4cc7822','#e9ce91');
      for(let i=0;i<9;i++){
        const a=i*Math.PI/4.5,len=35+(i%3)*14,dx=Math.cos(a),dy=Math.sin(a)*.38;
        line(x+dx*12,y+dy*12,x+dx*len,y+dy*len,'#394356',3);
        line(x+dx*len,y+dy*len,x+dx*(len+13)-dy*12,y+dy*(len+13)+dx*3,'#394356',2);
      }
    }else{
      // A brief, narrow contact flare follows the body hitting the fence.
      if(!quiet&&age<.14){
        g.globalAlpha=(1-age/.14)*.8;
        poly([[x-9,y-75],[x+7,y-63],[x+12,y-24],[x+5,y+2],[x-8,y-13]],'#fff0cb');
      }
      // Tension ripples spread along the wire mesh and decay after the collision.
      if(!quiet&&age<.42){
        const power=(1-age/.42)*7;
        g.globalAlpha=(1-age/.42)*.6;
        for(let j=0;j<5;j++){
          const yy=y-55+j*12,offset=Math.sin(age*65+j)*power;
          line(x-24,yy-8,x+offset,yy,'#d2dbe0',1);
          line(x+offset,yy,x+25,yy+8,'#d2dbe0',1);
        }
      }
      // Dust rolls back into the arena, followed by chunks of masonry.
      g.globalAlpha=fade*.65;
      for(let i=0;i<11;i++){
        const travel=quiet?20:age*(35+i*9),xx=x-e.direction*(10+travel),yy=y-8+Math.sin(i*2.3)*13;
        const size=12+(i%4)*5+(quiet?0:age*8);
        const lift=quiet?0:Math.sin(Math.min(1,age)*Math.PI)*8;
        poly([[xx-size*.5,yy-lift],[xx-size*.5,yy-size*.28-lift],[xx-size*.25,yy-size*.28-lift],[xx-size*.25,yy-size*.5-lift],[xx+size*.25,yy-size*.5-lift],[xx+size*.25,yy-size*.28-lift],[xx+size*.5,yy-size*.28-lift],[xx+size*.5,yy-lift]],['#c2b9a5','#ead7b0','#8e99a4'][i%3]);
      }
      g.globalAlpha=fade;
      if(!quiet)for(let i=0;i<22;i++){
        const a=i*2.399,speed=35+i%6*20,xx=x+Math.cos(a)*speed*age-e.direction*age*24;
        const yy=y-30+Math.sin(a)*speed*age*.7-90*age+110*age*age;
        if(i%3===0&&age<.3)line(xx,yy,xx-Math.cos(a)*12,yy-Math.sin(a)*8,'#ffe4a6',2);
        g.save();g.translate(xx,yy);g.rotate(age*(i%2?8:-6));rect(-2,-2,3+i%4,3+i%3,['#ffdfa0','#d08a55','#758595'][i%3]);g.restore();
      }

    }
    g.restore();
  }
  function micDrop(drop,foreground=false){
    const falling=drop.age<RULES.dropDelay,t=Math.min(1,drop.age/RULES.dropDelay),x=drop.x,y=drop.y;
    const age=Math.max(0,drop.age-RULES.dropDelay),quiet=motionOptions.reducedMotion;
    const radius=RULES.dropRadius,fade=falling?1:Math.max(0,1-age/RULES.dropAftermath);
    g.save();
    if(!foreground){
      // Keep the warning radius honest; the shockwaves are cosmetic after contact.
      g.beginPath();OCTAGON.forEach(([xx,yy],i)=>i?g.lineTo(xx,yy):g.moveTo(xx,yy));g.closePath();g.clip();
      const ring=(r,color,fill='#00000000')=>poly(Array.from({length:32},(_,i)=>[x+Math.cos(i*Math.PI/16)*r,y+Math.sin(i*Math.PI/16)*r/1.5]),fill,color);
      if(falling){
        g.globalAlpha=.6;ring(radius,'#eac780','#f7bd6815');
        if(!quiet){g.globalAlpha=.25+.4*t;ring(radius*(1-t),'#8ddcff');}
        line(x-12,y,x+12,y,'#e8d3a5',2);line(x,y-7,x,y+7,'#e8d3a5',2);
      }else{
        g.globalAlpha=fade;
        poly([[x-26,y-8],[x-12,y-15],[x+24,y-12],[x+34,y+3],[x+12,y+13],[x-23,y+10]],'#293d5366','#708594');
        for(let i=0;i<12;i++){
          const a=i*Math.PI/6,len=45+i%3*17,dx=Math.cos(a),dy=Math.sin(a)/1.5;
          line(x+dx*17,y+dy*17,x+dx*len,y+dy*len,'#354958',3);
          line(x+dx*len,y+dy*len,x+dx*(len+16)-dy*10,y+dy*(len+16),'#607783',2);
        }
        for(let i=0;i<3;i++){
          const phase=quiet?.6:Math.max(0,age-i*.12)/.48;
          if(phase<=0||phase>1.3)continue;
          g.globalAlpha=fade*Math.max(0,1-phase/1.3);
          ring(radius*Math.min(1.65,phase*1.65),i%2?'#f1d7a0':'#9ee6ff');
          ring(radius*Math.min(1.65,phase*1.65)+5,'#a5c2db55');
        }
      }
    }else{
      if(!falling){
        const kick=quiet?0:Math.max(0,1-age/.2);
        if(kick){g.globalAlpha=kick*.65;poly([[x-17,y-14],[x-30,y-70],[x-9,y-50],[x,y-102],[x+12,y-46],[x+34,y-66],[x+18,y-7]],'#b8eeff');}
        g.globalAlpha=fade*.7;
        for(let i=0;i<16;i++){
          const a=i*2.399,travel=quiet?34:20+age*(55+i%4*28),xx=x+Math.cos(a)*travel,yy=y+Math.sin(a)*travel*.4;
          const size=12+i%4*5+(quiet?0:age*9);
          poly([[xx-size,yy],[xx-size,yy-size*.4],[xx-size*.5,yy-size*.4],[xx-size*.5,yy-size*.7],[xx+size*.4,yy-size*.7],[xx+size*.4,yy-size*.4],[xx+size,yy-size*.4],[xx+size,yy]],i%2?'#a5b9c6':'#d1d1bb');
        }
        if(!quiet)for(let i=0;i<32;i++){
          const a=i*2.399,speed=70+i%5*27,xx=x+Math.cos(a)*speed*age,yy=y+Math.sin(a)*speed*age*.5-135*age+140*age*age;
          g.globalAlpha=fade;g.save();g.translate(xx,yy);g.rotate(age*(i%2?8:-6));rect(-2,-2,4+i%4,3+i%3,i%3?'#90adbe':'#e6d6a9');g.restore();
        }
      }
      g.globalAlpha=fade;
      const plunge=Math.max(0,(t-.3)/.7);
      const lift=quiet?(falling?50:0):falling?215*(1-plunge**3):Math.sin(Math.min(1,age/.36)*Math.PI)*30;
      // The enlarged microphone hangs briefly, then accelerates into the floor.
      if(falling&&!quiet&&t>.5){
        g.save();g.globalAlpha=(t-.5)*.7;
        for(let i=0;i<6;i++)rect(x-12+i*5,y-lift-44-i%2*15,2,28+i*6,i%2?'#f1c6aa':'#8bd9ff');
        g.restore();
      }
      g.translate(x,y-14-lift);g.rotate(quiet?.2:falling?-.35+t*.5:Math.sin(Math.min(1,age/.36)*Math.PI)*.8+Math.min(1,age/.45)*1.25);
      g.scale(2.15,2.15);
      rect(-3,-2,6,22,'#142339');rect(-1,-1,2,18,'#8ba4b9');rect(-2,15,4,3,'#b4d9e6');
      poly([[-7,-12],[7,-12],[9,-8],[9,-2],[5,2],[-5,2],[-9,-2],[-9,-8]],'#d3e5ec','#425970');
      for(let i=0;i<3;i++)line(-6,-9+i*3,6,-9+i*3,'#526e86');
      line(-4,-11,-4,-3,'#f1fbff',2);
    }
    g.restore();
  }
  const render=function(w,time,options={}){
    motionOptions={enhanced:true,reducedMotion:false,...options};
    g=ctx;g.clearRect(0,0,960,540);
    const impacts=w.effects.filter(e=>e.impact);
    const micImpact=w.drops.find(d=>d.hit&&d.age-RULES.dropDelay<.38);
    g.save();
    if(!motionOptions.reducedMotion&&w.phase==='playing'&&(impacts.length||micImpact)){
      const hit=impacts[impacts.length-1],age=micImpact?micImpact.age-RULES.dropDelay:hit.duration-hit.ttl,force=Math.max(0,1-age/.38)*(micImpact?10:7);
      g.translate(Math.round(Math.sin(age*97)*force),Math.round(Math.cos(age*79)*force*.55));
      if(micImpact){const zoom=1+Math.max(0,1-age/.22)*.018;g.translate(480,270);g.scale(zoom,zoom);g.translate(-480,-270);}
    }
    g.drawImage(background,0,0);
    flag(193,139,53,33,time);flag(763,139,53,33,time);flag(478,99,25,16,time);
    // Sparse foreground crowd animation is deliberately quieter than gameplay.
    for(const p of people)person(p.x,p.y,p.s,p.v,true,time);
    for(const hit of impacts)impact(hit);
    for(const drop of w.drops)micDrop(drop);
    const actors=[...w.fighters.map(f=>({y:f.y,draw:()=>fighter(f,w.time)})),...w.walls.map(item=>({y:item.y+item.depth/2,draw:()=>wall(item)}))];
    for(const actor of actors.sort((a,b)=>a.y-b.y))actor.draw();
    for(const drop of w.drops)micDrop(drop,true);
    for(const shot of w.projectiles){
      g.save();g.translate(shot.x,shot.y-38);g.rotate(Math.atan2(shot.dy,shot.dx));
      if(art.obama_attack)g.drawImage(art.obama_attack,-31,-15,48,30);
      else {line(-20,0,6,0,'#66ccff',8);rect(3,-7,12,14,'#d9f5ff');}
      g.restore();
    }
    for(const e of w.effects){
      if(e.impact)continue;
      if(e.fired){
        const xx=Math.max(70,Math.min(890,e.x)),yy=e.y;
        g.save();g.globalAlpha=Math.min(1,e.ttl/.15);
        label('YOU’RE FIRED!',xx+1,yy+1,11,'#17202d');label('YOU’RE FIRED!',xx,yy,11,'#eee2c8');
        g.restore();continue;
      }
      const age=.6-e.ttl;
      if(e.rubble){
        g.save();g.globalAlpha=e.ttl/.6;
        for(let i=0;i<12;i++){const angle=i*2.4,spread=12+age*45;rect(e.x+Math.cos(angle)*spread,e.y+Math.sin(angle)*spread*.35-Math.sin(age/.6*Math.PI)*12,5+i%3*2,4,['#a1a7af','#687586','#c3b8a2'][i%3]);}
        g.restore();continue;
      }
      if(e.ttl>.36){const c=e.blocked?'#91c5ef':e.superMove?'#ffdf8c':'#fff3bf';for(let i=0;i<6;i++){const a=i*Math.PI/3;rect(e.x+Math.cos(a)*(9+age*30),e.y+Math.sin(a)*(9+age*30),3,3,c);}}

    }
    for(const i of [3,4,5])fenceEdge(OCTAGON[i],OCTAGON[(i+1)%8],19,true);
    for(const i of [4,5]){const [x,y]=OCTAGON[i];post(x,y,20,'#253445');}
    for(const hit of impacts)impact(hit,true);
    g.restore();
    if(w.phase==='paused'){rect(0,0,960,540,'#07102277');label('PAUSE',480,332,24,'#f4e7cd');}
  };
  render.assetsReady=assetsReady;
  return render;
}
