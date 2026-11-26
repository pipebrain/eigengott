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
const {CollisionEdges}=await import('../collisions.js');
const configurations=[{width:1376,height:768,wallWidth:2.8,pathGap:3.2,gridOriginX:0,gridOriginY:0},{width:390,height:844,wallWidth:2.8,pathGap:3.2,gridOriginX:2.5,gridOriginY:-1.5},{width:1023,height:767,wallWidth:2.3,pathGap:4.6,gridOriginX:-3.3,gridOriginY:2.2},{width:1920,height:1080,wallWidth:3,pathGap:3,gridOriginX:1.5,gridOriginY:1.5,segmentBudget:5000}];
const totals={cases:0,cells:0,coordinates:0,missingPairs:0,duplicateWalls:0,offGrid:0,coarsenedCases:0};
const reports=[];
function inspect(p){
  const data=new Float32Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*4),cols=sim.get_grid_columns(),rows=sim.get_grid_rows(),sx=sim.get_grid_start_x(),sy=sim.get_grid_start_y(),pitch=Math.fround(Math.fround(p.wallWidth)+Math.fround(p.pathGap)),ox=Math.fround(p.gridOriginX),oy=Math.fround(p.gridOriginY);
  const horizontal=new Uint8Array((rows+1)*cols),vertical=new Uint8Array(rows*(cols+1));let missingPairs=0,duplicates=0,offGrid=0;
  for(let i=0;i<data.length;i+=4){
    const nodes=[];for(let k=0;k<4;k++){const origin=k%2?oy:ox,index=Math.round((data[i+k]-origin)/pitch),canonical=Math.fround(Math.fround(index*pitch)+origin);if(data[i+k]!==canonical)offGrid++;nodes.push(index);}
    const [x1,y1,x2,y2]=nodes;assert.ok(x1===x2||y1===y2,'Exact-grid walls are orthogonal');
    if(y1===y2)for(let x=Math.min(x1,x2);x<Math.max(x1,x2);x++){const at=(y1-sy)*cols+x-sx;if(horizontal[at])duplicates++;horizontal[at]=1;}
    else for(let y=Math.min(y1,y2);y<Math.max(y1,y2);y++){const at=(y-sy)*(cols+1)+x1-sx;if(vertical[at])duplicates++;vertical[at]=1;}
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const pairV=vertical[y*(cols+1)+x]&&vertical[y*(cols+1)+x+1],pairH=horizontal[y*cols+x]&&horizontal[(y+1)*cols+x];
    if(!pairV&&!pairH)missingPairs++;
  }
  assert.equal(offGrid,0,'Coordinates must equal the canonical float32 grid formula exactly');assert.equal(duplicates,0,'No duplicated grid edges');assert.equal(missingPairs,0,'Every cell must retain a complete exact-width wall pair');
  assert.ok(Math.abs(pitch-Math.fround(p.wallWidth)-Math.fround(p.pathGap))<.000001);
  totals.cases++;totals.cells+=cols*rows;totals.coordinates+=data.length;totals.missingPairs+=missingPairs;totals.duplicateWalls+=duplicates;totals.offGrid+=offGrid;if(sim.get_grid_coarsening()>1)totals.coarsenedCases++;
  return {columns:cols,rows,cells:cols*rows,segments:data.length/4,coarsening:sim.get_grid_coarsening(),missingPairs,offGrid};
}
for(const config of configurations){
  const p={...defaults(),...config},width=p.width,height=p.height;
  sim.set_layout(2,p.layoutInfluence,p.layoutVariation);sim.set_reference_fill(1);sim.set_mixer(0,1,0,0,0,.85,.75,.5,5,16);sim.set_plates(1,p.plateDrift,p.plateScale,p.plateShear,p.plateDepth,p.plateOverlap,p.plateCopies,p.plateRotation);
  sim.generate(width,height,p.wallWidth,p.pathGap,p.seed,p.turnProbability,p.branchProbability,0,1,1,1,.65,0,p.segmentBudget,width*.23,height*.34,width*.78,height*.66);sim.fill_dead_zones();sim.snap_grid(p.gridOriginX,p.gridOriginY);sim.clean_parallel_overlaps(p.wallWidth);sim.snap_grid(p.gridOriginX,p.gridOriginY);sim.capture_home();
  const collisions=new CollisionEdges();let startHash;
  for(const [state,time]of [[0,0],[.2,6],[.55,10],[1,16],[1,18],[.4,24],[0,30]]){
    sim.animate_home(state,time,12345,999,p.plateDrift,p.plateScale,p.plateShear,p.plateRotation);sim.redraw_profiles(state,time,p.perspectiveDepth,width*.5,height*.5,p.fillColumns,p.fillRows,p.fillHatchRate,p.fillLineSpeed,p.fillJog,1,1);sim.snap_grid(p.gridOriginX,p.gridOriginY);
    const frames=new Float32Array(sim.memory.buffer,sim.get_plate_frames(),sim.get_plate_count()*12),quads=new Float32Array(sim.memory.buffer,sim.get_plate_quads(),sim.get_plate_count()*8),decision=collisions.update(time,p,state,frames,quads);
    new Float32Array(sim.memory.buffer,sim.get_edge_revisions(),decision.revisions.length).set(decision.revisions);new Float32Array(sim.memory.buffer,sim.get_grid_priorities(),decision.priorities.length).set(decision.priorities);
    if(frames.length)sim.redraw_edges(p.edgeBand);sim.snap_grid(p.gridOriginX,p.gridOriginY);sim.enforce_exact_grid(p.gridOriginX,p.gridOriginY,1,p.edgeBand);
    const result=inspect(p);reports.push({...config,state,time,...result});
    const hash=createHash('sha256').update(new Uint8Array(sim.memory.buffer,sim.get_buffer(),sim.get_count()*16)).digest('hex');if(time===0)startHash=hash;if(time===30)assert.equal(hash,startHash,'Exact-grid recovery is deterministic');
  }
}
const report={passed:true,defaultSpacing:{wallWidth:2.8,pathGap:3.2,pitch:6},...totals,checks:['Exact float32 lattice coordinates, not rounded-endpoint proximity','Every grid cell has parallel walls one pitch apart','No duplicate unit walls','Perspective/fill contact and edge redraw preserve spacing','Nonzero and fractional grid origins','Custom fractional wall/gap values','Portrait and landscape sizes','Budget fallback preserves complete wall pairs','Exact full-cycle recovery'],cases:reports};
await writeFile(new URL('evidence/exact-grid-verification.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...totals,passed:true,defaultSpacing:report.defaultSpacing},null,2));
