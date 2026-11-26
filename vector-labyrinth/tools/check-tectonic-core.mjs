import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tectonicDefaults as defaults,referenceDefaults,sanitize} from '../settings.js';
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
const homeSettings={...defaults(),preventOverlap:false,fillEverywhere:false};
const original=generate(homeSettings);sim.fill_dead_zones();
const filled=new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4).slice();
assert.deepEqual(filled.subarray(0,original.length),original,'Fill preserves all original vector endpoints');assert.ok(filled.length>original.length,'Uncovered dead zones receive extra lines');
sim.clean_parallel_overlaps(homeSettings.wallWidth);sim.capture_home();
const home=new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4).slice();
sim.animate_home(1,16,12345,1,2.4,.55,.35,.9);
const moving=new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4).slice();assert.notEqual(digest(moving),digest(home));assert.ok(sim.get_plate_count()>8);
const frames=new Float32Array(sim.memory.buffer,sim.get_plate_frames(),sim.get_plate_count()*12),owners=new Uint32Array(sim.memory.buffer,sim.get_line_owners(),sim.get_count());
const ids=new Set([0]);for(let j=0;j<frames.length;j+=12){assert.ok(frames[j+2]>0&&frames[j+3]>0);ids.add(frames[j+9]);}
assert.ok([...owners].every(id=>ids.has(id)),'Every moving line has a valid plate owner');
for(let j=0;j<moving.length;j+=4)assert.ok(Math.abs(moving[j]-moving[j+2])<.001||Math.abs(moving[j+1]-moving[j+3])<.001,'Plate quarter turns preserve orthogonal walls');
sim.animate_home(0,30,999999,99999,2.4,.55,.35,.9);assert.equal(sim.get_plate_count(),0);assert.deepEqual(new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4),home,'Recovery is exact even with new cycle and hierarchy seeds');
const {Hierarchy}=await import('../hierarchy.js'),hierarchy=new Hierarchy(),settings={...defaults(),characters:[{priority:23}]};
const first=hierarchy.update(10,settings,.5,0,0),second=hierarchy.update(40,settings,.5,0,0);assert.notEqual(first.orderSeed,second.orderSeed,'Each cycle can shuffle priorities');
const ordered=hierarchy.update(0,settings,0,0,0);assert.equal(ordered.order.at(-1),0,'Explicit high priority is restored at home');
const disturbed=hierarchy.update(10,{...settings,hierarchyChance:1},.5,1,0);assert.notEqual(disturbed.state,.5);assert.ok(disturbed.orderSeed>0);
const pose=hierarchy.capture(),clone=new Hierarchy();clone.reset(pose);assert.deepEqual(clone.update(10,settings,.5,0,0),hierarchy.update(10,settings,.5,0,0),'Hierarchy and corruption kick survive pose restore');
assert.equal(hierarchy.update(30,settings,0,1,1).state,0);assert.equal(hierarchy.update(16,settings,1,1,1).state,1);
const report={passed:true,originalSegments:original.length/4,filledSegments:filled.length/4,cleanSegments:home.length/4,movingSegments:moving.length/4,checks:['Reference walls preserved by dead-zone filling','Additional vector lines in previously unfilled spaces','Finite plate bounds and valid ownership IDs','Allowed wall angles after plate transforms','Exact vector recovery with changed animation/order seeds','Cycle priority randomization','Per-character base hierarchy','Hard-flicker random corruption / priority state','Hierarchy pose persistence','Exact stable and chaos endpoints']};
await writeFile(new URL('evidence/tectonic-core-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
