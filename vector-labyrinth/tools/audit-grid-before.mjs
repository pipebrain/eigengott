import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {defaults,referenceDefaults,sanitize} from '../settings.js';
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
const pitch=s.wallWidth+s.pathGap,width=1376,height=768;
sim.set_layout(2,s.layoutInfluence,s.layoutVariation);sim.set_reference_fill(1);
sim.generate(width,height,s.wallWidth,s.pathGap,s.seed,s.turnProbability,s.branchProbability,0,1,s.driftAmount,s.copyDivergence,s.breakage,0,s.segmentBudget,319,263,1076,507);
sim.fill_dead_zones();sim.snap_grid(0,0);sim.clean_parallel_overlaps(s.wallWidth);sim.snap_grid(0,0);
const data=new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4),nx=Math.ceil(width/pitch),ny=Math.ceil(height/pitch),h=new Set(),v=new Set();
for(let i=0;i<data.length;i+=4){let [x1,y1,x2,y2]=data.subarray(i,i+4);x1=Math.round(x1/pitch);x2=Math.round(x2/pitch);y1=Math.round(y1/pitch);y2=Math.round(y2/pitch);if(y1===y2)for(let x=Math.min(x1,x2);x<Math.max(x1,x2);x++)h.add(x+','+y1);if(x1===x2)for(let y=Math.min(y1,y2);y<Math.max(y1,y2);y++)v.add(x1+','+y);}
let cells=0,violations=0;for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){cells++;if(!(v.has(x+','+y)&&v.has((x+1)+','+y))&&!(h.has(x+','+y)&&h.has(x+','+(y+1))))violations++;}
const report={pitch,wall:s.wallWidth,requestedGap:s.pathGap,cellsChecked:cells,cellsWithoutAnExactWidthPath:violations};await writeFile(new URL('evidence/grid-before-audit.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
