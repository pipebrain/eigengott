export const errorNames=mask=>['invalid sector','exterior leak','nonmanifold seam','inconsistent winding','disconnected interior','invalid spawn clearance','capacity exceeded','face intersection','broken sector binding','invalid index','degenerate triangle'].filter((_,i)=>mask&(1<<i));
export function readStats(sim){
  if(!sim)return null;
  const pointer=sim.stats_ptr(),u=new Uint32Array(sim.memory.buffer,pointer,32),f=new Float32Array(sim.memory.buffer,pointer+128,32);
  const b=new Uint32Array(sim.memory.buffer,sim.bench_ptr(),32);
  return {abi:u[0],activeId:u[1],seed:u[2],candidateId:u[3],candidateSeed:u[4],candidateReady:!!u[5],candidateErrors:u[6],candidateMessages:errorNames(u[6]),
    cells:u[7]||u[14],topologyVertices:u[8],triangles:u[9]||u[15],vertices:u[10]||u[16],indices:u[11]||u[17],faces:u[12],lights:u[13],
    unmatchedEdges:u[18],nonmanifoldEdges:u[19],components:u[20],intersections:u[21],grounded:!!u[22],physicsSteps:u[23],collisionHits:u[24],blockedLooks:u[25],vertexCapacity:u[26],indexCapacity:u[27],geometryHash:u[28]||u[29],activations:u[30],arenaStorageBytes:u[31],
    position:Array.from(f.subarray(0,3)),velocity:Array.from(f.subarray(3,6)),yaw:f[6],pitch:f[7],simulationTime:f[8],generationMs:f[9],validationMs:f[10],surfaceMs:f[11],bakeMs:f[12],spawn:Array.from(f.subarray(13,16)),arenaWidth:f[16],arenaHeight:f[17],up:Array.from(f.subarray(18,21)),
    profile:b[0],gridSize:b[1],atlasSize:b[2],density:b[3],detail:b[4],requestedLights:b[5],bakedTexels:b[6],visibilityRays:b[7],visibilitySteps:b[8],bvhNodes:b[9],intersectionPairs:b[10],movementProfile:b[12],cameraMode:b[13]};
}
export const imports=progress=>({env:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt,now:()=>performance.now(),progress:progress||(()=>{})}});
export const summary=values=>{
  const a=Array.from(values).filter(Number.isFinite).sort((x,y)=>x-y),at=p=>a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:0;
  return {samples:a.length,median:at(.5),p95:at(.95),p99:at(.99),max:a.at(-1)||0};
};
export const PRESETS=Object.freeze([
  {name:'Small · accepted baseline',profile:0,lights:12,density:2,detail:1},
  {name:'Medium · 75 m arena',profile:1,lights:24,density:2,detail:1},
  {name:'Large · 196 m arena',profile:2,lights:48,density:2,detail:1},
]);
export function normalizeSettings(value={}){
  const integer=(key,min,max,fallback)=>Number.isInteger(value[key])&&value[key]>=min&&value[key]<=max?value[key]:fallback;
  return {profile:integer('profile',0,2,0),lights:integer('lights',1,64,12),density:integer('density',1,4,2),detail:integer('detail',0,2,1)};
}
