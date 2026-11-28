// M3: polygon outlines, shared closed shell and full-domain clearance mesh.
import {Q,clip,cross,same,pointKey,area,cleanRing,contains,boundaries,triangulate,conform,erode,boxCovered} from './geometry.js';
import {refineOutline,terrainFaces} from './terrain-mesh.js';
import {safePolygons} from './sectors.js';
import {supportHeight,validateElevation} from './elevation.js';
export {makePlan,random,GENERATOR_VERSION} from './plan.js';
export {boxCovered} from './geometry.js';
const centre=p=>[0,1].map(k=>p.reduce((s,v)=>s+v[k],0)/p.length);
const edgeKey=(a,b)=>[pointKey(a),pointKey(b)].sort().join(':');
export function compileStructure(plan){
 for(const r of plan.rooms)r.domain=refineOutline(plan,r.domain);for(const s of plan.sectors)s.polygons=refineOutline(plan,s.polygons);for(const h of plan.hallways)h.polygons=refineOutline(plan,h.polygons);
 const additions=[...plan.rooms.flatMap(r=>r.domain),...plan.hallways.flatMap(h=>h.polygons)],obstacles=[...plan.rooms.flatMap(r=>r.obstacles.map(o=>[o.outline])),...(plan.dividers||[]).flatMap(d=>d.polygons)];
 let polygons=clip.union(...additions);if(obstacles.length)polygons=clip.difference(polygons,...obstacles);
 // Collision ABI is 1/1024 m. Derive navigation from the exact snapped outline.
 polygons=polygons.map(p=>p.map(r=>cleanRing(r,true)).filter(r=>r.length>=3));
 polygons=clip.union(polygons).map(p=>p.map(r=>cleanRing(r,true)));
 if(polygons.length!==1)throw new Error('Structural floor domain is disconnected.');
 polygons=refineOutline(plan,polygons);
 const terrain=terrainFaces(plan,polygons),points=[],triangles=[],kinds=[],materials=[],vertices=new Map();
 const vertex=p=>{const q=p.map(v=>Math.round(v*Q)),key=q.join(',');if(!vertices.has(key)){vertices.set(key,points.length/3);points.push(...q);}return vertices.get(key);};
 for(const {p,kind,material}of terrain.faces){triangles.push(...p.map(vertex));kinds.push(kind);materials.push(material||0);}
 const boundary=boundaries(polygons);
 if(points.length/3>16384||triangles.length/3>32768)throw new Error('Structural mesh exceeds the engine capacity.');
 const xs=[...new Set(polygons.flat(2).map(p=>p[0]))].sort((a,b)=>a-b),ys=[...new Set(polygons.flat(2).map(p=>p[1]))].sort((a,b)=>a-b);
 return{points:new Int32Array(points),triangles:new Uint32Array(triangles),kinds,materials,sectorCells:terrain.cells,volume:terrain.volume,polygons,boundary,xs,ys,extent:Math.max(xs.at(-1)-xs[0],ys.at(-1)-ys[0]),floorArea:area(polygons),terrainTiles:terrain.tileCount,floorMin:Math.min(...points.filter((_,i)=>i%3===2))/Q,ceilingMax:Math.max(...points.filter((_,i)=>i%3===2))/Q};
}
export function validateStructure(plan,s){
 const edges=new Map();let volume6=0;
 for(let i=0;i<s.triangles.length;i+=3){const ids=Array.from(s.triangles.slice(i,i+3)),p=ids.map(id=>Array.from(s.points.slice(id*3,id*3+3),v=>v/Q));const[a,b,c]=p,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...n)<1e-8)throw new Error('Degenerate triangle.');volume6+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?a+':'+b:b+':'+a,old=edges.get(key)||[0,0];old[0]++;old[1]+=a<b?1:-1;edges.set(key,old);}}
 let unmatched=0,nonmanifold=0,winding=0;for(const [count,balance]of edges.values()){if(count===1)unmatched++;if(count>2)nonmanifold++;if(balance!==0)winding++;}
 const volume=-volume6/6,expected=s.volume;
 if(unmatched||nonmanifold||winding||volume6>=0||Math.abs(volume-expected)>Math.max(.001,expected*1e-8))throw new Error('Enclosure validation failed: '+JSON.stringify({unmatched,nonmanifold,winding,volume,expected}));
 if(plan.rooms.some(r=>!r.hallways.length)||plan.hallways.some(h=>new Set(h.rooms).size<2||h.rooms.some(id=>!plan.rooms[id])||h.width<4||h.width>12||h.sectionWidths.some(w=>w<4||w>12)))throw new Error('Room/hallway incidence or width invalid.');
 for(const r of plan.rooms)for(const o of r.obstacles)if(contains(s.polygons,centre(o.outline)))throw new Error('Structural obstacle was not subtracted.');
 return{unmatched,nonmanifold,winding,enclosedVolume:volume,floorArea:s.floorArea,vertices:s.points.length/3,triangles:s.triangles.length/3,structuralRoles:['floor','ceiling','wall','riser','ceiling-riser'],decorativeTriangles:0,features:plan.summary,proof:'Orthogonal rooms and shared hallway network; structural shared-wall/corner separators; flat sectors and real steps; welded oriented shell.'};
}
// Greedily merge adjacent nav triangles only when their complete union is convex.
function convexRegions(triangles){
 let cells=triangles.map(p=>p.slice()),changed=true;
 while(changed){changed=false;const edges=new Map();outer:for(let a=0;a<cells.length;a++){if(!cells[a])continue;const p=cells[a];for(let i=0;i<p.length;i++){const k=edgeKey(p[i],p[(i+1)%p.length]);if(!edges.has(k)){edges.set(k,a);continue;}const b=edges.get(k);if(!cells[b]||a===b)continue;const boundary=new Map();for(const r of [p,cells[b]])for(let j=0;j<r.length;j++){const u=r[j],v=r[(j+1)%r.length],key=edgeKey(u,v);if(boundary.has(key))boundary.delete(key);else boundary.set(key,[u,v]);}const chain=[...boundary.values()],next=new Map(chain.map(e=>[pointKey(e[0]),e[1]])),merged=[chain[0][0]];while(merged.length<chain.length){const q=next.get(pointKey(merged.at(-1)));if(!q||merged.some(p=>same(p,q)))break;merged.push(q);}if(merged.length!==chain.length||!same(next.get(pointKey(merged.at(-1)))||[],merged[0]))continue;if(merged.some((v,j)=>cross(v,merged[(j+1)%merged.length],merged[(j+2)%merged.length])< -1e-8))continue;cells[b]=merged;cells[a]=null;changed=true;continue outer;}}}
 return cells.filter(Boolean);
}
function portal(p,q){
 for(let i=0;i<p.length;i++)for(let j=0;j<q.length;j++){const a=p[i],b=p[(i+1)%p.length],c=q[j],d=q[(j+1)%q.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(Math.abs(cross(a,b,c))>len*1e-7||Math.abs(cross(a,b,d))>len*1e-7)continue;const t=v=>((v[0]-a[0])*dx+(v[1]-a[1])*dy)/(len*len),lo=Math.max(0,Math.min(t(c),t(d))),hi=Math.min(1,Math.max(t(c),t(d)));if((hi-lo)*len>1e-6)return[a[0]+dx*(lo+hi)/2,a[1]+dy*(lo+hi)/2];}
 return null;
}
function lookup(points,edges){
 const count=points.length,next=new Uint16Array(count*count).fill(65535),cost=new Float32Array(count*count);
 for(let target=0;target<count;target++){
  const distance=new Float64Array(count).fill(Infinity),heap=[];distance[target]=0;next[target*count+target]=target;
  const push=(node,d)=>{let i=heap.length;heap.push([node,d]);while(i){const p=(i-1)>>1;if(heap[p][1]<=d)break;heap[i]=heap[p];i=p;}heap[i]=[node,d];};
  const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1][1]<heap[j][1])j++;if(heap[j][1]>=last[1])break;heap[i]=heap[j];i=j;}heap[i]=last;}return top;};
  push(target,0);while(heap.length){const[here,best]=pop();if(best!==distance[here])continue;for(const[from,d]of edges[here])if(best+d<distance[from]-1e-9){distance[from]=best+d;next[from*count+target]=here;push(from,best+d);}}
  for(let i=0;i<count;i++){if(!Number.isFinite(distance[i]))throw new Error('Unreachable waypoint.');cost[i*count+target]=distance[i];}
 }
 return{next,cost};
}
export function buildNavigation(plan,s,profile){
 const radius=Math.ceil((profile.radius+.012)*Q)/Q,height=profile.height;
 if(height>=plan.ceiling)throw new Error('Insufficient headroom.');
 const elevation=validateElevation(plan,{radius,height});
 const safe=safePolygons(plan,s.polygons),domain=erode(safe,radius);if(domain.length!==1)throw new Error('Clearance domain is disconnected.');
 const polygons=convexRegions(triangulate(domain)),regions=polygons.map(p=>({polygon:p,x0:Math.min(...p.map(v=>v[0])),x1:Math.max(...p.map(v=>v[0])),y0:Math.min(...p.map(v=>v[1])),y1:Math.max(...p.map(v=>v[1]))}));
 const liftPoint=p=>[...p,supportHeight(plan,...p,profile.radius+.006)+.035],points=polygons.map(p=>liftPoint(centre(p))),edges=points.map(()=>[]),owners=points.map((_,i)=>i),targets=[];
 const connect=(a,b)=>{const d=Math.hypot(...points[a].map((v,k)=>v-points[b][k]));edges[a].push([b,d]);edges[b].push([a,d]);};
 const add=(p,region)=>{const id=points.length;points.push(liftPoint(p));edges.push([]);owners.push(region);connect(id,region);return id;};
 for(let a=0;a<polygons.length;a++)for(let b=a+1;b<polygons.length;b++){const at=portal(polygons[a],polygons[b]);if(at){const n=add(at,a);connect(n,b);}}
 const attach=(p,label,kind,id)=>{const region=polygons.findIndex(r=>r.every((a,i)=>cross(a,r[(i+1)%r.length],p)>=-1e-7));if(region<0||!boxCovered(s,...p,radius))throw new Error('Region target lacks clearance: '+label);const node=add(p,region);targets.push({label,kind,id,node,point:points[node]});};
 for(const r of plan.rooms)attach(r.anchor,r.name,'room',r.id);
 for(const f of plan.roomFeatures)if(f.structure==='mask'||f.structure==='relief')attach([(f.box.x0+f.box.x1)/2,(f.box.y0+f.box.y1)/2],'Feature '+(f.id+1),'feature',f.id);
 for(const a of plan.alcoves)attach(a.anchor,'Room '+(a.room+1)+' · alcove '+(a.id+1),'alcove',a.id);
 for(const h of plan.hallways)attach(h.anchor,h.name,'hallway',h.id);
 if(points.length>2048)throw new Error('Waypoint budget exceeded.');
 const visited=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const[n]of edges[queue[i]])if(!visited.has(n)){visited.add(n);queue.push(n);}if(visited.size!==points.length)throw new Error('Clearance domain is disconnected.');
 return{radius:profile.radius,clearanceRadius:radius,supportRadius:profile.radius+.006,height,elevation,supportCuts:{x:[...plan.elevation.x.segments.flatMap(s=>[s.lo,s.hi]),...plan.sectors.flatMap(s=>[s.bounds[0],s.bounds[2]])],y:[...plan.elevation.y.segments.flatMap(s=>[s.lo,s.hi]),...plan.sectors.flatMap(s=>[s.bounds[1],s.bounds[3]])]},regions,domain,points,edges,owners,targets,count:points.length,...lookup(points,edges),componentCount:1,safePolygons:safe,excludedSectors:plan.sectors.filter(s=>!s.safe).map(s=>s.id),coverage:'Entire declared safe polygonal XY domain on validated stepped/sloped support surfaces, eroded by the declared AABB composite profile plus a 12 mm safety margin; cores and posts excluded.'};
}
export function route(nav,from,to){if(from<0||to<0||from>=nav.count||to>=nav.count)return null;const path=[from];while(from!==to){from=nav.next[from*nav.count+to];if(from===65535||path.length>nav.count)return null;path.push(from);}return path;}
export function validateRoutes(nav){
 const adjacency=nav.edges.map(e=>new Map(e));
 for(let target=0;target<nav.count;target++){const done=new Uint8Array(nav.count);done[target]=2;if(nav.next[target*nav.count+target]!==target||nav.cost[target*nav.count+target]!==0)throw new Error('Invalid lookup diagonal.');for(let from=0;from<nav.count;from++){const stack=[];let at=from;while(!done[at]){done[at]=1;stack.push(at);const n=nav.next[at*nav.count+target],d=adjacency[at].get(n);if(n>=nav.count||d===undefined||!Number.isFinite(nav.cost[at*nav.count+target])||Math.abs(nav.cost[at*nav.count+target]-d-nav.cost[n*nav.count+target])>.002)throw new Error('Invalid lookup route.');at=n;}if(done[at]===1)throw new Error('Cyclic lookup route.');for(const n of stack)done[n]=2;}}
 return{paths:nav.count**2,waypoints:nav.count,components:1,regions:nav.regions.length};
}
