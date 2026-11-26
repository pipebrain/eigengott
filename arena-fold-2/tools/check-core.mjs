import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {imports,readStats,readSectors,readEvents,bytes} from '../stats.js';
const binary=await readFile(new URL('../wave.wasm',import.meta.url)),sim=(await WebAssembly.instantiate(binary,imports())).instance.exports;
const stats=()=>readStats(sim),sectors=()=>readSectors(sim),hash=b=>createHash('sha256').update(b).digest('hex');
const DEFAULT={spread:.72,coherence:0,delay:.38,duration:1.1,hz:12,blank:.28,jitter:.25,roots:2,depth:6,margin:.2,tail:.5,interval:2,enabled:1,loop:0,stageBodies:1};
function configure(s={}){s={...DEFAULT,...s};sim.wave_options(s.enabled,s.loop,s.spread,s.coherence,s.delay,s.duration,s.hz,s.blank,s.jitter,s.roots,s.depth,s.margin,s.tail,s.interval,s.stageBodies);}
function init(seed=27011984,s={}){sim.fold_init(seed);configure(s);}
function tick(n=1,bits=0){for(let k=0;k<n;k++)sim.fold_tick(1/120,bits,0,0);}
// The final step clears bodies, so this helper checks the state on its two sides.
function finish(){let n=0;while(stats().active&&n++<6000){assert.ok(stats().bodies);tick();assert.equal(sim.fold_clear(),1);}assert.ok(n<6000);assert.equal(stats().bodies,false);return n;}
init();assert.equal(sim.abi_version(),2);assert.equal(sim.memory.buffer.byteLength,4194304);assert.throws(()=>sim.memory.grow(1),RangeError);assert.ok(stats().clear&&stats().catalogValid&&stats().sealed);
const catalog=[];for(let id=0;id<20;id++)for(let v=0;v<6;v++){const first=Array.from(new Float32Array(sim.memory.buffer,sim.wave_piece(id,v,0),16));const pieces=[];for(let n=0;n<first[3];n++)pieces.push(Array.from(new Float32Array(sim.memory.buffer,sim.wave_piece(id,v,n),16)));catalog.push(pieces);}
// One root + certain spread visits exactly the complete four-neighbour graph.
init(94,{spread:1,roots:1,depth:12,jitter:0});const old=sectors();assert.equal(sim.wave_start(),1);assert.equal(sim.wave_start(),0);let previewSamples=0,blankSamples=0,stableByteChecks=0,lastKeys='',lastHash='';
while(stats().active){
 const nodes=sectors();for(const s of nodes)if(s.state===2){if(s.visible>=0){assert.notEqual(s.visible,s.target,'An audition displayed the final selection');assert.notEqual(s.visible,s.variant,'An audition displayed the protected fallback');previewSamples++;}else blankSamples++;}
 const keys=nodes.map(s=>s.visible).join(','),world=hash(bytes(sim,0));if(keys===lastKeys){assert.equal(world,lastHash,'Geometry moved without a discrete state change');stableByteChecks++;}lastKeys=keys;lastHash=world;
 assert.ok(stats().bodies);tick();assert.equal(sim.fold_clear(),1);
}
assert.equal(stats().visited,20);assert.equal(stats().changed,20);assert.equal(stats().bodyClears,1);assert.equal(stats().bodies,false);assert.ok(previewSamples&&blankSamples&&stableByteChecks);
const reached=sectors();for(const s of reached){assert.notEqual(s.variant,old[s.id].variant);if(!s.instigator){const p=reached[s.parent];assert.equal(Math.abs(s.id%4-p.id%4)+Math.abs(Math.floor(s.id/4)-Math.floor(p.id/4)),1);assert.equal(s.depth,p.depth+1);assert.ok(s.start>=p.start+45);}assert.equal(s.epoch,1);}
// Every catalogue vertex stays fixed across the entire wave.
for(let id=0;id<20;id++)for(let v=0;v<6;v++)for(let n=0;n<catalog[id*6+v].length;n++)assert.deepEqual(Array.from(new Float32Array(sim.memory.buffer,sim.wave_piece(id,v,n),16)),catalog[id*6+v][n]);
// Isolated roots and a fully coherent world. Unchanged sectors remain byte-stable,
// while ALL old body fixtures clear at the wave boundary, including untouched cells.
init(94,{spread:0,roots:1});sim.fold_render_options(0,0,1);const bodyBytes=sim.fold_bytes(2);assert.equal(bodyBytes,42*24*32);sim.wave_start();finish();assert.equal(stats().visited,1);assert.equal(sim.fold_bytes(2),0);assert.equal(sectors().filter(s=>s.epoch===0).length,19);
init(94,{coherence:1});const stable=hash(bytes(sim,0)),revision=stats().meshRevision;sim.wave_start();finish();assert.equal(stats().visited,0);assert.equal(stats().changed,0);assert.equal(stats().meshRevision,revision);assert.equal(hash(bytes(sim,0)),stable);assert.equal(stats().bodyClears,1);
// Increasing coherence reduces expected affected sectors over a matched seed set.
const coherence=[];for(const c of [0,.5,.9,1]){let affected=0;for(let seed=0;seed<24;seed++){init(seed,{coherence:c,delay:.08,duration:.25,tail:.1});sim.wave_start();finish();affected+=stats().visited;}coherence.push({coherence:c,affected});}for(let i=1;i<coherence.length;i++)assert.ok(coherence[i].affected<=coherence[i-1].affected);
// Untouched geometry can survive multiple arena iterations, even though bodies never do.
init(93,{spread:0,roots:1,delay:.08,duration:.25,tail:.1});for(let n=0;n<8;n++){sim.wave_start();finish();}assert.ok(sectors().some(s=>s.age>=5));assert.equal(stats().bodyClears,8);
// Snapshot-based fixed-step generation is independent of the render cadence.
const parity=[];for(const fps of [30,60,120,240]){init(94);sim.wave_start();for(let n=0;n<fps*6;n++)sim.fold_tick(1/fps,0,0,0);parity.push({fps,stats:stats(),sectors:sectors(),events:readEvents(sim)});}for(const p of parity){assert.deepEqual(p.sectors,parity[0].sectors);assert.deepEqual(p.events,parity[0].events);assert.equal(p.stats.physicsSteps,720);}
// Player and gun can independently veto a final replacement. A veto retains the
// entire committed sector, completes the wave, and never displaces the player.
const holds=[];for(const [kind,offset]of [['body',[0,0]],['weapon',[0,-1.6]]]){
 let found=false;for(let seed=0;seed<180&&!found;seed++){
  init(seed,{spread:1,roots:1,depth:12,jitter:0,delay:.08,duration:.25,tail:.1});if(sectors()[5].variant!==5)continue;
  if(!sim.fold_place(-2+offset[0],-4+offset[1],.035,0,0))continue;tick(30);const before=stats().position;sim.wave_start();finish();const s=sectors()[5];
  const bit=kind==='body'?1:2;if(s.state===4&&(s.protectedBy&bit)&&(kind!=='weapon'||s.protectedBy===2)){assert.deepEqual(stats().position,before);assert.equal(s.variant,5);holds.push({kind,seed,reason:s.protectedBy});found=true;}
 }assert.ok(found,`No ${kind} protection fixture found`);
}
let footing=false;for(let seed=0;seed<60&&!footing;seed++){
 init(seed,{spread:1,roots:1,depth:12,jitter:0,delay:.08,duration:.25,tail:.1});if(sectors()[5].variant!==4)continue;
 if(!sim.fold_place(-2.75,-4.5,1.503,0,0))continue;tick(30);const before=stats().position;sim.wave_start();finish();const s=sectors()[5];assert.ok(s.protectedBy&4);assert.equal(s.variant,4);assert.deepEqual(stats().position,before);holds.push({kind:'footing',seed,reason:s.protectedBy});footing=true;
}assert.ok(footing,'Grounded support was not protected');
// Pause freezes the wave while the player simulation continues; manual step advances one tick.
init();sim.wave_start();tick(10);sim.wave_pause(0);const paused=stats();tick(120);assert.equal(stats().waveTick,paused.waveTick);assert.equal(stats().physicsSteps,paused.physicsSteps+120);sim.wave_step();assert.equal(stats().waveTick,paused.waveTick+1);assert.equal(stats().playing,false);
let movementSteps=0;for(let seed=0;seed<4;seed++){
 init(seed,{loop:1,delay:.1,duration:.4,tail:.1,interval:.25});sim.wave_start();
 for(let n=0;n<1800;n++){sim.fold_tick(1/120,[1,2,4,8,5,9,17,0][Math.floor(n/45)%8],Math.sin(n*.1)*4,Math.cos(n*.07)*2);assert.equal(sim.fold_clear(),1);assert.ok(stats().sealed&&stats().catalogValid);movementSteps++;}
}
sim.fold_tick(NaN,0,NaN,Infinity);assert.ok(stats().position.every(Number.isFinite));const before=stats().physicsSteps;sim.fold_tick(10,0,0,0);assert.equal(stats().physicsSteps-before,12);assert.equal(sim.fold_place(NaN,0,0,0,0),0);
for(const kind of [0,2]){const b=bytes(sim,kind),indices=new Uint32Array(sim.memory.buffer,sim.fold_buffer(kind+1),sim.fold_bytes(kind+1)/4);assert.ok(indices.every(i=>i<b.length/32));}
const report={passed:true,wasmBytes:binary.length,memoryBytes:sim.memory.buffer.byteLength,catalogEntries:catalog.length,previewSamples,blankSamples,stableByteChecks,coherence,holds,movementSteps,renderCadences:parity.map(p=>p.fps),checks:['Fixed catalogue geometry; no interpolation','Four-neighbour propagation with random roots and bounded visitation','Auditions exclude final selection','Global old-body cleanup at wave end, including untouched sectors','Coherence reduces changes; old geometry survives multiple cycles','FPS-independent event sequence','Body and weapon rejection retains old geometry without displacing player','Independent pause / step; fixed memory and finite inputs']};
await writeFile(new URL('../evidence/core.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
