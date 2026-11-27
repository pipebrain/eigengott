// Deterministic farthest-point sampling over every reachable navigation node.
// Greedy max-min with a route-distance tie break, not a claimed global packing optimum.
export function spawnRanking(nav,occupied,excluded=new Set()){
 const anchor=occupied[0],source=nearest(nav,anchor),component=nav.components[source],paths=new Float32Array(nav.count).fill(Infinity),queue=[source];paths[source]=0;
 for(let q=0;q<queue.length;q++)for(const next of nav.edges[queue[q]])if(!Number.isFinite(paths[next])){paths[next]=paths[queue[q]]+nav.tile;queue.push(next);}
 const out=[];for(let i=0;i<nav.count;i++){if(excluded.has(i)||nav.components[i]!==component)continue;const p=Array.from(nav.points.slice(i*3,i*3+3)),separation=Math.min(...occupied.map(q=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])));out.push({node:i,p,separation,path:paths[i]});}
 return out.sort((a,b)=>b.separation-a.separation||b.path-a.path||a.node-b.node);
}
function nearest(nav,p){let best=0,d=Infinity;for(let i=0;i<nav.count;i++){const n=Math.hypot(...p.map((v,k)=>v-nav.points[i*3+k]));if(n<d){d=n;best=i;}}return best;}
