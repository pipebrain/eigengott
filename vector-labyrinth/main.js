import {makeUI} from './ui.js';
import {makeRenderer} from './renderer.js';
import {buildGlyphCache,layoutGlyphs,setReferenceGlyphs} from './glyphs.js';
import {Flicker,stateAt,hash} from './animation.js';
import {loadCompositionGuide} from './composition.js';
import {HatchDrift} from './hatching.js';
import {Hierarchy} from './hierarchy.js';
import {CollisionEdges} from './collisions.js';

const canvas=document.querySelector('#scene'),status=document.querySelector('#status');
let renderer,sim,cache,running=true,paused=false,time=0,redrawIndex=0,randomSeed=1,meshDirty=true,fontDirty=true;
let fontBuilds=0,generationCount=0,lastGeometry=-Infinity,lastWidth=0,lastHeight=0,fontTimer;
let phase=[0,0],lastState=-1,frameRequests=0,ready=false,homeDirty=true,lastOrderSeed=-1,homeBuilds=0;
const mazeFlicker=new Flicker(0x9e3779b9),textFlicker=new Flicker(0x85ebca6b),errors=[];
const hatching=new HatchDrift();
const hierarchy=new Hierarchy();
const collisions=new CollisionEdges();let collisionStats={collisions:0,decisions:0,redraws:0};
const snapshot={ready:false,renderer:'WebGPU',geometry:'2D vector strokes',motion:'WebAssembly',lighting:false,shadows:false,errors};
Object.defineProperty(window,'__VECTOR_STUDY',{value:snapshot,writable:false});
function fail(message){running=false;errors.push(message);console.error(message);status.replaceChildren();const p=document.createElement('p');p.textContent=message;status.append(p);status.hidden=false;}
function resetFlicker(pose,orderPose,collisionPose){mazeFlicker.seed=hash(ui.settings.seed^0x9e3779b9);textFlicker.seed=hash(ui.settings.seed^0x85ebca6b);mazeFlicker.reset();textFlicker.reset();hatching.reset(pose);hierarchy.reset(orderPose);collisions.reset(collisionPose);}
function regenerate(count=1){redrawIndex+=count;randomSeed=crypto.getRandomValues(new Uint32Array(1))[0];meshDirty=true;if(!ui.settings.exactReturn)homeDirty=true;}
function actualSeed(){return ui.settings.lockSeed?(redrawIndex===0?ui.settings.seed:hash(ui.settings.seed^Math.imul(redrawIndex,0x9e3779b9))):randomSeed;}
function rebuildFont(){
  if(!renderer)return;
  clearTimeout(fontTimer);
  cache=buildGlyphCache(ui.settings.title,ui.settings.font);renderer.setFont(cache);fontBuilds++;fontDirty=false;meshDirty=true;homeDirty=true;
}
function syncPause(){document.querySelector('#pause').textContent=paused?'Resume':'Pause';}
function stablePose(){time=0;paused=true;redrawIndex=0;randomSeed=ui.settings.seed;ui.set({autoState:false,manualState:0});meshDirty=true;resetFlicker();syncPause();}
const ui=makeUI(key=>{
  meshDirty=true;
  if(key!=='regenerate')homeDirty=true;
  if(key==='titleHatch'||key==='characterFlow'||key==='title')hatching.reset();
  if(key==='regenerate'){regenerate();return;}
  if(key==='font'||key==='title'){fontDirty=true;clearTimeout(fontTimer);fontTimer=setTimeout(()=>{try{rebuildFont();}catch(e){fail(e.message);}},120);}
  if(key==='seed'||key==='lockSeed'){redrawIndex=0;randomSeed=ui.settings.seed;resetFlicker();}
  if(key==='preset'||key==='reset'){
    const pose=ui.takeRuntime();
    time=Number.isFinite(pose?.time)?Math.max(0,Math.min(3600,pose.time)):0;
    paused=pose?.paused===true;
    redrawIndex=Number.isFinite(pose?.redrawIndex)?Math.max(0,Math.min(1000000,Math.round(pose.redrawIndex))):0;
    randomSeed=Number.isFinite(pose?.randomSeed)?pose.randomSeed>>>0:ui.settings.seed;
    resetFlicker(pose?.hatching,pose?.hierarchy,pose?.collisions);syncPause();fontDirty=true;
    try{rebuildFont();}catch(e){fail(e.message);}
  }
});
ui.setRuntimeProvider(()=>({time,paused,redrawIndex,randomSeed,hatching:hatching.capture(),hierarchy:hierarchy.capture(),collisions:collisions.capture()}));
document.querySelector('#pause').onclick=()=>{paused=!paused;syncPause();};
document.querySelector('#step').onclick=()=>{paused=true;time+=1/60*ui.settings.timeScale;meshDirty=true;syncPause();};
document.querySelector('#home').onclick=stablePose;
document.addEventListener('keydown',event=>{
  const tag=event.target.tagName,type=event.target.type;
  if(event.key==='Escape'){document.querySelector('#controls').hidden=true;return;}
  const editing=/SELECT|TEXTAREA/.test(tag)||(tag==='INPUT'&&!['range','checkbox','color'].includes(type));
  if(event.repeat||editing)return;
  const key=event.key.toLowerCase();
  if(key==='h'||key==='`'){event.preventDefault();ui.toggle();}
  if(key===' '&&type!=='checkbox'){event.preventDefault();paused=!paused;syncPause();}
  if(key==='r'){event.preventDefault();stablePose();}
  if(key==='f'){
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    else document.documentElement.requestFullscreen?.().catch(()=>{});
  }
});
canvas.addEventListener('touchstart',event=>{if(event.touches.length===3){event.preventDefault();ui.toggle();}},{passive:false});

async function init(){
  snapshot.bootPhase='loading WebAssembly';
  const response=await fetch('labyrinth.wasm');if(!response.ok)throw new Error('Could not load labyrinth.wasm. Serve this folder over localhost or HTTPS.');
  const [gpu,wasm]=await Promise.all([makeRenderer(canvas,fail,stage=>snapshot.bootPhase=stage),WebAssembly.instantiate(await response.arrayBuffer(),{env:{sin:Math.sin,cos:Math.cos}})]);
  snapshot.bootPhase='restoring browser settings';
  await ui.ready;
  renderer=gpu;sim=wasm.instance.exports;randomSeed=ui.settings.seed;
  snapshot.bootPhase='loading vector reference';
  const master=await loadCompositionGuide(sim);setReferenceGlyphs(master.glyphs);
  const params=new URLSearchParams(location.search);
  paused=params.has('paused');time=Math.max(0,Math.min(3600,+params.get('time')||0));
  if(params.has('state'))ui.set({autoState:false,manualState:Math.max(0,Math.min(1,+params.get('state')||0))},false);
  if(params.get('flicker')==='off')ui.set({mazeFlicker:false,textFlicker:false},false);
  if(params.has('seed'))ui.set({seed:+params.get('seed')},false);
  snapshot.bootPhase='building glyph masks';resetFlicker();syncPause();rebuildFont();snapshot.bootPhase='rendering';
  let last=performance.now(),fpsLast=last,frames=0,fps=0,lastStateReadout=0;
  document.addEventListener('visibilitychange',()=>{last=performance.now();});
  function frame(now){
    if(!running)return;
    try{
      const dt=Math.min(.1,(now-last)/1000);last=now;
      const s=ui.settings;
      const useGrid=s.tectonicMotion&&s.constantGap;
      if(!paused&&!document.hidden)time+=dt*s.timeScale;
      const resized=renderer.resize(s),[width,height]=renderer.viewport(),baseState=stateAt(time,s);
      const maze=mazeFlicker.update(time,s.mazeFlicker,s.mazeHardRate,s.mazeHardDuration,s.mazeJitter,s.mazeHardAmount,s.mazePulseAmount,s.mazePulseRate);
      const text=textFlicker.update(time,s.textFlicker,s.textHardRate,s.textHardDuration,s.textJitter,s.textHardAmount,s.textPulseAmount,s.textPulseRate);
      const ordering=hierarchy.update(time,s,baseState,maze.events,text.events),state=ordering.state;
      if(ordering.orderSeed!==lastOrderSeed){meshDirty=true;lastOrderSeed=ordering.orderSeed;}
      if(s.redrawOnFlicker&&(maze.events+text.events)>0)regenerate(maze.events+text.events);
      const mazeAlpha=s.mazeVisible?s.mazeOpacity*maze.opacity:0,textAlpha=s.textVisible?s.textOpacity*text.opacity:0;
      if(resized||width!==lastWidth||height!==lastHeight){meshDirty=true;homeDirty=true;lastWidth=width;lastHeight=height;}
      const paintSettings=s.tectonicMotion&&s.exactReturn&&baseState<.000001?{...s,hatchFlickerGlobal:false,hatchFlickerLetters:false}:s;
      const hatchDirections=hatching.update(paintSettings,maze.events,text.events);
      const layout=layoutGlyphs(cache,s,width,height,state,time,hatchDirections);
      layout.order=ordering.order;
      const moving=state>.00001||Math.abs(state-lastState)>.0001;
      if(meshDirty||(moving&&now-lastGeometry>=1000/s.geometryHz)){
        sim.set_layout(s.layoutMode==='master'&&(!s.constantGap||s.tectonicMotion)?2:s.layoutMode==='recursive'?0:1,s.layoutInfluence,s.layoutVariation);
        sim.set_reference_fill(s.referenceFill?1:0);
        sim.set_reference_title_fill(!s.textVisible?1:0);
        sim.set_mixer(s.mixEnabled?1:0,s.mixContour,s.mixDivision,s.mixGrowing,s.mixSidewinder,s.growingNewest,s.straightBias,s.horizontalBias,s.regionDepth,s.nestedDepth);
        sim.set_plates(s.platesEnabled?1:0,s.plateDrift,s.plateScale,s.plateShear,s.plateDepth,s.plateOverlap,s.tectonicMotion?s.plateCopies*s.copyDivergence:s.plateCopies,s.plateRotation);
        sim.set_diagonal(s.allowDiagonal?1:0,s.diagonalAmount);
        if(!s.tectonicMotion||homeDirty){
          const homeLayout=s.tectonicMotion?layoutGlyphs(cache,s,width,height,0,0):layout;
          const zone=s.titleGuide&&s.textVisible&&cache.glyphs.length?homeLayout.box:[-100,-100,-100,-100];
          sim.generate(width,height,s.wallWidth,s.pathGap,s.tectonicMotion&&s.exactReturn?s.seed:actualSeed(),s.turnProbability,s.branchProbability,s.tectonicMotion?0:state,s.constantGap?1:0,s.driftAmount,s.copyDivergence,s.breakage,s.tectonicMotion?0:time,s.segmentBudget,...zone);
          if(s.fillEverywhere)sim.fill_dead_zones();
          if(useGrid)sim.snap_grid(s.gridOriginX,s.gridOriginY);
          if(s.preventOverlap)sim.clean_parallel_overlaps(s.wallWidth);
          if(useGrid)sim.snap_grid(s.gridOriginX,s.gridOriginY);
          if(s.tectonicMotion){sim.capture_home();homeBuilds++;homeDirty=false;}
        }
        if(s.tectonicMotion)sim.animate_home(s.platesEnabled?state:0,time,hash(s.seed^Math.imul(ordering.cycle+1,0x73a19)),ordering.orderSeed,s.plateDrift*s.driftAmount,s.plateScale,s.plateShear,s.plateRotation);
        if(s.tectonicMotion&&s.lineProfiles)sim.redraw_profiles(s.platesEnabled?state:0,time,s.perspectiveDepth,width*s.vanishingX/100,height*s.vanishingY/100,s.fillColumns,s.fillRows,s.fillHatchRate,s.fillLineSpeed,s.fillJog,s.perspectiveVisible?1:0,s.fillPlanesVisible?1:0);
        if(useGrid)sim.snap_grid(s.gridOriginX,s.gridOriginY);
        const plates=s.tectonicMotion?new Float32Array(sim.memory.buffer,sim.get_plate_frames(),sim.get_plate_count()*12):new Float32Array();
        const quads=s.tectonicMotion?new Float32Array(sim.memory.buffer,sim.get_plate_quads(),sim.get_plate_count()*8):new Float32Array();
        collisionStats=collisions.update(time,s,state,plates,quads);
        if(s.tectonicMotion&&s.collisionEdges&&s.collisionRedraw&&plates.length){new Float32Array(sim.memory.buffer,sim.get_edge_revisions(),collisionStats.revisions.length).set(collisionStats.revisions);sim.redraw_edges(s.edgeBand);if(useGrid)sim.snap_grid(s.gridOriginX,s.gridOriginY);}
        if(useGrid){if(plates.length)new Float32Array(sim.memory.buffer,sim.get_grid_priorities(),collisionStats.priorities.length).set(collisionStats.priorities);sim.enforce_exact_grid(s.gridOriginX,s.gridOriginY,s.preventOverlap?1:0,s.collisionEdges&&s.collisionRedraw?s.edgeBand:0);}
        const count=sim.get_count(),data=new Float32Array(sim.memory.buffer,sim.get_buffer(),count*4);
        const owners=s.tectonicMotion?new Uint32Array(sim.memory.buffer,sim.get_line_owners(),count):null;
        renderer.uploadSegments(data,owners,plates,quads,collisionStats.priorities);phase=useGrid?[s.gridOriginX,s.gridOriginY]:[sim.get_phase_x(),sim.get_phase_y()];
        generationCount++;lastGeometry=now;meshDirty=false;
        snapshot.segmentCount=count;snapshot.regionCount=sim.get_regions();snapshot.segmentSample=Array.from(data.subarray(0,32));
      }
      lastState=state;
      const rendering=renderer.render(paintSettings,layout,time,phase,mazeAlpha,textAlpha);
      frames++;frameRequests++;
      if(now-fpsLast>=1000){fps=Math.round(frames*1000/(now-fpsLast));frames=0;fpsLast=now;document.querySelector('#telemetry').textContent=`${fps} fps · ${snapshot.segmentCount.toLocaleString()} wall segments · ${sim.get_regions()} fields`;document.querySelector('#budget-status').textContent=useGrid&&sim.get_grid_coarsening()>1?'Grid directional detail reduced for the segment budget; spacing is unchanged.':sim.get_overflow()?'Segment budget reached; raise the budget or widen the paths.':'';}
      if(now-lastStateReadout>100){ui.live(state,paused);lastStateReadout=now;}
      Object.assign(snapshot,{ready:true,time,state,baseState,paused,redrawCount:redrawIndex,actualSeed:actualSeed(),homeBuilds,gridColumns:useGrid?sim.get_grid_columns():0,gridRows:useGrid?sim.get_grid_rows():0,gridCoarsening:useGrid?sim.get_grid_coarsening():0,plateCount:s.tectonicMotion?sim.get_plate_count():0,perspectivePlaneCount:s.lineProfiles?sim.get_perspective_count():0,fillPlaneCount:s.lineProfiles?sim.get_fill_plane_count():0,collisionCount:collisionStats.collisions,collisionDecisionCount:collisions.serial,edgeRedrawCount:collisionStats.redraws,hierarchyOrder:ordering.order,hierarchyState:hierarchy.capture(),fontBuilds,generationCount,font:s.font,title:s.title,characterCount:cache.glyphs.length,phase,mazeAlpha,textAlpha,fps,renderPasses:rendering.passes,drawCalls:rendering.draws,renderSize:rendering.renderSize,wallWidth:s.wallWidth,pathGap:s.pathGap,constantGap:s.constantGap,settings:structuredClone(s),glyphTransforms:Array.from(layout.data),hatchDirections,hatchState:hatching.capture(),frameRequests});
      if(!ready){ready=true;status.hidden=true;}
      requestAnimationFrame(frame);
    }catch(error){fail(error.message);}
  }
  requestAnimationFrame(frame);
}
init().catch(error=>fail(error.message));
