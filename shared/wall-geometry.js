// Floor geometry shared by collision detection and the canvas renderer.
export function wallCorners(wall) {
  const ux=wall.ux ?? 1, uy=wall.uy ?? 0;
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{
    const x=sx*wall.width/2+sy*wall.depth/2*wall.slant, y=sy*wall.depth/2;
    return {x:wall.x+ux*x-uy*y,y:wall.y+uy*x+ux*y};
  });
}
export function wallContact(body,wall,radius) {
  const corners=wallCorners(wall);let inside=true,nearest=null;
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(dx*(body.y-a.y)-dy*(body.x-a.x)<0)inside=false;
    const t=Math.max(0,Math.min(1,((body.x-a.x)*dx+(body.y-a.y)*dy)/(len*len)));
    const x=a.x+t*dx,y=a.y+t*dy,distance=Math.hypot(body.x-x,body.y-y);
    if(!nearest||distance<nearest.distance)nearest={x,y,distance,nx:dy/len,ny:-dx/len};
  }
  if(!inside&&nearest.distance>=radius)return null;
  const nx=inside||nearest.distance<1e-9?nearest.nx:(body.x-nearest.x)/nearest.distance;
  const ny=inside||nearest.distance<1e-9?nearest.ny:(body.y-nearest.y)/nearest.distance;
  const push=inside?radius+nearest.distance:radius-nearest.distance;
  return {x:body.x+nx*push,y:body.y+ny*push};
}
export function wallSegmentEntry(wall,origin,dx,dy) {
  const corners=wallCorners(wall);let entry=0,exit=1;
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4],ex=b.x-a.x,ey=b.y-a.y;
    const side=ex*(origin.y-a.y)-ey*(origin.x-a.x),slope=ex*dy-ey*dx;
    if(Math.abs(slope)<1e-9){if(side<0)return null;}
    else if(slope>0)entry=Math.max(entry,-side/slope);
    else exit=Math.min(exit,-side/slope);
  }
  return entry<=exit?entry:null;
}
export function wallsOverlap(a,b,gap=4) {
  const ac=wallCorners(a),bc=wallCorners(b);
  for(const corners of [ac,bc])for(let i=0;i<4;i++){
    const p=corners[i],q=corners[(i+1)%4],len=Math.hypot(q.x-p.x,q.y-p.y),nx=(q.y-p.y)/len,ny=(p.x-q.x)/len;
    const ap=ac.map(v=>v.x*nx+v.y*ny),bp=bc.map(v=>v.x*nx+v.y*ny);
    if(Math.max(...ap)+gap<=Math.min(...bp)||Math.max(...bp)+gap<=Math.min(...ap))return false;
  }
  return true;
}
