import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const load=async path=>(await WebAssembly.instantiate(await readFile(new URL(path,root)),{env:{sin:Math.sin,cos:Math.cos}})).instance.exports;
const old=await load('../vector-labyrinth/labyrinth.wasm'),slim=await load('maze.wasm');
const meta=JSON.parse(await readFile(new URL('assets/title.json',root),'utf8'));
const asset=gunzipSync(await readFile(new URL('assets/title.bin.gz',root)));
assert.equal(createHash('sha256').update(asset).digest('hex'),meta.sha256);
const atlas=Buffer.alloc(meta.atlasBytes),layerBytes=512*512*2,maskBytes=512*512/8;
for(let i=0;i<meta.layers;i++){
  new Uint8Array(slim.memory.buffer,slim.get_glyph_input(),maskBytes).set(asset.subarray(i*maskBytes,(i+1)*maskBytes));
  slim.build_glyph();atlas.set(new Uint8Array(slim.memory.buffer,slim.get_buffer(),layerBytes),i*layerBytes);
}
assert.equal(createHash('sha256').update(atlas).digest('hex'),meta.atlasSha256,'WASM startup distance fields must reproduce the original font cache exactly');
const guide=JSON.parse(await readFile(new URL('../vector-labyrinth/concept-guide.json',root),'utf8'));
for(const sim of [old,slim]){
  const data=new Uint8Array(sim.memory.buffer,sim.get_guide_buffer(),guide.width*guide.height);let at=0;
  for(let i=0;i<guide.runs.length;i+=2){data.fill(guide.runs[i+1],at,at+guide.runs[i]);at+=guide.runs[i];}
  assert.equal(at,data.length);
}
old.set_guide_size(guide.width,guide.height);old.set_layout(1,1,1);
function generate(sim,w,h,seed,state,time){
  if(sim===old){sim.generate(w,h,1,16,seed,.92,.006,state,0,1,1,.65,time,80000,-100,-100,-100,-100);sim.clean_parallel_overlaps(1);}
  else sim.generate(w,h,seed,state,time);
  return new Uint8Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*16);
}
let cases=0,segments=0;
for(const [w,h] of [[390,844],[1376,768],[1920,1080],[2560,1440],[3840,2160]])
  for(const seed of [27011984,1,93,0xffffffff])for(const state of [0,.0001,.1,.3,.7,1]){
    const time=state*15+seed%9;
    const before=generate(old,w,h,seed,state,time),after=generate(slim,w,h,seed,state,time);
    assert.deepEqual(after,before,`Geometry differs at ${w}x${h}, seed ${seed}, state ${state}`);
    assert.equal(slim.get_phase_x(),old.get_phase_x());assert.equal(slim.get_phase_y(),old.get_phase_y());
    const coords=new Float32Array(after.buffer,after.byteOffset,after.byteLength/4);
    assert.ok(coords.every(Number.isFinite));segments+=after.byteLength/16;cases++;
  }
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
let fuzz=0x917fad;
for(let i=0;i<256;i++){
  fuzz=(Math.imul(fuzz,1664525)+1013904223)>>>0;
  const w=320+(fuzz%16000)/4,h=240+((fuzz>>>5)%8000)/4,state=(fuzz%10001)/10000,time=(fuzz%1000000)/13;
  const before=generate(old,w,h,fuzz,state,time),after=generate(slim,w,h,fuzz,state,time);
  assert.deepEqual(after,before,`Randomized geometry differs at seed ${fuzz}`);segments+=after.byteLength/16;cases++;
}
const timings=[];
for(const [w,h] of [[1376,768],[2560,1440],[3840,2160]]){
  const run=sim=>{const values=[];for(let i=0;i<40;i++){const start=performance.now();generate(sim,w,h,27011984,.5,7.5);if(i>=8)values.push(performance.now()-start);}return median(values);};
  const baselineMs=run(old),dosMazeMs=run(slim);timings.push({width:w,height:h,baselineMs,dosMazeMs,speedup:baselineMs/dosMazeMs});
}
for(const args of [[NaN,768,1,0,0],[1376,0,1,0,0],[1376,768,1,Infinity,0],[1376,768,1,0,NaN]]){
  slim.generate(...args);assert.equal(slim.get_count(),0);assert.equal(slim.get_overflow(),1);
}
const report={passed:true,cases,segments,parity:'byte-for-byte, including original overlap clipping order',glyphAtlasParity:'all 4,718,592 bytes match original Canvas/JS cache',compressedAssetBytes:(await readFile(new URL('assets/title.bin.gz',root))).length,wasmBytes:(await readFile(new URL('maze.wasm',root))).length,memoryBytes:slim.memory.buffer.byteLength,baselineMemoryBytes:old.memory.buffer.byteLength,timings};
await writeFile(new URL('evidence/generator-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
