import {addFeatures} from './features.js';
// Explicit structural height patches. Later patches override earlier patches.
import {clip,rectangle,contains,boundaries,hull,snap} from './geometry.js';
export function makeSectors(plan,rng){
 plan.sectors=[];plan.hazards=[];plan.roomFeatures=[];
 const add=(r,kind,polygons,floor,ceiling,safe=true,hazard=null)=>{const id=plan.sectors.length,points=polygons.flat(2);const s={id,room:r.id,kind,polygons,floor:snap(floor),ceiling:snap(ceiling),safe,hazard,flatDetail:{feature:null,trap:false,waterfall:false,column:false,relief:false},bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};plan.sectors.push(s);r.sectors.push(id);return s;};
 for(const r of plan.rooms){r.sectors=[];r.ceilingZ=r.style.ceiling;add(r,'room',r.domain,r.floorZ,r.ceilingZ);
  for(const id of r.alcoves){const a=plan.alcoves[id];add(r,'alcove',a.polygons,r.floorZ+a.floorOffset,r.floorZ+a.floorOffset+a.clearHeight);}
  addFeatures(plan,r,rng,add);
 }
 plan.summary.sectors=plan.sectors.length;plan.summary.hazards=plan.hazards.length;plan.summary.roomFeatures=plan.roomFeatures.length;plan.summary.stairRisers=plan.roomFeatures.reduce((n,f)=>n+(f.levels||0),0);
}
export function sectorAt(plan,x,y){return plan.sectors?.findLast(s=>x>=s.bounds[0]&&x<=s.bounds[2]&&y>=s.bounds[1]&&y<=s.bounds[3]&&contains(s.polygons,[x,y]));}
export function sectorSupport(plan,x,y,r,base){
 let remaining=[[rectangle({x0:x-r,x1:x+r,y0:y-r,y1:y+r})]],high=-Infinity;
 for(const s of [...(plan.sectors||[])].reverse()){if(x+r<s.bounds[0]||x-r>s.bounds[2]||y+r<s.bounds[1]||y-r>s.bounds[3])continue;const part=clip.intersection(remaining,s.polygons);if(part.length){high=Math.max(high,s.floor);remaining=clip.difference(remaining,s.polygons);if(!remaining.length)break;}}
 if(remaining.length)high=Math.max(high,base);
 return high;
}
export function expand(polygons,r){if(!r)return polygons;return clip.union(polygons,...boundaries(polygons).map(e=>[hull(e.flatMap(([x,y])=>[[-r,-r],[r,-r],[r,r],[-r,r]].map(([dx,dy])=>[x+dx,y+dy])))]));}
export function safePolygons(plan,polygons){const excluded=plan.sectors.filter(s=>!s.safe).map(s=>expand(s.polygons,(()=>{const h=plan.hazards.find(h=>h.sector===s.id);return h?Math.max(h.radius||0,h.wall?.length?.05:0):0;})()));return excluded.length?clip.difference(polygons,...excluded):polygons;}
export function partitionSectors(plan,polygons){let remaining=polygons;const parts=[];for(const s of [...plan.sectors].reverse()){const p=clip.intersection(remaining,s.polygons);if(p.length)parts.push({sector:s,polygons:p});remaining=clip.difference(remaining,s.polygons);}if(remaining.length)parts.push({sector:null,polygons:remaining});return parts;}
