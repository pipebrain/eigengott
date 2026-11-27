import {readStats} from './base-stats.js';
export function blueprint(sim,span=4,protectedIds=null){
 const stats=readStats(sim),n=stats.gridSize,data=new DataView(sim.memory.buffer,sim.active_cells_ptr(),n*n*52),cols=Math.ceil(n/span),protect=protectedIds?new Set(protectedIds):null,mask=[],dark=[],sky=[];
 for(let id=0;id<n*n;id++){const gid=Math.floor(id%n/span)+Math.floor(Math.floor(id/n)/span)*cols,keep=!protect||protect.has(gid);mask.push(keep?data.getUint32(id*52,true):-1);dark.push(data.getFloat32(id*52+32,true));sky.push(data.getFloat32(id*52+48,true));}
 return {n,seed:stats.seed,profile:stats.profile,tile:sim.terrain_tile(),height:sim.terrain_height(),knots:Array.from(new Int32Array(sim.memory.buffer,sim.terrain_knots(),200)),mask,dark,sky};
}
export function writeBlueprint(sim,b){
 if(!b)return;const ints=(a,n,lo,hi)=>Array.isArray(a)&&a.length===n&&a.every(x=>Number.isInteger(x)&&x>=lo&&x<=hi);
 if(![13,25,49].includes(b.n)||!Number.isInteger(b.tile)||b.tile<1024||b.tile>8192||!Number.isInteger(b.height)||b.height<4096||b.height>32768||!ints(b.knots,200,-65536,65536)||!ints(b.mask,b.n*b.n,-1,1)||!ints(b.dark,b.n*b.n,0,1)||!ints(b.sky,b.n*b.n,0,3))throw new Error('Invalid structural blueprint.');
 const a=new Float32Array(sim.memory.buffer,sim.terrain_input(),8+200+3*2401);a.fill(0);a.fill(-1,208,208+2401);a.set([1,b.n,b.tile,b.height]);a.set(b.knots,8);a.set(b.mask,208);a.set(b.dark,208+2401);a.set(b.sky,208+4802);
}
export function geometrySummary(sim){const s=readStats(sim),n=s.gridSize,d=new DataView(sim.memory.buffer,sim.active_cells_ptr(),n*n*52);let low=Infinity,high=-Infinity,dark=0,sky=0;for(let i=0;i<n*n;i++)if(d.getUint32(i*52,true)){const x=(i%n+.5)*s.arenaWidth/n-s.arenaWidth/2,y=(Math.floor(i/n)+.5)*s.arenaWidth/n-s.arenaWidth/2,z=d.getFloat32(i*52+20,true)*x+d.getFloat32(i*52+24,true)*y+d.getFloat32(i*52+28,true);low=Math.min(low,z);high=Math.max(high,z);dark+=+(d.getFloat32(i*52+32,true)>.5);sky+=+(d.getFloat32(i*52+48,true)>.5);}return {seed:s.seed,hash:s.geometryHash,cells:s.cells,minFloor:low,maxFloor:high,heightSpan:high-low,darkCells:dark,skyCells:sky,leaks:s.unmatchedEdges,components:s.components,errors:s.candidateErrors};}
