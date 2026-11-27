// Explicit structural height patches. Later patches override earlier patches.
import {clip,rectangle,contains,boundaries,hull,snap} from './geometry.js';
export function makeSectors(plan,rng){
 plan.sectors=[];plan.hazards=[];
 const add=(r,kind,polygons,floor,ceiling,safe=true,hazard=null)=>{const id=plan.sectors.length,points=polygons.flat(2);const s={id,room:r.id,kind,polygons,floor:snap(floor),ceiling:snap(ceiling),safe,hazard,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};plan.sectors.push(s);r.sectors.push(id);return s;};
 for(const r of plan.rooms){r.sectors=[];r.ceilingZ=snap(r.floorZ+plan.ceiling+[0,.5,1][Math.floor(rng()*3)]);add(r,'room',[[r.outline,...r.obstacles.map(o=>o.outline)]],r.floorZ,r.ceilingZ);
  if(!plan.features||r.id===0)continue;
  if(r.kind==='donut'){
   const core=r.obstacles[0],type=r.id===1?'lava':'radiation',outer=core.outline.map(([x,y])=>{const factor=1+6/Math.hypot(x-r.cx,y-r.cy);return[snap(r.cx+(x-r.cx)*factor),snap(r.cy+(y-r.cy)*factor)];}),polygons=[[outer,core.outline]],s=add(r,'liquid-pit',polygons,r.floorZ-4,r.ceilingZ,false,type);
   plan.hazards.push({id:plan.hazards.length,sector:s.id,type,polygons,floor:s.floor,top:r.ceilingZ,wall:core.outline,fatal:true,radius:type==='radiation'?2:0});
   // The required ring anchors lie on the safe outer ring.
   const radius=Math.max(...outer.map(p=>Math.abs(p[1]-r.cy)))+2;r.anchor=[r.cx,snap((r.cy-radius+r.y0)/2)];
  }else{
   const kind=['platform','escape-pit','unreachable-platform','fatal-pit'][r.id%4],sign=r.id%2?1:-1,cx=r.cx+sign*((r.x1-r.x0)/2-8),cy=r.cy+((r.y1-r.y0)/2-8),polygons=[[rectangle({x0:snap(cx-3),x1:snap(cx+3),y0:snap(cy-3),y1:snap(cy+3)})]],delta=kind==='platform'?.15625:kind==='escape-pit'?-.15625:kind==='unreachable-platform'?2:-4,type=kind==='fatal-pit'?(r.id%2?'lava':'radiation'):null,s=add(r,kind,polygons,r.floorZ+delta,r.ceilingZ,kind==='platform'||kind==='escape-pit',type);
   if(type)plan.hazards.push({id:plan.hazards.length,sector:s.id,type,polygons,floor:s.floor,top:s.floor,fatal:true,radius:type==='radiation'?2:0});
  }
 }
 plan.summary.sectors=plan.sectors.length;plan.summary.hazards=plan.hazards.length;
}
export function sectorAt(plan,x,y){return plan.sectors?.findLast(s=>x>=s.bounds[0]&&x<=s.bounds[2]&&y>=s.bounds[1]&&y<=s.bounds[3]&&contains(s.polygons,[x,y]));}
export function sectorSupport(plan,x,y,r,base){
 let remaining=[[rectangle({x0:x-r,x1:x+r,y0:y-r,y1:y+r})]],high=-Infinity;
 for(const s of [...(plan.sectors||[])].reverse()){if(x+r<s.bounds[0]||x-r>s.bounds[2]||y+r<s.bounds[1]||y-r>s.bounds[3])continue;const part=clip.intersection(remaining,s.polygons);if(part.length){high=Math.max(high,s.floor);remaining=clip.difference(remaining,s.polygons);if(!remaining.length)break;}}
 if(remaining.length)high=Math.max(high,base);
 return high;
}
export function expand(polygons,r){if(!r)return polygons;return clip.union(polygons,...boundaries(polygons).map(e=>[hull(e.flatMap(([x,y])=>[[-r,-r],[r,-r],[r,r],[-r,r]].map(([dx,dy])=>[x+dx,y+dy])))]));}
export function safePolygons(plan,polygons){const excluded=plan.sectors.filter(s=>!s.safe).map(s=>expand(s.polygons,plan.hazards.find(h=>h.sector===s.id)?.radius||0));return excluded.length?clip.difference(polygons,...excluded):polygons;}
export function partitionSectors(plan,polygons){let remaining=polygons;const parts=[];for(const s of [...plan.sectors].reverse()){const p=clip.intersection(remaining,s.polygons);if(p.length)parts.push({sector:s,polygons:p});remaining=clip.difference(remaining,s.polygons);}if(remaining.length)parts.push({sector:null,polygons:remaining});return parts;}
