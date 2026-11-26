import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {buildScene} from '../scene.js';

const {instance}=await WebAssembly.instantiate(await readFile(new URL('../motion.wasm',import.meta.url)),{env:{sin:Math.sin,cos:Math.cos}});
const sim=instance.exports,geometry=buildScene(sim,Array.from('EIGENGOTT',char=>({char,aspect:char==='I'?1/3:5/9})));
const data=new Float32Array(sim.memory.buffer,sim.get_buffer(),geometry.count*16);
sim.update(0,1,1,0,.65);
const rest=data.slice(),glyphIndices=[];
for(let i=0;i<geometry.count;i++) if(data[i*16+7]===1) glyphIndices.push(i);
assert.equal(glyphIndices.length,geometry.characterCount,'Exactly one stack per character');
const distance=()=>Math.max(...glyphIndices.map(i=>Math.hypot(...[0,1,2].map(k=>data[i*16+k]-rest[i*16+k]))));
let peakDistance=0,returnDistance=0;
for(let frame=1;frame<=26*60;frame++) {
  const time=frame/60;sim.update(time,1,1,0,.65);
  if(frame%30===0) assert.ok(data.every(Number.isFinite),'Every transform stays finite through the cycle');
  if(frame===16*60) peakDistance=distance();
  if(frame===26*60) returnDistance=distance();
}
assert.ok(peakDistance>2,'Peak disassembly substantially moves glyph shards');
assert.ok(returnDistance<.2,'Every glyph shard recovers to within 0.2 world units of its original anchor');
for(let frame=1;frame<=16*60;frame++) sim.update(26+frame/60,1,1,0,.65);
sim.reassemble();sim.update(0,1,1,0,.65);
assert.equal(distance(),0,'Manual reassembly resets geometry even when animation is paused');
for(let frame=1;frame<=26*60;frame++) sim.update(frame/60,1,1,1,.65);
const heldDistance=distance();
assert.ok(heldDistance<.2,'Hold mode keeps the title anchored while plates move');
const plateIndices=[];
for(let i=0;i<geometry.count;i++) if(data[i*16+7]===0) plateIndices.push(i);
const movingPlates=plateIndices.filter(i=>Math.hypot(...[0,1,2].map(k=>data[i*16+k]-rest[i*16+k]))>.1).length;
assert.ok(movingPlates>plateIndices.length*.6,'Most environment geometry drifts independently of title hold');
for(const repulsion of [0,2]) for(let frame=1;frame<=600;frame++)sim.update(26+frame/60,2,2,0,repulsion);
assert.ok(data.every(Number.isFinite),'Extreme movement and repulsion remain finite');
const report={passed:true,geometry,peakDistance,returnDistance,heldDistance,movingEnvironmentStacks:movingPlates,checks:['One stack per character','Finite transforms over full cycle','Substantial displacement','Spring recovery of every character','Reassembly while paused','Anchored title hold','Continuously moving environment','Extreme repulsion and motion']};
await writeFile(new URL('../evidence/motion-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
