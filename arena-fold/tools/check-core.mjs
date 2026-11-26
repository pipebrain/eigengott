import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {imports,readStats,bytes} from '../stats.js';
const binary=await readFile(new URL('../fold.wasm',import.meta.url));
const sim=(await WebAssembly.instantiate(binary,imports())).instance.exports;
const stats=()=>readStats(sim),tick=(n,bits=0)=>{for(let i=0;i<n;i++)sim.fold_tick(1/120,bits,0,0);};
const panel=(id,p)=>Array.from(new Float32Array(sim.memory.buffer,sim.fold_panel(id,p),16));
const shapes=()=>Array.from(new Float32Array(sim.memory.buffer,sim.fold_shapes(),16));
const len=a=>Math.hypot(...a),sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const point=(b,v)=>[0,1,2].map(i=>b[i]+v[0]*b[4+i]+v[1]*b[8+i]+v[2]*b[12+i]);
function distanceToBox(p,b){const d=sub(p,b.slice(0,3));return Math.hypot(...[4,8,12].map(k=>Math.max(0,Math.abs(dot(d,b.slice(k,k+3)))-b[k+3])));}
function clearance(shape,b){ // Independent convex minimization, no Rust implementation reuse.
 const a=shape.slice(0,3),delta=sub(shape.slice(4,7),a),f=t=>distanceToBox(a.map((x,i)=>x+t*delta[i]),b);
 let lo=0,hi=1;for(let i=0;i<70;i++){const x=lo+(hi-lo)/3,y=hi-(hi-lo)/3;if(f(x)<f(y))hi=y;else lo=x;}
 return Math.min(f(0),f(1),f((lo+hi)/2))-shape[3];
}
sim.fold_init();assert.equal(sim.abi_version(),1);assert.equal(sim.memory.buffer.byteLength,4194304);assert.throws(()=>sim.memory.grow(1),RangeError);
assert.ok(stats().clear&&stats().sealed&&stats().bounded);
// Every point on every moving box obeys the bound used by interval certification.
let boundChecks=0;const bounds=[8,8,9.3,5];
for(let id=0;id<4;id++)for(let n=0;n<1000;n++){
 const a=panel(id,n/1000),b=panel(id,(n+1)/1000);
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
  const pa=point(a,[x*a[7],y*a[11],z*a[15]]),pb=point(b,[x*b[7],y*b[11],z*b[15]]);
  assert.ok(len(sub(pb,pa))<=bounds[id]/1000+1e-5);boundChecks++;
 }
}
// Default location permits a complete, reversible fold, including ceiling leaf.
for(let n=0;n<=500;n++){assert.equal(sim.fold_seek(n/500),1);assert.ok(stats().clear&&stats().sealed&&stats().bounded);}
for(let n=500;n>=0;n--)assert.equal(sim.fold_seek(n/500),1);
const blockers=[];
for(const scenario of [1,2]){
 sim.fold_reset(scenario);assert.ok(stats().clear);sim.fold_trigger(1);tick(600);
 const d=stats();assert.ok(d.phase<.99&&d.blockedPanels&&d.blockedBy);assert.ok(d.clear&&d.sealed);assert.ok(Math.min(d.bodyClearance,d.weaponClearance)>=d.margin-.0001);
 blockers.push({scenario,phase:d.phase,by:d.blockedBy,panels:d.blockedPanels});
 // Actual player movement releases the hold; no fixture relocation is used.
 const heldPosition=d.position;for(let n=0;n<600;n++){sim.fold_tick(1/120,scenario===1?2:1,0,0);assert.equal(sim.fold_clear(),1);}
 assert.ok(len(sub(stats().position,heldPosition))>1);assert.ok(stats().phase>.999);
}
// Large phase jumps cannot tunnel through the protected volume even when
// the two endpoint placements are clear. Find such a trajectory independently.
let tunnelCases=0;
for(let x=-5;x<=4;x+=.75)for(let y=-.5;y<=6;y+=.75){
 sim.fold_reset(0);if(!sim.fold_place(x,y,.035,0,0))continue;const s=shapes();
 if([0,1,2,3].some(id=>[0,8].some(k=>clearance(s.slice(k,k+8),panel(id,1))<.201)))continue;
 let intersects=false;for(let p=.05;p<1&&!intersects;p+=.05)for(let id=0;id<4;id++)for(const k of [0,8])if(clearance(s.slice(k,k+8),panel(id,p))<0)intersects=true;
 if(intersects){assert.equal(sim.fold_seek(1),0,'Endpoint-only test allowed tunneling');assert.equal(stats().phase,0);tunnelCases++;}
}
assert.ok(tunnelCases>0);
const trajectories=[];
for(const fps of [30,60,120,240]){sim.fold_init();sim.fold_trigger(1);for(let n=0;n<fps*3;n++)sim.fold_tick(1/fps,2,0,0);trajectories.push(stats());assert.equal(stats().physicsSteps,360);}
for(const t of trajectories)assert.deepEqual(t.position,trajectories[0].position);
// The proxies must cover the actual rendered body and held gun, not just an eye.
let meshChecks=0,coveredTriangles=0,maxUncovered=0;
function capDistance(p,s){const a=s.slice(0,3),v=sub(s.slice(4,7),a),t=Math.max(0,Math.min(1,dot(sub(p,a),v)/dot(v,v)));return len(sub(p,a.map((x,i)=>x+t*v[i])))-s[3];}
function covered(tri,shapes,depth=10){
 // A capsule is convex: a triangle whose three vertices lie in that SAME
 // capsule is wholly covered. Subdivide only faces spanning the overlap.
 if(shapes.some(s=>tri.every(p=>capDistance(p,s)<=0)))return true;
 if(!depth)return false;const [a,b,c]=tri,m=(a,b)=>a.map((x,i)=>(x+b[i])*.5),ab=m(a,b),bc=m(b,c),ca=m(c,a);
 return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]].every(t=>covered(t,shapes,depth-1));
}
for(let yaw=0;yaw<6.2;yaw+=.7)for(const pitch of [-1.44,...Array.from({length:15},(_,i)=>-1.4+i*.2),1.44]){
 sim.fold_init();assert.equal(sim.fold_place(0,-5,.035,yaw,pitch),1);const s=shapes(),view=new DataView(bytes(sim,2).buffer,sim.fold_buffer(2),sim.fold_bytes(2));
 const points=[];for(let n=0;n<view.byteLength;n+=32){const p=[0,4,8].map(i=>view.getFloat32(n+i,true));points.push(p);const d=Math.min(capDistance(p,s.slice(0,8)),capDistance(p,s.slice(8,16)));maxUncovered=Math.max(maxUncovered,d);assert.ok(d<.0001,`Rendered body escapes proxy by ${d}; yaw=${yaw} pitch=${pitch} vertex=${n/32} point=${p}`);meshChecks++;}
 const indices=new Uint32Array(sim.memory.buffer,sim.fold_buffer(3),sim.fold_bytes(3)/4);for(let n=0;n<indices.length;n+=3){assert.ok(covered([0,1,2].map(i=>points[indices[n+i]]),[s.slice(0,8),s.slice(8,16)]),`Uncovered triangle ${n/3}; yaw ${yaw}; pitch ${pitch}; points ${JSON.stringify([0,1,2].map(i=>points[indices[n+i]]))}`);coveredTriangles++;}
}
// Bounded randomized movement, look and reversals. Validate every physics step
// against an independent sampled capsule/OBB distance calculation.
let random=0x1a21594;const rand=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return (random>>>0)/4294967296;};
let movementSteps=0;
for(let route=0;route<8;route++){
 sim.fold_init();sim.fold_options(1,1,1,1,.2);sim.fold_trigger(1);
 for(let n=0;n<1800;n++){
  sim.fold_tick(1/120,[0,1,2,4,8,5,9,17][Math.floor(n/45)%8],(rand()-.5)*20,(rand()-.5)*5);
  const d=stats();assert.ok(d.clear&&d.sealed&&d.bounded,JSON.stringify(d));
  if(n%15===0){const s=shapes();for(let id=0;id<4;id++)for(const k of [0,8])assert.ok(clearance(s.slice(k,k+8),panel(id,d.phase))>=-.0001);}
  movementSteps++;
 }
}
sim.fold_init();const before=stats();assert.equal(sim.fold_seek(NaN),0);assert.equal(sim.fold_place(NaN,0,0,0,0),0);sim.fold_tick(NaN,0,NaN,NaN);assert.deepEqual(stats().position,before.position);
for(const kind of [0,2]){const b=bytes(sim,kind),indices=new Uint32Array(sim.memory.buffer,sim.fold_buffer(kind+1),sim.fold_bytes(kind+1)/4);assert.ok(indices.every(i=>i<b.length/32));}
const report={passed:true,wasmBytes:binary.length,memoryBytes:sim.memory.buffer.byteLength,boundChecks,tunnelCases,meshChecks,coveredTriangles,maxUncovered,movementSteps,blockers,trajectories:trajectories.map(d=>({position:d.position,phase:d.phase}))};
await writeFile(new URL('../evidence/core.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
