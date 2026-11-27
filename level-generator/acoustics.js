// Data-only room/corridor acoustics contract for the independent v0.1.6 mixer.
import {contains} from './geometry.js';
import {floorAt} from './elevation.js';
export const ACOUSTIC_SCHEMA=1;
export const DEFAULT_STAGES=3;
export const MAX_STAGES=8;
const distance=(a,b)=>Math.hypot(...a.map((n,k)=>n-b[k]));
const stages=value=>{if(!Number.isInteger(value)||value<0||value>MAX_STAGES)throw new Error('Acoustic stage limit must be an integer from 0 to '+MAX_STAGES);return value;};

export function buildAcoustics(plan,structure,nav){
 const graph={schema:ACOUSTIC_SCHEMA,generator:plan.version,seed:plan.seed,defaultStages:DEFAULT_STAGES,maxStages:MAX_STAGES,referenceDistance:1,speedOfSound:343,corridorLossDb:6,coordinates:'metres; x/y plan, z up; Web Audio mapping [x,z,-y]',elevation:plan.elevation,clearHeight:plan.ceiling,nodes:[],edges:[],portals:[],polygons:structure.polygons,boundary:structure.boundary};
 for(const room of plan.rooms){
  const walls=[];
  for(const[axis,at]of [[0,room.x0],[0,room.x1],[1,room.y0],[1,room.y1]]){
   const eligible=structure.boundary.filter(([a,b])=>Math.abs(a[axis]-at)<1e-7&&Math.abs(b[axis]-at)<1e-7&&[a,b].every(p=>p[0]>=room.x0-1e-7&&p[0]<=room.x1+1e-7&&p[1]>=room.y0-1e-7&&p[1]<=room.y1+1e-7)).sort((a,b)=>distance(b[0],b[1])-distance(a[0],a[1]));
   if(!eligible.length)continue;const[a,b]=eligible[0],length=distance(a,b);if(length<.1)continue;
   let normal=[-(b[1]-a[1])/length,(b[0]-a[0])/length,0];if(normal[0]*(room.cx-a[0])+normal[1]*(room.cy-a[1])<0)normal=normal.map(v=>-v);
   walls.push({a:[...a,room.floorZ],b:[...b,room.floorZ],normal:normal.map(v=>v||0),bottom:room.floorZ,top:room.ceilingZ,energyReflectance:.35});
  }
  graph.nodes.push({id:'room:'+room.id,kind:'room',owner:room.id,label:room.name,position:[...room.anchor,room.floorZ+1.5],footprint:[[room.outline,...room.obstacles.map(o=>o.outline)]],reflectionWalls:walls,navTarget:nav.targets.find(t=>t.kind==='room'&&t.id===room.id).node});
 }
 for(const h of plan.hallways)graph.nodes.push({id:'corridor:'+h.id,kind:'corridor',owner:h.id,label:h.name,position:[...h.anchor,floorAt(plan,...h.anchor)+1.5],footprint:h.polygons,reflectionWalls:[],navTarget:nav.targets.find(t=>t.kind==='hallway'&&t.id===h.id).node});
 graph.edges=graph.nodes.map(()=>[]);
 for(const h of plan.hallways){const corridor=plan.rooms.length+h.id;
  for(const id of[h.a,h.b]){const room=plan.rooms[id],end=h.points.reduce((best,p)=>distance(p,room.anchor)<distance(best,room.anchor)?p:best,h.points[0]),portal=graph.portals.length;
   graph.portals.push({id:portal,room:id,corridor:h.id,position:[...end,floorAt(plan,...end)+1.5]});
   const a=graph.nodes[id].navTarget,b=graph.nodes[corridor].navTarget,length=nav.cost[a*nav.count+b];if(!Number.isFinite(length)||length<=0)throw new Error('Acoustic connection lacks a valid navigation path.');
   for(const[from,to]of [[id,corridor],[corridor,id]])graph.edges[from].push({to,portal,distance:length,lossDb:graph.corridorLossDb/2});
  }
 }
 graph.precomputed=graph.nodes.map((_,source)=>propagate(graph,source,DEFAULT_STAGES));
 return graph;
}

// Dynamic programming over (node, transition count), never a branching path
// flood. The uniform corridor loss makes shortest distance optimal per layer.
export function propagate(graph,source,maxStages=graph.defaultStages){
 stages(maxStages);if(!Number.isInteger(source)||!graph.nodes[source])throw new Error('Unknown acoustic source node.');
 const limit=maxStages*2,count=graph.nodes.length,layers=Array.from({length:limit+1},()=>Array(count).fill(null));
 layers[0][source]={distance:0,lossDb:0,path:[source],transitions:0};let expansions=0;
 for(let depth=0;depth<limit;depth++)for(let node=0;node<count;node++){const state=layers[depth][node];if(!state)continue;expansions++;
  for(const e of graph.edges[node]){const candidate={distance:state.distance+e.distance,lossDb:state.lossDb+e.lossDb,path:[...state.path,e.to],transitions:depth+1},old=layers[depth+1][e.to];if(!old||candidate.distance<old.distance-1e-7)layers[depth+1][e.to]=candidate;}
 }
 return{maxStages,maxTransitions:limit,expansions,stateBudget:count*(limit+1),candidates:graph.nodes.map((_,node)=>layers.map(layer=>layer[node]).filter(Boolean))};
}

export function locateAcousticNode(graph,position){
 if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return-1;
 if(!contains(graph.polygons,position))return-1;
 const floor=floorAt(graph,...position);if(position[2]<=floor||position[2]>=floor+graph.clearHeight)return-1;
 return graph.nodes.findIndex(n=>contains(n.footprint,position));
}

function segmentInside(graph,a,b){
 const ts=[0,1],dx=b[0]-a[0],dy=b[1]-a[1];
 for(const[c,d]of graph.boundary){const ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;if(Math.abs(den)<1e-10)continue;const t=((c[0]-a[0])*ey-(c[1]-a[1])*ex)/den,u=((c[0]-a[0])*dy-(c[1]-a[1])*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);}
 ts.sort((a,b)=>a-b);return ts.slice(1).every((t,i)=>{const m=(t+ts[i])/2;return contains(graph.polygons,[a[0]+dx*m,a[1]+dy*m]);});
}

export function wallReflections(graph,node,source,listener,{referenceDistance=graph.referenceDistance}={}){
 const room=graph.nodes[node];if(!room||room.kind!=='room')return[];
 const taps=[];for(const wall of room.reflectionWalls.slice(0,4)){
  const n=wall.normal,signed=n.reduce((s,v,k)=>s+v*(source[k]-wall.a[k]),0);if(signed<=.001)continue;
  const image=source.map((v,k)=>v-2*signed*n[k]),ray=listener.map((v,k)=>v-image[k]),den=n.reduce((s,v,k)=>s+v*ray[k],0);if(Math.abs(den)<1e-8)continue;
  const t=n.reduce((s,v,k)=>s+v*(wall.a[k]-image[k]),0)/den;if(t<=0||t>=1)continue;const hit=image.map((v,k)=>v+ray[k]*t),v=wall.b.map((v,k)=>v-wall.a[k]),length2=v.reduce((s,n)=>s+n*n,0),along=v.reduce((s,n,k)=>s+n*(hit[k]-wall.a[k]),0)/length2;
  if(along<0||along>1||hit[2]<=wall.bottom||hit[2]>=wall.top||!segmentInside(graph,source,hit)||!segmentInside(graph,hit,listener))continue;
  const metres=distance(source,hit)+distance(hit,listener),energyGain=(referenceDistance/Math.max(referenceDistance,metres))**2*wall.energyReflectance;
  taps.push({wall:room.reflectionWalls.indexOf(wall),position:hit,distance:metres,delaySeconds:metres/graph.speedOfSound,energyGain,gain:Math.sqrt(energyGain)});
 }return taps;
}

export function createAcousticRuntime(graph){
 if(graph.schema!==ACOUSTIC_SCHEMA)throw new Error('Unknown acoustic graph schema.');validateAcoustics(graph);
 const cache=new Map();
 return{
  evaluate({sourceNode,listenerNode,sourcePosition,listenerPosition,maxStages=graph.defaultStages,referenceDistance=graph.referenceDistance}){
   stages(maxStages);if(!Number.isFinite(referenceDistance)||referenceDistance<=0)throw new Error('Acoustic reference distance must be positive.');
   const index=id=>typeof id==='string'?graph.nodes.findIndex(n=>n.id===id):id,from=index(sourceNode),to=index(listenerNode);if(!graph.nodes[from]||!graph.nodes[to])return{audible:false,reason:'unknown node',reflections:[]};
   const source=sourcePosition||graph.nodes[from].position,listener=listenerPosition||graph.nodes[to].position;if(![source,listener].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw new Error('Acoustic positions must be finite XYZ arrays.');
   const key=from+':'+maxStages;let result=maxStages===graph.defaultStages?graph.precomputed[from]:cache.get(key);if(!result){result=propagate(graph,from,maxStages);cache.set(key,result);}
   let best=null;for(const p of result.candidates[to]){const metres=from===to&&p.transitions===0?distance(source,listener):p.distance+distance(source,graph.nodes[from].position)+distance(listener,graph.nodes[to].position),energyGain=(referenceDistance/Math.max(referenceDistance,metres))**2*10**(-p.lossDb/10);if(!best||energyGain>best.energyGain)best={...p,distance:metres,energyGain,gain:Math.sqrt(energyGain),delaySeconds:metres/graph.speedOfSound};}
   if(!best)return{audible:false,reason:'stage limit',maxStages,maxTransitions:result.maxTransitions,expansions:result.expansions,stateBudget:result.stateBudget,reflections:[]};
   const previous=best.path.at(-2),edge=previous===undefined?null:graph.edges[previous].find(e=>e.to===to),entryPosition=edge?graph.portals[edge.portal].position:source;
   const reflections=wallReflections(graph,to,entryPosition,listener,{referenceDistance}).map(t=>{const metres=t.distance+(best.transitions?Math.max(0,best.distance-distance(entryPosition,listener)):0),energyGain=(referenceDistance/Math.max(referenceDistance,metres))**2*10**(-best.lossDb/10)*graph.nodes[to].reflectionWalls[t.wall].energyReflectance;return{...t,distance:metres,gain:Math.sqrt(energyGain),energyGain,delaySeconds:metres/graph.speedOfSound};});
   return{audible:true,...best,entryPosition,maxStages,maxTransitions:result.maxTransitions,expansions:result.expansions,stateBudget:result.stateBudget,reflections};
  },
  snapshot:()=>({cachedSources:cache.size,cacheBudget:graph.nodes.length*(MAX_STAGES+1),maxReflections:4,defaultStages:graph.defaultStages})
 };
}

export function validateAcoustics(graph){
 if(graph.schema!==ACOUSTIC_SCHEMA||graph.defaultStages!==DEFAULT_STAGES)throw new Error('Invalid acoustic contract.');
 let edges=0;for(let a=0;a<graph.nodes.length;a++){const n=graph.nodes[a];if(n.reflectionWalls.length>4||n.kind==='corridor'&&n.reflectionWalls.length)throw new Error('Acoustic reflection budget exceeded.');for(const e of graph.edges[a]){if(!graph.nodes[e.to]||n.kind===graph.nodes[e.to].kind||!graph.edges[e.to].some(q=>q.to===a&&q.portal===e.portal)||e.distance<=0||e.lossDb!==graph.corridorLossDb/2)throw new Error('Invalid reciprocal room/corridor acoustic edge.');edges++;}}
 const reached=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const e of graph.edges[queue[i]])if(!reached.has(e.to)){reached.add(e.to);queue.push(e.to);}if(reached.size!==graph.nodes.length)throw new Error('Acoustic graph has orphaned nodes.');
 for(const p of graph.precomputed){if(p.expansions>p.stateBudget||p.maxTransitions!==DEFAULT_STAGES*2)throw new Error('Acoustic propagation budget exceeded.');for(const candidates of p.candidates)for(const c of candidates){if(c.transitions>p.maxTransitions||c.path.length!==c.transitions+1)throw new Error('Invalid precomputed acoustic path.');for(let i=1;i<c.path.length;i++)if(!graph.edges[c.path[i-1]].some(e=>e.to===c.path[i]))throw new Error('Acoustic path crosses an unconnected boundary.');}}
 return{nodes:graph.nodes.length,directedEdges:edges,defaultStages:DEFAULT_STAGES,maxTransitions:DEFAULT_STAGES*2,maxReflections:4,maxStateExpansions:Math.max(...graph.precomputed.map(p=>p.expansions)),stateBudget:graph.nodes.length*(DEFAULT_STAGES*2+1)};
}
