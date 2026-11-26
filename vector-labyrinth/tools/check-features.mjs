import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {conceptDefaults as defaults,referenceDefaults,sanitize} from '../settings.js';
import {HatchDrift,titleStrokes} from '../hatching.js';
const root=new URL('../',import.meta.url),s=defaults();
const {instance}=await WebAssembly.instantiate(await readFile(new URL('labyrinth.wasm',root)),{env:{sin:Math.sin,cos:Math.cos}}),sim=instance.exports;
const guide=JSON.parse(await readFile(new URL('concept-guide.json',root))),master=JSON.parse(await readFile(new URL('reference-master.json',root)));
const guideData=new Uint8Array(sim.memory.buffer,sim.get_guide_buffer(),guide.width*guide.height);let pos=0;
for(let i=0;i<guide.runs.length;i+=2){guideData.fill(guide.runs[i+1],pos,pos+guide.runs[i]);pos+=guide.runs[i];}sim.set_guide_size(guide.width,guide.height);
new Float32Array(sim.memory.buffer,sim.get_master_buffer(),master.segments.length).set(master.segments);sim.set_master(master.segments.length/4,0);
const voids=new Uint8Array(sim.memory.buffer,sim.get_void_buffer(),344*192);pos=0;
for(let i=0;i<master.voidRuns.length;i+=2){voids.fill(master.voidRuns[i+1],pos,pos+master.voidRuns[i]);pos+=master.voidRuns[i];}
function generate(settings={},state=0,time=0,width=1376,height=768){
  const p={...s,...settings};
  sim.set_layout(p.layoutMode==='master'&&!p.constantGap?2:p.layoutMode==='recursive'?0:1,p.layoutInfluence,p.layoutVariation);
  sim.set_reference_fill(p.referenceFill?1:0);
  sim.set_mixer(p.mixEnabled?1:0,p.mixContour,p.mixDivision,p.mixGrowing,p.mixSidewinder,p.growingNewest,p.straightBias,p.horizontalBias,p.regionDepth,p.nestedDepth);
  sim.set_plates(p.platesEnabled?1:0,p.plateDrift,p.plateScale,p.plateShear,p.plateDepth,p.plateOverlap,p.plateCopies,p.plateRotation);
  sim.set_diagonal(p.allowDiagonal?1:0,p.diagonalAmount);
  sim.generate(width,height,p.wallWidth,p.pathGap,p.seed,p.turnProbability,p.branchProbability,state,p.constantGap?1:0,p.driftAmount,p.copyDivergence,p.breakage,time,p.segmentBudget,319,263,1076,507);
  const result=new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4).slice();assert.ok(result.every(Number.isFinite));assert.ok(result.length/4<=p.segmentBudget);return result;
}
const digest=d=>createHash('sha256').update(new Uint8Array(d.buffer)).digest('hex');
const stable=generate(),hashes=[];
for(let algo=0;algo<4;algo++){
  const options={mixEnabled:true,mixContour:0,mixDivision:0,mixGrowing:0,mixSidewinder:0};options[['mixContour','mixDivision','mixGrowing','mixSidewinder'][algo]]=1;
  const result=generate(options);assert.ok(result.length>500);hashes.push(digest(result));assert.equal(digest(generate(options)),hashes.at(-1),'Cached generator is deterministic');
}
assert.equal(new Set(hashes).size,4,'The four generators produce distinct geometry');
assert.notEqual(digest(generate({mixEnabled:true,mixContour:0,mixGrowing:1,growingNewest:0})),digest(generate({mixEnabled:true,mixContour:0,mixGrowing:1,growingNewest:1})));
assert.notEqual(digest(generate({regionDepth:2})),digest(stable));
const plateOptions={platesEnabled:true};assert.equal(digest(generate(plateOptions)),digest(stable),'Plates remain at home at state zero');
assert.notEqual(digest(generate(plateOptions,1,12)),digest(generate({},1,12)));
assert.equal(digest(generate(plateOptions,0,30)),digest(stable),'Plate recovery is exact');
let diagonalCount=0;const diagonalData=generate({allowDiagonal:true,diagonalAmount:1});
for(let i=0;i<diagonalData.length;i+=4){const dx=Math.abs(diagonalData[i+2]-diagonalData[i]),dy=Math.abs(diagonalData[i+3]-diagonalData[i+1]);assert.ok(dx<.001||dy<.001||Math.abs(dx-dy)<.002,'Only multiples of 45 degrees');if(dx>.001&&dy>.001)diagonalCount++;}
assert.ok(diagonalCount>100);
const reference=generate(referenceDefaults());assert.equal(reference.length,master.segments.length);assert.deepEqual(reference,new Float32Array(master.segments),'The stable vector master preserves every traced centerline');
assert.ok(generate({...referenceDefaults(),referenceFill:true}).length>reference.length);
for(const dims of [[390,844],[2560,1440],[8,8]])generate({mixEnabled:true,platesEnabled:true,allowDiagonal:true,constantGap:false},1,12,...dims);
const hatch=new HatchDrift(),p={...s,allowDiagonal:true,hatchFlickerGlobal:true,hatchSequence:'cycle',hatchTrigger:'title'};
assert.deepEqual(hatch.update(p,3,0),Array(9).fill(0),'Maze events do not change title-only hatches');
for(const expected of [1,2,3,0])assert.deepEqual(hatch.update(p,0,1),Array(9).fill(expected));
p.hatchFlickerLetters=true;p.hatchLetterChance=1;p.characters=[{hatchFlicker:false}];
const a=hatch.update(p,0,1);assert.equal(a[0],1);assert.equal(a[1],2,'Global and per-letter changes combine');
const saved=hatch.capture(),copy=new HatchDrift();copy.reset(saved);assert.deepEqual(copy.update(p,0,0),a,'Hatch pose survives export/import');
assert.deepEqual(copy.update({...p,allowDiagonal:false},0,0),a.map(v=>v%2));
const clamped=sanitize({...s,characters:[{flow:3,hatchFlicker:false}]});assert.equal(clamped.characters[0].flow,3);assert.equal(clamped.characters[0].hatchFlicker,false);
for(let flow=0;flow<4;flow++){
  const layout={data:new Float32Array([100,100,140,240,1,0,0,flow,0,1,0,0])},lines=titleStrokes(layout,6,[0,0],s);
  assert.ok(lines.length>0);const angle=[Math.PI/2,0,Math.PI/4,-Math.PI/4][flow],nx=-Math.sin(angle),ny=Math.cos(angle);
  const d=Math.abs((lines[8]-lines[0])*nx+(lines[9]-lines[1])*ny);assert.ok(Math.abs(d-6)<.0001,'All hatch directions have identical perpendicular pitch');
}
const report={passed:true,generatorHashes:hashes,diagonalCount,referenceSegments:reference.length/4,checks:['Four distinct seeded algorithms and weighted Growing Tree selection','Generator cache determinism','Region size bias','Stable plate anchoring and exact return','Only allowed diagonal angles','Reference centerlines preserved exactly','Optional reference pocket fill','Extreme aspect ratios and small canvases','Whole-title and per-letter hatch events combine','Hatch trigger selection and per-letter opt-out','Hatch pose persistence','Diagonal hatch gating','Identical perpendicular hatch pitch']};
await writeFile(new URL('evidence/feature-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
