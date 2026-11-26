import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {imports,readStats,PRESETS} from '../stats.js';
import {parseFixture,loadFixtures,storeFixtures} from '../fixtures.js';
const binary=await readFile(new URL('../engine.wasm',import.meta.url)),module=await WebAssembly.compile(binary);
const sim=(await WebAssembly.instantiate(module,imports())).exports;
const baseline=(await WebAssembly.instantiate(await readFile(new URL('../../engine-test/engine.wasm',import.meta.url)),imports())).instance.exports;
const data=(s,kind)=>new Uint8Array(s.memory.buffer,s.arena_buffer_ptr(kind,0),s.arena_buffer_bytes(kind,0));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const activate=s=>assert.equal(s.engine_activate(s.candidate_id()),1);
function build(seed,preset=PRESETS[0],fault=0){return sim.engine_build(seed,fault,preset.profile,preset.lights,preset.density,preset.detail);}
const phaseSamples=[],baselineSeeds=[27011984,0,1,93,94,0xffffffff];
for(const seed of baselineSeeds){
  assert.equal(baseline.engine_init(seed),0);activate(baseline);assert.equal(build(seed),0);activate(sim);
  for(let kind=0;kind<6;kind++)assert.equal(digest(data(sim,kind)),digest(data(baseline,kind)),`Small baseline diverged: seed ${seed}, buffer ${kind}`);
}
assert.equal(sim.abi_version(),2);assert.equal(sim.memory.buffer.byteLength,32*1048576);assert.throws(()=>sim.memory.grow(1),RangeError);
let seeds=0,triangles=0,movementSteps=0;
for(const preset of PRESETS){
  for(let n=0;n<12;n++){
    const seed=(Math.imul(n,0x9e3779b9)^27011984)>>>0;
    assert.equal(build(seed,preset),0,`${preset.name}, seed ${seed}`);activate(sim);const d=readStats(sim);
    assert.equal(d.components,1);assert.equal(d.unmatchedEdges,0);assert.equal(d.nonmanifoldEdges,0);assert.equal(d.intersections,0);
    assert.equal(sim.engine_player_clear(),1);assert.equal(d.gridSize,[13,25,49][preset.profile]);assert.ok(d.bvhNodes>0);
    assert.ok(d.intersectionPairs<d.triangles*d.triangles/20,'Intersection validation did not cull distant geometry');
    assert.ok(d.vertices<d.vertexCapacity&&d.indices<d.indexCapacity);assert.ok(d.bakedTexels<d.atlasSize*d.atlasSize);
    const ib=data(sim,1);assert.ok(new Uint32Array(ib.buffer,ib.byteOffset,ib.byteLength/4).every(i=>i<d.vertices));
    assert.ok(data(sim,4).every((v,i)=>i%4===3||v%17===0));
    if(n===0){
      phaseSamples.push({...preset,seed,counts:d});const hashes=[0,1,2,3,4,5].map(kind=>digest(data(sim,kind)));
      assert.equal(build(seed,preset),0);activate(sim);assert.deepEqual([0,1,2,3,4,5].map(kind=>digest(data(sim,kind))),hashes,'Repeated size fixture changed its render buffers');
    }
    seeds++;triangles+=d.triangles;
  }
}
// Dense decoration and lightmap sampling are independent workload controls.
assert.equal(build(94,{...PRESETS[1],detail:2,lights:64,density:3}),0);activate(sim);const dense=readStats(sim);
assert.ok(dense.vertices>phaseSamples[1].counts.vertices);assert.equal(dense.lights,64);
assert.ok(build(94,{...PRESETS[2],density:4})&64,'Excess atlas use must reject rather than overflow');
for(const preset of PRESETS)for(let fault=1;fault<=9;fault++)assert.notEqual(build(94,preset,fault),0,`Fault ${fault} accepted for ${preset.name}`);

// Active instances cannot be repurposed as construction scratch.
assert.equal(build(94),0);activate(sim);const before=digest(data(sim,0));assert.notEqual(sim.engine_prepare(95,0),0);assert.equal(digest(data(sim,0)),before);

// Transport copies an internal, same-module static image; stack bytes excluded.
const imageStart=sim.image_start(),imageEnd=Number(sim.__heap_base.value),copy=(await WebAssembly.instantiate(module,imports())).exports;
new Uint8Array(copy.memory.buffer).set(new Uint8Array(sim.memory.buffer,imageStart,imageEnd-imageStart),imageStart);
assert.equal(copy.engine_import_check(),1);assert.equal(readStats(copy).geometryHash,readStats(sim).geometryHash);
for(let kind=0;kind<6;kind++)assert.equal(digest(data(copy,kind)),digest(data(sim,kind)));
for(let i=0;i<120;i++){copy.engine_tick(1/120,1,0,0);sim.engine_tick(1/120,1,0,0);}
assert.deepEqual(readStats(copy).position,readStats(sim).position);

const trajectories=[];
for(const movement of [0,1])for(const fps of [30,60,120,240]){
  assert.equal(build(94,PRESETS[1]),0);activate(sim);sim.engine_profile(movement);
  for(let i=0;i<fps*2;i++)sim.engine_tick(1/fps,1,0,0);
  assert.equal(sim.engine_player_clear(),1);const d=readStats(sim);assert.equal(d.physicsSteps,240);
  trajectories.push({movement,fps,position:d.position,velocity:d.velocity});
}
for(const movement of [0,1]){
  const group=trajectories.filter(x=>x.movement===movement);for(const t of group)assert.deepEqual(t.position,group[0].position);
}
assert.ok(trajectories[4].position[1]-trajectories[0].position[1]>4,'Reference movement did not increase travel speed');
for(const preset of PRESETS)for(const movement of [0,1])for(const bits of [1,2,4,8,5,9,6,10]){
  assert.equal(build(94,preset),0);activate(sim);sim.engine_profile(movement);
  for(let i=0;i<360;i++){
    sim.engine_tick(1/120,bits|(i===120?16:0),0,0);movementSteps++;
    if(i%12===0)assert.equal(sim.engine_player_clear(),1,`Penetration: ${preset.name}, movement ${movement}, bits ${bits}, step ${i}`);
  }
}
assert.equal(build(94,PRESETS[2]),0);activate(sim);const d=readStats(sim);
assert.ok(sim.engine_sweep_test(...d.position,0,0,1000)<1);assert.ok(sim.engine_sweep_test(...d.position,0,0,-1000)<1);assert.ok(sim.engine_sweep_test(...d.position,1000,0,0)<1);
sim.engine_camera_mode(1);const physical=readStats(sim).position;sim.engine_tick(.1,1|16,100,50);assert.deepEqual(readStats(sim).position,physical);sim.engine_camera_mode(2);sim.engine_tick(.1,1,0,0);assert.equal(sim.engine_player_clear(),1);sim.engine_camera_mode(0);
sim.engine_tick(NaN,0,NaN,Infinity);assert.ok(readStats(sim).position.every(Number.isFinite));

const fixture={version:1,name:'Large test',seed:94,settings:{...PRESETS[2],name:undefined},movement:1};delete fixture.settings.name;
const memoryStorage=new Map(),storage={getItem:k=>memoryStorage.get(k),setItem:(k,v)=>memoryStorage.set(k,v)};
storeFixtures([parseFixture(fixture)],storage);assert.deepEqual(loadFixtures(storage),[fixture]);
assert.throws(()=>parseFixture({...fixture,seed:-1}));assert.throws(()=>parseFixture({...fixture,settings:{...fixture.settings,lights:1000}}));
const report={passed:true,wasmBytes:binary.length,wasmMemoryBytes:sim.memory.buffer.byteLength,imageBytes:imageEnd-imageStart,baselineSeeds,validSeeds:seeds,structuralTrianglesChecked:triangles,rejectedFaults:27,movementSteps,trajectories,phaseSamples,
  checks:['Byte-identical small baseline GPU buffers across six seeds','Three deterministic size fixtures and bounded light/detail/density controls','Sealed connected geometry and spatially culled validation','27 invalid candidates and atlas capacity rejection','Active factory mutation rejected','Same-build isolated image transport and simulation parity','Both movement profiles independent of render FPS','Body/weapon sweeps, jump/movement penetration checks','Free/top-down cameras preserve the physical player','Strict saved-fixture schema and storage roundtrip']};
await writeFile(new URL('../evidence/core-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,phaseSamples:undefined,trajectories:undefined},null,2));
