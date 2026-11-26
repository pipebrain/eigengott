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
const s0={...defaults(),constantGap:false};generate(s0);sim.fill_dead_zones();sim.capture_home();
const vp=[688,384];
const profile=(time,grid=false)=>{
  sim.animate_home(1,time,12345,0,1.6,.3,.2,.9);
  sim.redraw_profiles(1,time,5,...vp,6,4,.35,.4,.35,1,1);
  if(grid)sim.snap_grid(2,3);
  return {lines:new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4).slice(),owners:new Uint32Array(sim.memory.buffer,sim.get_line_owners(),sim.get_count()).slice(),frames:new Float32Array(sim.memory.buffer,sim.get_plate_frames(),sim.get_plate_count()*12).slice(),quads:new Float32Array(sim.memory.buffer,sim.get_plate_quads(),sim.get_plate_count()*8).slice()};
};
const p=profile(12);assert.ok(sim.get_perspective_count()>5);assert.equal(sim.get_fill_plane_count(),24);assert.ok(p.lines.every(Number.isFinite));
const cross=(a,b,c,d)=>a*d-b*c;
for(let i=0;i<p.frames.length/12;i++)if(p.frames[i*12+10]===2){
 const q=p.quads.subarray(i*8,i*8+8);
 assert.ok(Math.abs(cross(q[6]-q[0],q[7]-q[1],vp[0]-q[0],vp[1]-q[1]))<.15,'First depth edge aims at the fixed vanishing point');
 assert.ok(Math.abs(cross(q[4]-q[2],q[5]-q[3],vp[0]-q[2],vp[1]-q[3]))<.15,'Second depth edge aims at the same point');
}
const moved=profile(13);assert.notDeepEqual(moved.lines,p.lines,'Perspective and fill geometry are redrawn during motion');
const grid=profile(12,true),pitch=s0.wallWidth+s0.pathGap;
for(let i=0;i<grid.lines.length;i++){const origin=i%2?3:2,value=(grid.lines[i]-origin)/pitch;assert.ok(Math.abs(value-Math.round(value))<.001,'Every endpoint shares the defined grid');}
const {CollisionEdges}=await import('../collisions.js');
const frames=new Float32Array([50,50,100,100,1,1,0,0,0,1,1,1,100,50,100,100,1,1,0,0,0,2,1,2]);
const quads=new Float32Array([0,0,100,0,100,100,0,100,50,0,150,0,150,100,50,100]);
const settings={...defaults(),collisionHold:.5,collisionRetain:0};const controller=new CollisionEdges();
const first=controller.update(1,settings,1,frames,quads);assert.equal(first.collisions,1);assert.equal(first.decisions,1);assert.equal(first.redraws,2);
const held=controller.update(1.1,settings,1,frames,quads);assert.equal(held.decisions,0);assert.deepEqual(held.priorities,first.priorities);
const expired=controller.update(1.6,settings,1,frames,quads);assert.equal(expired.decisions,1);assert.notDeepEqual(expired.priorities,first.priorities,'Ongoing contact cannot retain permanent priority');
const clone=new CollisionEdges();clone.reset(controller.capture());assert.deepEqual(clone.update(1.6,settings,1,frames,quads).priorities,expired.priorities,'Collision pose round-trips');
const raw=profile(12),revisions=new Float32Array(raw.frames.length/12*4).fill(1);new Float32Array(sim.memory.buffer,sim.get_edge_revisions(),revisions.length).set(revisions);sim.redraw_edges(3);const edgeLines=new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4).slice();assert.notDeepEqual(edgeLines,raw.lines,'Collision revisions redraw actual vector endpoints');
const homeHash=()=>createHash('sha256').update(new Uint8Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*16)).digest('hex');
sim.animate_home(0,0,1,0,2,.5,.3,.9);const home=homeHash();sim.animate_home(0,30,999,999,2,.5,.3,.9);assert.equal(homeHash(),home,'Exact home recovery remains intact');
const report={passed:true,perspectivePlanes:p.frames.filter((v,i)=>i%12===10&&v===2).length,fillPlanes:24,segments:p.lines.length/4,checks:['True common vanishing point before quantization','Both perspective and fill profiles generated','Geometry redrawn as layers move','All endpoint coordinates share a defined grid','Collision starts an edge decision','Priority held only for bounded contact duration','Actual line endpoint redraw on collision','Collision-state persistence','Exact home recovery']};await writeFile(new URL('evidence/profiles-core-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
