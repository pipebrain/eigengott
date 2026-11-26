import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {conceptDefaults as defaults,originalDefaults,sanitize} from '../settings.js';
import {stateAt,Flicker} from '../animation.js';
const root=new URL('../',import.meta.url),s=defaults();
assert.equal(stateAt(0,s),0);assert.equal(stateAt(3.9,s),0);assert.equal(stateAt(16,s),1);assert.equal(stateAt(17.9,s),1);assert.equal(stateAt(30,s),0);
assert.ok(stateAt(10,s)>.4&&stateAt(10,s)<.6);
assert.equal(stateAt(999,{...s,autoState:false,manualState:.37}),.37);
const clamped=sanitize({period:6,stableHold:60,chaosHold:60,wallWidth:-1,pathGap:NaN,title:'A'.repeat(100),characters:[{rotation:Infinity,x:999999}],font:'custom'});
assert.equal(clamped.wallWidth,1);assert.equal(clamped.pathGap,s.pathGap);assert.equal(clamped.title.length,24);assert.equal(clamped.font,'gothic');assert.ok(clamped.stableHold+clamped.chaosHold<=5.5);
const flicker=new Flicker(42);let events=0,dark=0;
for(let frame=0;frame<600;frame++){const r=flicker.update(frame/60,true,2,45,.6,1,0,.5);events+=r.events;if(r.opacity===0)dark++;}
assert.ok(events>10&&dark>0);assert.equal(flicker.update(11,false,2,45,.6,1,1,.5).opacity,1);
const {instance}=await WebAssembly.instantiate(await readFile(new URL('labyrinth.wasm',root)),{env:{sin:Math.sin,cos:Math.cos}}),sim=instance.exports;
const guide=JSON.parse(await readFile(new URL('concept-guide.json',root))),guideData=new Uint8Array(sim.memory.buffer,sim.get_guide_buffer(),guide.width*guide.height);let guideAt=0;
for(let i=0;i<guide.runs.length;i+=2){guideData.fill(guide.runs[i+1],guideAt,guideAt+guide.runs[i]);guideAt+=guide.runs[i];}assert.equal(guideAt,guideData.length);sim.set_guide_size(guide.width,guide.height);
const generate=(state,constant=true,seed=s.seed,time=12,settings=s)=>{
  sim.set_layout(settings.layoutMode==='concept'?1:0,settings.layoutInfluence,settings.layoutVariation);
  sim.generate(1376,768,settings.wallWidth,settings.pathGap,seed,settings.turnProbability,settings.branchProbability,state,constant?1:0,settings.driftAmount,settings.copyDivergence,settings.breakage,time,settings.segmentBudget,321,262,1055,506);
  return new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4).slice();
};
const digest=data=>createHash('sha256').update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
const baseline=JSON.parse(await readFile(new URL('evidence/original-baseline.json',root)));
assert.equal(digest(generate(0,true,originalDefaults().seed,0,originalDefaults())),baseline.segmentHash,'Original study geometry is preserved exactly');
const stable=generate(0),chaos=generate(1),recovery=generate(0,true,s.seed,30);
assert.equal(digest(stable),digest(recovery),'Stable pose returns exactly for the same seed');
assert.notEqual(digest(stable),digest(chaos),'Chaos changes the wall layout');
assert.notEqual(digest(stable),digest(generate(0,true,s.seed+1)),'Redraw seeds produce a different maze');
let segmentsChecked=0;
for(const state of [0,.2,.5,1])for(const constant of [true,false]){
  const data=generate(state,constant),px=sim.get_phase_x(),py=sim.get_phase_y(),pitch=s.wallWidth+s.pathGap;
  assert.ok(data.every(Number.isFinite));
  for(let i=0;i<data.length;i+=4){
    const [x1,y1,x2,y2]=data.subarray(i,i+4);assert.ok(x1===x2||y1===y2,'Every wall is horizontal or vertical');
    if(constant){const value=x1===x2?(x1-px)/pitch:(y1-py)/pitch;assert.ok(Math.abs(value-Math.round(value))<.0001,'Constant-gap walls share a lattice');}
    segmentsChecked++;
  }
}
sim.generate(1376,768,2.2,3.8,s.seed,.8,.4,1,1,3,4,1,99,100,321,262,1055,506);assert.equal(sim.get_count(),100);assert.equal(sim.get_overflow(),1);
const protectedFiles=JSON.parse(await readFile(new URL('evidence/protected-files.json',root)));
for(const [path,before]of Object.entries(protectedFiles))assert.equal(createHash('sha256').update(await readFile(new URL('../'+path,root))).digest('hex'),before,`Existing file changed: ${path}`);
const report={passed:true,protectedFilesUnchanged:Object.keys(protectedFiles).length,segmentsChecked,stableSegments:stable.length/4,chaosSegments:chaos.length/4,checks:['30-second cycle and endpoint holds','Manual state','Preset validation','Hard flicker scheduling','Exact original-study geometry restoration','Concept composition guide','Exact seeded recovery','Seeded redraw variation','All segments axis-aligned','Constant-gap lattice','Segment budget','Existing application files unchanged']};
await writeFile(new URL('evidence/core-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
