// M1: deterministic room graph -> exact rectilinear blockout -> clearance regions.
export const GENERATOR_VERSION='m1.1';
const Q=1024,snap=x=>Math.round(x*Q)/Q;
export function random(seed){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const inside=(r,x,y)=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1;
const center=r=>[(r.x0+r.x1)/2,(r.y0+r.y1)/2];
const sorted=a=>[...new Set(a)].sort((a,b)=>a-b);
const key=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(':');
export function makePlan(seed,count=9,{widthOverride=null}={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Seed must be an unsigned 32-bit integer.');
 if(![6,9,12].includes(count))throw new Error('Choose 6, 9 or 12 rooms.');
 if(widthOverride!==null&&(!Number.isFinite(widthOverride)||widthOverride<4||widthOverride>12))throw new Error('Corridor width must be within 4–12 m.');
 const rng=random(seed),cols=count===12?4:3,rows=count/cols,spacing=52,rooms=[],snake=[];
 for(let y=0;y<rows;y++)for(let c=0;c<cols;c++){const x=y%2?cols-1-c:c;snake.push(y*cols+x);}
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const w=snap(28+rng()*8),h=snap(28+rng()*8),cx=(x-(cols-1)/2)*spacing,cy=(y-(rows-1)/2)*spacing;rooms.push({id:y*cols+x,name:'Room '+(y*cols+x+1),x0:snap(cx-w/2),x1:snap(cx+w/2),y0:snap(cy-h/2),y1:snap(cy+h/2),cx,cy,grid:[x,y],hallways:[]});}
 const links=[],linked=new Set(),mainCount=Math.ceil(count*.6),main=snake.slice(0,mainCount),attached=new Set(main);
 const link=(a,b,type)=>{const k=key(a,b);if(linked.has(k))return;linked.add(k);links.push({a,b,type});};
 for(let i=1;i<main.length;i++)link(main[i-1],main[i],'main');
 const adjacent=(a,b)=>Math.abs(rooms[a].grid[0]-rooms[b].grid[0])+Math.abs(rooms[a].grid[1]-rooms[b].grid[1])===1;
 const remaining=new Set(snake.slice(mainCount));while(remaining.size){const candidates=[];for(const id of remaining)for(const other of attached)if(adjacent(id,other))candidates.push([id,other]);if(!candidates.length)throw new Error('Cannot attach branch.');const [id,other]=candidates[Math.floor(rng()*candidates.length)];link(id,other,'branch');attached.add(id);remaining.delete(id);}
 const loops=[];for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)if(adjacent(a,b)&&!linked.has(key(a,b)))loops.push([a,b]);
 for(let n=0;n<Math.min(count===6?1:2,loops.length);n++){const at=Math.floor(rng()*loops.length),[a,b]=loops.splice(at,1)[0];link(a,b,'loop');}
 const hallways=links.map((e,id)=>{
  const width=widthOverride??snap(4+rng()*8),r=width/2;let a=rooms[e.a],b=rooms[e.b],points;
  if(a.grid[1]===b.grid[1]){if(a.cx>b.cx)[a,b]=[b,a];const offset=Math.min(width*.62+.6,(a.y1-a.y0)/2-r-.5,(b.y1-b.y0)/2-r-.5)*(rng()<.5?-1:1),mid=snap((a.x1+b.x0)/2);points=[[a.x1,snap(a.cy+offset)],[mid,snap(a.cy+offset)],[mid,snap(b.cy-offset)],[b.x0,snap(b.cy-offset)]];}
  else{if(a.cy>b.cy)[a,b]=[b,a];const offset=Math.min(width*.62+.6,(a.x1-a.x0)/2-r-.5,(b.x1-b.x0)/2-r-.5)*(rng()<.5?-1:1),mid=snap((a.y1+b.y0)/2);points=[[snap(a.cx+offset),a.y1],[snap(a.cx+offset),mid],[snap(b.cx-offset),mid],[snap(b.cx-offset),b.y0]];}
  const rects=[];for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i];if(p[1]===q[1]){const y0=snap(p[1]-r);rects.push({x0:snap(Math.min(p[0],q[0])-r),x1:snap(Math.max(p[0],q[0])+r),y0,y1:snap(y0+width)});}else{const x0=snap(p[0]-r);rects.push({x0,x1:snap(x0+width),y0:snap(Math.min(p[1],q[1])-r),y1:snap(Math.max(p[1],q[1])+r)});}}
  rooms[e.a].hallways.push(id);rooms[e.b].hallways.push(id);return{id,name:'Hallway '+(id+1),a:e.a,b:e.b,type:e.type,width,points,rects};
 });
 return{seed,count,cols,rows,rooms,hallways,main,ceiling:5.5,version:GENERATOR_VERSION};
}
export function compileStructure(plan){
 const rects=[...plan.rooms,...plan.hallways.flatMap(h=>h.rects)],xs=sorted(rects.flatMap(r=>[r.x0,r.x1])),ys=sorted(rects.flatMap(r=>[r.y0,r.y1])),nx=xs.length-1,ny=ys.length-1,open=new Uint8Array(nx*ny),prefix=new Uint32Array((nx+1)*(ny+1));
 const occupied=(x,y)=>x>=0&&y>=0&&x<nx&&y<ny&&open[y*nx+x]===1;
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)open[y*nx+x]=+rects.some(r=>inside(r,(xs[x]+xs[x+1])/2,(ys[y]+ys[y+1])/2));
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const k=(y+1)*(nx+1)+x+1;prefix[k]=+!occupied(x,y)+prefix[k-1]+prefix[k-(nx+1)]-prefix[k-(nx+2)];}
 const points=[],triangles=[],kinds=[],vertices=new Map(),quads=[];
 const vertex=(x,y,z)=>{const v=[x,y,z].map(v=>Math.round(v*Q)),k=v.join(',');if(!vertices.has(k)){vertices.set(k,points.length/3);points.push(...v);}return vertices.get(k);};
 const face=(p,kind)=>{const ids=p.map(v=>vertex(...v));triangles.push(ids[0],ids[1],ids[2],ids[0],ids[2],ids[3]);kinds.push(kind,kind);quads.push({p,kind});};
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){if(!occupied(x,y))continue;const x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1],h=plan.ceiling;
  face([[x0,y0,0],[x1,y0,0],[x1,y1,0],[x0,y1,0]],'floor');face([[x0,y1,h],[x1,y1,h],[x1,y0,h],[x0,y0,h]],'ceiling');
  for(const [dx,dy,a,b]of [[0,-1,[x0,y0],[x1,y0]],[1,0,[x1,y0],[x1,y1]],[0,1,[x1,y1],[x0,y1]],[-1,0,[x0,y1],[x0,y0]]])if(!occupied(x+dx,y+dy))face([[...a,0],[...a,h],[...b,h],[...b,0]],'wall');
 }
 if(points.length/3>16384||triangles.length/3>32768)throw new Error('Structural mesh exceeds the engine capacity.');
 return{points:new Int32Array(points),triangles:new Uint32Array(triangles),kinds,quads,xs,ys,nx,ny,open,prefix,rects,extent:Math.max(xs.at(-1)-xs[0],ys.at(-1)-ys[0])};
}
function interval(cuts,value){let a=0,b=cuts.length-1;while(a<b){const m=(a+b+1)>>1;if(cuts[m]<=value)a=m;else b=m-1;}return Math.min(cuts.length-2,a);}
export function boxCovered(structure,x,y,r){
 const{xs,ys,nx,ny,prefix}=structure,eps=1e-7;
 if(x-r<xs[0]-eps||x+r>xs.at(-1)+eps||y-r<ys[0]-eps||y+r>ys.at(-1)+eps)return false;
 const x0=interval(xs,x-r+eps),x1=interval(xs,x+r-eps)+1,y0=interval(ys,y-r+eps),y1=interval(ys,y+r-eps)+1,stride=nx+1;
 return prefix[y1*stride+x1]-prefix[y0*stride+x1]-prefix[y1*stride+x0]+prefix[y0*stride+x0]===0;
}
export function validateStructure(plan,s){
 const edges=new Map();let volume6=0;
 for(let i=0;i<s.triangles.length;i+=3){const ids=Array.from(s.triangles.slice(i,i+3)),p=ids.map(id=>Array.from(s.points.slice(id*3,id*3+3),v=>v/Q));const[a,b,c]=p,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...n)<1e-8)throw new Error('Degenerate triangle.');volume6+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?a+':'+b:b+':'+a,old=edges.get(key)||[0,0];old[0]++;old[1]+=a<b?1:-1;edges.set(key,old);}}
 let unmatched=0,nonmanifold=0,winding=0;for(const [count,balance]of edges.values()){if(count===1)unmatched++;if(count>2)nonmanifold++;if(balance!==0)winding++;}
 if(unmatched||nonmanifold||winding||volume6>=0)throw new Error('Enclosure validation failed: '+JSON.stringify({unmatched,nonmanifold,winding,volume6}));
 if(plan.rooms.some(r=>!r.hallways.length)||plan.hallways.some(h=>h.a===h.b||!plan.rooms[h.a]||!plan.rooms[h.b]||h.width<4||h.width>12))throw new Error('Room/hallway incidence or width invalid.');
 // Cell ownership proves non-overlap; a face is emitted only on the union boundary.
 return{unmatched,nonmanifold,winding,enclosedVolume:-volume6/6,vertices:s.points.length/3,triangles:s.triangles.length/3,structuralRoles:['floor','ceiling','wall'],decorativeTriangles:0,proof:'Canonical rectilinear union cells, welded oriented shell; no arbitrary-mesh CSG claim.'};
}
export function buildNavigation(plan,s,profile){
 const radius=Math.ceil((profile.radius+.012)*Q)/Q,height=profile.height,xs=sorted(s.xs.flatMap(x=>[x-radius,x+radius])),ys=sorted(s.ys.flatMap(y=>[y-radius,y+radius])),nx=xs.length-1,ny=ys.length-1,free=new Uint8Array(nx*ny);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)free[y*nx+x]=+boxCovered(s,(xs[x]+xs[x+1])/2,(ys[y]+ys[y+1])/2,radius);
 // Classification changes only at boundary ± radius. Each accepted tile is a
 // complete free configuration-space rectangle, not a point-sampling shortcut.
 const regions=[];for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){if(free[y*nx+x]!==1)continue;let end=x+1;while(end<nx&&free[y*nx+end]===1)end++;let top=y+1;outer:while(top<ny){for(let k=x;k<end;k++)if(free[top*nx+k]!==1)break outer;top++;}for(let yy=y;yy<top;yy++)for(let xx=x;xx<end;xx++)free[yy*nx+xx]=2;regions.push({x0:xs[x],x1:xs[end],y0:ys[y],y1:ys[top]});}
 if(!regions.length)throw new Error('No clearance regions.');
 const points=regions.map(center),edges=points.map(()=>[]),owners=points.map((_,i)=>i),targets=[];
 const connect=(a,b)=>{if(a===b)return;const d=Math.hypot(points[a][0]-points[b][0],points[a][1]-points[b][1]);edges[a].push([b,d]);edges[b].push([a,d]);};
 const add=(p,region)=>{const id=points.length;points.push(p);edges.push([]);owners.push(region);connect(id,region);return id;};
 for(let a=0;a<regions.length;a++)for(let b=a+1;b<regions.length;b++){const p=regions[a],q=regions[b];let at=null;
  if(Math.abs(p.x1-q.x0)<1e-7||Math.abs(q.x1-p.x0)<1e-7){const lo=Math.max(p.y0,q.y0),hi=Math.min(p.y1,q.y1);if(hi-lo>.0001)at=[Math.abs(p.x1-q.x0)<1e-7?p.x1:q.x1,(lo+hi)/2];}
  else if(Math.abs(p.y1-q.y0)<1e-7||Math.abs(q.y1-p.y0)<1e-7){const lo=Math.max(p.x0,q.x0),hi=Math.min(p.x1,q.x1);if(hi-lo>.0001)at=[(lo+hi)/2,Math.abs(p.y1-q.y0)<1e-7?p.y1:q.y1];}
  if(at){const n=add(at,a);connect(n,b);}}
 const attach=(p,label,kind,id)=>{const region=regions.findIndex(r=>inside(r,...p));if(region<0||!boxCovered(s,...p,radius))throw new Error('Region target lacks clearance: '+label);targets.push({label,kind,id,node:add(p,region),point:p});};
 for(const r of plan.rooms)attach([r.cx,r.cy],r.name,'room',r.id);
 for(const h of plan.hallways){const a=h.points[1],b=h.points[2];attach([(a[0]+b[0])/2,(a[1]+b[1])/2],h.name,'hallway',h.id);}
 const visited=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const [next]of edges[queue[i]])if(!visited.has(next)){visited.add(next);queue.push(next);}if(visited.size!==points.length)throw new Error('Clearance domain is disconnected.');
 if(points.length>2048)throw new Error('Waypoint budget exceeded.');
 const count=points.length,next=new Uint16Array(count*count).fill(65535),cost=new Float32Array(count*count);
 for(let target=0;target<count;target++){const distance=new Float64Array(count).fill(Infinity),done=new Uint8Array(count);distance[target]=0;next[target*count+target]=target;for(let n=0;n<count;n++){let here=-1,best=Infinity;for(let i=0;i<count;i++)if(!done[i]&&distance[i]<best){here=i;best=distance[i];}if(here<0)throw new Error('Unreachable waypoint.');done[here]=1;for(const [from,d]of edges[here])if(best+d<distance[from]-1e-9){distance[from]=best+d;next[from*count+target]=here;}}for(let i=0;i<count;i++)cost[i*count+target]=distance[i];}
 return{radius:profile.radius,clearanceRadius:radius,height,regions,points,edges,owners,targets,count,next,cost,componentCount:1,coverage:'Entire flat configuration-space domain eroded by the declared composite profile plus a 12 mm safety margin.'};
}
export function route(nav,from,to){if(from<0||to<0||from>=nav.count||to>=nav.count)return null;const path=[from];while(from!==to){from=nav.next[from*nav.count+to];if(from===65535||path.length>nav.count)return null;path.push(from);}return path;}
export function validateRoutes(nav){let paths=0;for(let a=0;a<nav.count;a++)for(let b=0;b<nav.count;b++){let at=a,hops=0;while(at!==b){const n=nav.next[at*nav.count+b];if(n===65535||!nav.edges[at].some(e=>e[0]===n)||++hops>nav.count)throw new Error('Invalid lookup route.');at=n;}paths++;}return{paths,waypoints:nav.count,components:1,regions:nav.regions.length};}
