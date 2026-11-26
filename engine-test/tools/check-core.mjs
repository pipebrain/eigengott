import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),binary=await readFile(new URL('engine.wasm',root));
const module=await WebAssembly.compile(binary);
assert.deepEqual(WebAssembly.Module.imports(module).map(x=>`${x.module}.${x.name}`).sort(),['env.cos','env.now','env.sin','env.sqrt']);
const sim=(await WebAssembly.instantiate(module,{env:{cos:Math.cos,sin:Math.sin,sqrt:Math.sqrt,now:()=>performance.now()}})).exports;
const state=()=>{const p=sim.stats_ptr();return {u:Array.from(new Uint32Array(sim.memory.buffer,p,32)),f:Array.from(new Float32Array(sim.memory.buffer,p+128,32))};};
const data=(kind,candidate)=>new Uint8Array(sim.memory.buffer,sim.arena_buffer_ptr(kind,candidate),sim.arena_buffer_bytes(kind,candidate));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const activeDigest=()=>[0,1,2,3,4,5].map(k=>digest(data(k,0)));
function init(seed=27011984){assert.equal(sim.engine_init(seed),0);assert.equal(sim.engine_activate(sim.candidate_id()),1);assert.equal(sim.engine_player_clear(),1);}
init();assert.equal(sim.abi_version(),1);assert.equal(sim.memory.buffer.byteLength,16*1048576);assert.throws(()=>sim.memory.grow(1),RangeError);
let seeds=0,triangles=0;const timings=[];
for(let n=0;n<256;n++){
 const seed=(Math.imul(n,0x9e3779b9)^27011984)>>>0;
 assert.equal(sim.engine_prepare(seed,0),0,`Valid seed rejected: ${seed}`);let {u,f}=state();assert.equal(u[18],0);assert.equal(u[19],0);assert.equal(u[20],1);assert.equal(u[21],0);
 assert.ok(u[16]>0&&u[16]<u[26]);assert.ok(u[17]>0&&u[17]<u[27]);assert.equal(sim.candidate_vbo_ptr()%16,0);assert.equal(sim.candidate_lights_ptr()%16,0);
 const vertices=new DataView(data(0,1).buffer,data(0,1).byteOffset,data(0,1).byteLength),indices=new Uint32Array(data(1,1).buffer,data(1,1).byteOffset,data(1,1).byteLength/4);
 for(let i=0;i<vertices.byteLength;i+=32){for(const offset of [0,4,8,24,28])assert.ok(Number.isFinite(vertices.getFloat32(i+offset,true)));}
 assert.ok(indices.every(i=>i<u[16]));assert.ok(data(4,1).every((v,i)=>i%4===3||v%17===0),'Lightmap samples are quantized');
 const before=digest(data(0,1))+digest(data(1,1));assert.equal(sim.engine_prepare(seed,0),0);assert.equal(digest(data(0,1))+digest(data(1,1)),before,'Seeded meshing must be deterministic');
 assert.equal(sim.engine_activate(sim.candidate_id()),1);assert.equal(sim.engine_player_clear(),1);triangles+=u[15];seeds++;if(n<12)timings.push({generationMs:f[9],validationMs:f[10],surfaceMs:f[11],bakeMs:f[12]});
}
init();const baseline=activeDigest(),active=state().u.slice(1,3),position=state().f.slice(0,9);const expected=[2,1,4,256,16,64,512,8];
for(let fault=1;fault<=8;fault++){
 const errors=sim.engine_prepare(93,fault);assert.ok(errors&expected[fault-1],`Fault ${fault} did not report its cause`);assert.equal(sim.engine_activate(sim.candidate_id()),0);
 assert.deepEqual(activeDigest(),baseline,'Rejected candidate changed active geometry');assert.deepEqual(state().u.slice(1,3),active);assert.deepEqual(state().f.slice(0,9),position);
}
assert.equal(sim.engine_prepare(94,0),0);const stale=sim.candidate_id();assert.equal(sim.engine_prepare(95,0),0);assert.equal(sim.engine_activate(stale),0,'Stale generation must not activate');assert.equal(sim.engine_activate(sim.candidate_id()),1);
const trajectories=[];
for(const fps of [30,60,120,240]){init();for(let i=0;i<fps*2;i++)sim.engine_tick(1/fps,1,0,0);const {u,f}=state();assert.equal(u[23],240);assert.equal(sim.engine_player_clear(),1);trajectories.push({fps,position:f.slice(0,3),velocity:f.slice(3,6)});}
for(const trajectory of trajectories)assert.deepEqual(trajectory.position,trajectories[0].position,'Physics depends on render rate');
init();for(let i=0;i<120;i++)sim.engine_tick(1/120,0,0,0);const resting=state().f.slice(0,3);for(let i=0;i<1200;i++)sim.engine_tick(1/120,0,0,0);
assert.ok(state().f.slice(0,3).every((v,i)=>Math.abs(v-resting[i])<.002),'Idle player drifts down the ramp');
const ground=state().f[2];let peak=ground;
for(let i=0;i<240;i++){sim.engine_tick(1/120,i<24?16:0,0,0);peak=Math.max(peak,state().f[2]);assert.equal(sim.engine_player_clear(),1,'Jump penetrated geometry');}
assert.ok(peak>ground+.3);assert.equal(state().u[22],1);
let movementSteps=0;
for(const input of [1,2,4,8,1|4,1|8,2|4,2|8]){init();for(let i=0;i<960;i++){sim.engine_tick(1/120,input,0,0);if(i%12===0)assert.equal(sim.engine_player_clear(),1,`Penetration for movement bits ${input}`);movementSteps++;}}
init();const p=state().f.slice(0,3);assert.ok(sim.engine_sweep_test(...p,0,0,100)<1,'Upward sweep missed the ceiling');assert.ok(sim.engine_sweep_test(...p,0,0,-100)<1,'Downward sweep missed the floor');assert.ok(sim.engine_sweep_test(...p,100,0,0)<1,'Horizontal sweep missed a wall');
assert.equal(sim.engine_contains(1000,1000,1000),0);assert.equal(sim.engine_contains(0,0,2),0,'Solid central pillar is interior');assert.equal(sim.engine_try_place(1000,1000,1000,0,0),0);
sim.engine_tick(NaN,0,NaN,Infinity);assert.ok(state().f.every(Number.isFinite));const steps=state().u[23];sim.engine_tick(10,0,0,0);assert.equal(state().u[23]-steps,12,'Long frame exceeded the fixed-step cap');
const report={passed:true,rust:'1.100.0 / wasm32-unknown-unknown',wasmBytes:binary.length,wasmMemoryBytes:sim.memory.buffer.byteLength,validSeeds:seeds,structuralTrianglesChecked:triangles,rejectedFaults:8,movementSteps,renderRatesCompared:trajectories,phaseSamples:timings,
 checks:['Deterministic seeded topology/surface meshes','Closed oriented manifold boundary and connected interior','Finite bounded GPU buffers and quantized lightmaps','Eight invalid candidates preserve active arena bytes and player state','Stale activation rejected','Frame-rate-independent 120 Hz simulation','Stationary ramp contact','Jump/landing and eight movement directions without penetration','Swept floor/ceiling/wall collision','Exterior/pillar containment and invalid placement rejection','Bounded memory, finite inputs, and catch-up cap']};
await writeFile(new URL('evidence/core-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,phaseSamples:timings.slice(0,2)},null,2));
