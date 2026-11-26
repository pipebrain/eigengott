import {createRenderer} from './renderer.js';
const base=new URL('./',import.meta.url);
export const VERSION='engine-proof-1';
export const errorNames=mask=>['invalid sector','exterior leak','nonmanifold seam','inconsistent winding','disconnected interior','invalid spawn clearance','capacity exceeded','face intersection','broken sector binding','invalid index','degenerate triangle'].filter((_,i)=>mask&(1<<i));
export async function createEngine(canvas,options={}){
  const controller=new AbortController(),{signal}=controller;let sim,renderer,observer,disposed=false,ready=false,playing=false,error=null;
  let raf=0,last=0,gpuWaiting=false,resizeDirty=true,oldDpr=0,internalHeight=360,wire=false,relief=1,lighting=true,graphicsEpoch=0,frozen=false;
  let bits=0,lookX=0,lookY=0,requestSerial=0,pending=null,busy=false,lastResult=null,recoveries=0,recovering=false;
  let frames=0,frameAt=0,measured=0;const frameTimes=new Float64Array(180),cpuTimes=new Float64Array(180);const start=performance.now();let firstPaintMs=0;
  const emit=state=>options.onState?.(state);
  const cancel=()=>{cancelAnimationFrame(raf);raf=0;};
  function request(){if(!disposed&&!error&&!recovering&&!gpuWaiting&&!frozen&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
  function fatal(cause){if(disposed)return;error=cause instanceof Error?cause.message:String(cause);ready=false;playing=false;bits=0;lookX=0;lookY=0;cancel();controller.abort();renderer?.destroy();renderer=null;emit('error');options.onError?.(error);}
  function stats(){
    if(!sim)return null;const p=sim.stats_ptr(),u=new Uint32Array(sim.memory.buffer,p,32),f=new Float32Array(sim.memory.buffer,p+128,32);
    return {abi:u[0],activeId:u[1],seed:u[2],candidateId:u[3],candidateSeed:u[4],candidateReady:!!u[5],candidateErrors:u[6],candidateMessages:errorNames(u[6]),
      cells:u[7],topologyVertices:u[8],triangles:u[9],vertices:u[10],indices:u[11],faces:u[12],lights:u[13],candidateCells:u[14],candidateTriangles:u[15],candidateVertices:u[16],candidateIndices:u[17],
      unmatchedEdges:u[18],nonmanifoldEdges:u[19],components:u[20],intersections:u[21],grounded:!!u[22],physicsSteps:u[23],collisionHits:u[24],blockedLooks:u[25],vertexCapacity:u[26],indexCapacity:u[27],geometryHash:u[28],candidateHash:u[29],activations:u[30],arenaStorageBytes:u[31],
      position:Array.from(f.subarray(0,3)),velocity:Array.from(f.subarray(3,6)),yaw:f[6],pitch:f[7],simulationTime:f[8],generationMs:f[9],validationMs:f[10],surfaceMs:f[11],bakeMs:f[12],candidateSpawn:Array.from(f.subarray(13,16)),arenaWidth:f[16],arenaHeight:f[17],up:Array.from(f.subarray(18,21))};
  }
  async function generate(seed,fault=0){
    if(disposed||error||recovering)return {accepted:false,error:'Engine unavailable.'};
    const serial=++requestSerial;busy=true;if(pending){pending.mesh.destroy();pending=null;}emit('generating');
    try{
      const code=sim.engine_prepare(seed>>>0,fault>>>0);const id=sim.candidate_id();
      if(code){lastResult={accepted:false,seed:seed>>>0,fault,errors:code,messages:errorNames(code)};emit('rejected');return lastResult;}
      const gpu=renderer,mesh=await gpu.stage(true);
      if(disposed||serial!==requestSerial||renderer!==gpu||sim.candidate_id()!==id){mesh.destroy();return {accepted:false,stale:true};}
      pending={id,mesh,serial,activate:false};lastResult={accepted:true,seed:seed>>>0,id,phase:'staged'};emit('staged');request();return lastResult;
    }catch(cause){if(!disposed&&serial===requestSerial){lastResult={accepted:false,error:cause.message};emit('rejected');}return {accepted:false,error:cause.message};}
    finally{if(serial===requestSerial)busy=false;}
  }
  const gpuOptions={signal,onError:fatal,onLost:()=>{void recover();}};
  async function recover(){
    if(disposed||recovering||error)return;
    if(!ready||recoveries>=2){fatal('The graphics device disconnected. Retry to rebuild the engine test.');return;}
    recovering=true;recoveries++;graphicsEpoch++;gpuWaiting=false;requestSerial++;busy=false;pending?.mesh.destroy();pending=null;cancel();renderer?.destroy();renderer=null;emit('recovering');
    try{
      renderer=await createRenderer(canvas,sim,gpuOptions);const mesh=await renderer.stage(false);signal.throwIfAborted();renderer.activate(mesh);resizeDirty=true;last=0;recovering=false;emit('restored');emit(playing?'playing':'unlocked');request();
    }catch(cause){recovering=false;if(!disposed)fatal(cause);}
  }
  function frame(now){
    raf=0;if(disposed||error||recovering||document.hidden)return;const before=performance.now();
    try{
      const dt=last?Math.max(0,Math.min(.1,(now-last)/1000)):0;last=now;
      if(pending?.activate){const candidate=pending;pending=null;if(candidate.serial===requestSerial&&sim.engine_activate(candidate.id)){renderer.activate(candidate.mesh);lastResult={...lastResult,phase:'active'};emit('activated');}else candidate.mesh.destroy();}
      if(oldDpr!==devicePixelRatio){oldDpr=devicePixelRatio;resizeDirty=true;}
      if(resizeDirty){const rect=canvas.getBoundingClientRect();renderer.resize(Math.max(1,rect.width),Math.max(1,rect.height),internalHeight);resizeDirty=false;}
      sim.engine_tick(playing?dt:0,playing?bits:0,playing?lookX:0,playing?lookY:0);lookX=0;lookY=0;
      const drain=renderer.render(wire);frames++;frameTimes[frameAt]=dt*1000;cpuTimes[frameAt]=performance.now()-before;frameAt=(frameAt+1)%180;measured=Math.min(180,measured+1);
      if(!ready){ready=true;firstPaintMs=performance.now()-start;emit('ready');}
      if(drain){const epoch=graphicsEpoch;gpuWaiting=true;cancel();void drain.then(()=>{if(epoch!==graphicsEpoch)return;gpuWaiting=false;request();});}else request();
    }catch(cause){fatal(cause);}
  }
  function destroy(){
    if(disposed)return;disposed=true;ready=false;graphicsEpoch++;requestSerial++;cancel();controller.abort();observer?.disconnect();pending?.mesh.destroy();pending=null;renderer?.destroy();renderer=null;sim=null;options.signal?.removeEventListener('abort',destroy);
  }
  options.signal?.addEventListener('abort',destroy,{once:true});
  try{
    options.signal?.throwIfAborted();const response=await fetch(new URL('engine.wasm',base),{signal});if(!response.ok)throw new Error(`Could not load engine.wasm (${response.status}).`);
    const imports={env:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt,now:()=>performance.now()}};let wasm;
    try{wasm=await WebAssembly.instantiateStreaming(response.clone(),imports);}catch(cause){signal.throwIfAborted();wasm=await WebAssembly.instantiate(await response.arrayBuffer(),imports);}
    sim=wasm.instance.exports;if(sim.abi_version()!==1)throw new Error('Unsupported engine ABI.');
    // Initialize palette and candidate before the renderer reads its data.
    const seed=(options.seed??27011984)>>>0;const code=sim.engine_init(seed);if(code)throw new Error('Initial arena rejected: '+errorNames(code).join(', '));
    renderer=await createRenderer(canvas,sim,gpuOptions);const mesh=await renderer.stage(true);signal.throwIfAborted();pending={id:sim.candidate_id(),mesh,serial:requestSerial,activate:true};
    observer=new ResizeObserver(()=>{resizeDirty=true;request();});observer.observe(canvas);
    window.addEventListener('resize',()=>{resizeDirty=true;request();},{signal});
    document.addEventListener('visibilitychange',()=>{cancel();last=0;bits=0;lookX=0;lookY=0;if(!document.hidden){resizeDirty=true;request();}},{signal});
    document.addEventListener('freeze',()=>{frozen=true;cancel();last=0;},{signal});document.addEventListener('resume',()=>{frozen=false;last=0;request();},{signal});request();
  }catch(cause){destroy();throw cause;}
  return {get ready(){return ready;},get error(){return error;},get playing(){return playing;},
    play(value=true){playing=!!value;bits=0;lookX=0;lookY=0;last=0;emit(playing?'playing':'unlocked');request();},
    input(value,dx=0,dy=0){bits=value>>>0;if(Number.isFinite(dx))lookX+=dx;if(Number.isFinite(dy))lookY+=dy;},
    generate,
    activate(){if(!pending||pending.serial!==requestSerial)return false;pending.activate=true;request();return true;},
    resetPlayer(){sim?.engine_reset_player();},
    view({resolution=internalHeight,collision=wire,relief:amount=relief,lightmap=lighting}={}){
      internalHeight=[0,360,540,720].includes(resolution)?resolution:360;wire=!!collision;relief=Number.isFinite(amount)?Math.max(0,Math.min(1,amount)):1;lighting=!!lightmap;
      sim?.engine_options(wire?1:0,wire?0:relief,lighting?1:0);resizeDirty=true;request();
    },
    snapshot(){
      const summary=data=>{const values=Array.from(data.subarray(0,measured)).sort((a,b)=>a-b);return{median:values[Math.floor(values.length/2)]||0,p95:values[Math.floor(values.length*.95)]||0};};const interval=summary(frameTimes);
      return {version:VERSION,ready,playing,error,busy,recovering,recoveries,frames,firstPaintMs,lastResult,staged:!!pending,...stats(),fps:document.hidden?0:interval.median?1000/interval.median:0,cpuMs:summary(cpuTimes),wasmMemoryBytes:sim?.memory.buffer.byteLength||0,disposed,gpuSceneMs:null,gpuPresentMs:null,...(renderer?.diagnostics||{})};
    },
    destroy,
    ...(options.testing?{simulateDeviceLoss:()=>renderer?.simulateLoss(),tryPlace:(...args)=>sim.engine_try_place(...args),playerClear:()=>!!sim.engine_player_clear()}:{}),
  };
}
