import {createRenderer} from './renderer.js';
import {imports,readStats,errorNames,normalizeSettings,summary} from './stats.js';

export const VERSION='arena-benchmark-1';
const base=new URL('./',import.meta.url),abortError=()=>new DOMException('Preparation cancelled.','AbortError');

export async function createEngine(canvas,options={}){
  const lifetime=new AbortController(),signal=lifetime.signal;
  let module,sim,renderer,observer,disposed=false,error=null,ready=false,playing=false,frozen=false;
  let raf=0,last=0,frames=0,bits=0,lookX=0,lookY=0,resizeDirty=true,dpr=0,gpuWaiting=false,epoch=0;
  let resolution=360,wire=false,relief=1,lightmap=true,atlas=false,camera=0,movement=0,workBudget=1.0;
  let serial=0,revision=1,job=null,pending=null,lastResult=null,phase='starting',recoveries=0,recovering=false,activationMs=0;
  let route=null,recording=false,replaying=false,routeAt=0,routeStart=null;
  const tasks=[],intervals=[],cpuTimes=[],history=[],began=performance.now();let firstPaintMs=0,peakOwnedBytes=0;
  const emit=value=>options.onState?.(value),cancelFrame=()=>{cancelAnimationFrame(raf);raf=0;};
  const request=()=>{if(!disposed&&!error&&!recovering&&!frozen&&!document.hidden&&!gpuWaiting&&!raf)raf=requestAnimationFrame(frame);};
  const remember=(array,value,max=600)=>{array.push(value);if(array.length>max)array.shift();};

  function cancelPreparation(reason='cancelled'){
    serial++;const current=job;job=null;
    if(current){current.abort.abort();current.worker?.terminate();current.rejectWorker?.(abortError());}
    pending?.mesh.destroy();pending=null;
    for(let i=tasks.length-1;i>=0;i--)if(tasks[i].owner===current){tasks[i].reject(abortError());tasks.splice(i,1);}
    if(!disposed&&reason==='cancelled'){phase='cancelled';emit('cancelled');}
  }
  function fatal(cause){
    if(disposed)return;error=cause?.message||String(cause);ready=false;playing=false;cancelPreparation('error');cancelFrame();renderer?.destroy();renderer=null;lifetime.abort();emit('error');options.onError?.(error);
  }
  function schedule(step,owner){
    return new Promise((resolve,reject)=>{if(disposed||owner?.abort.signal.aborted){reject(abortError());return;}tasks.push({step,owner,resolve,reject});request();});
  }
  function doWork(){
    const deadline=performance.now()+workBudget;
    while(tasks.length&&performance.now()<deadline){
      const task=tasks[0];
      try{
        if(task.owner?.abort.signal.aborted)throw abortError();
        if(task.step()){tasks.shift();task.resolve();}
      }catch(cause){tasks.shift();task.reject(cause);}
    }
  }
  const ownedBytes=()=>((sim?1:0)+(job?.instance||pending?.sim?1:0)+(job?.worker?1:0))*33554432+(job?.packetBytes||0);

  async function generate(seed,fault=0,settings={}){
    if(disposed||error||recovering)return {accepted:false,error:'Engine unavailable.'};
    cancelPreparation('superseded');const id=serial,normalized=normalizeSettings(settings);
    const current={id,seed:seed>>>0,settings:normalized,abort:new AbortController(),began:performance.now(),intervals:[],cpu:[],worker:null,instance:null,packetBytes:0};job=current;
    phase='generating';emit('generating');
    try{
      const result=await new Promise((resolve,reject)=>{
        current.rejectWorker=reject;
        current.watchdog=setTimeout(()=>reject(new Error('Arena preparation exceeded its 30-second worker deadline.')),30000);
        const worker=current.worker=new Worker(new URL('worker.js',base),{type:'module',name:`EIGENGOTT candidate ${id}`});
        worker.onerror=event=>{event.preventDefault();reject(new Error(event.message||'Arena worker failed.'));};
        worker.onmessage=({data})=>{
          if(data.serial!==id||current.abort.signal.aborted)return;
          if(data.type==='phase'){phase=['','generating','validating','surfaces','baking','transferring'][data.phase]||'preparing';emit('progress');}
          else if(data.type==='error')reject(new Error(data.error));else resolve(data);
        };
        worker.postMessage({module,seed:current.seed,fault:fault>>>0,settings:normalized,serial:id});
      });
      clearTimeout(current.watchdog);current.worker.terminate();current.worker=null;current.rejectWorker=null;current.abort.signal.throwIfAborted();
      current.workerMs=result.workerMs;current.stats=result.stats;
      if(result.type==='rejected'){
        const rejected={accepted:false,seed:current.seed,settings:normalized,errors:result.errors,messages:errorNames(result.errors),stats:result.stats,workerMs:result.workerMs};
        if(job===current){lastResult=rejected;phase='rejected';emit('rejected');}return rejected;
      }
      phase='copying';current.packetBytes=result.image.byteLength;peakOwnedBytes=Math.max(peakOwnedBytes,ownedBytes());
      const instance=current.instance=(await WebAssembly.instantiate(module,imports())).exports;current.abort.signal.throwIfAborted();
      if(result.start!==instance.image_start()||result.end!==Number(instance.__heap_base.value)||result.end-result.start!==result.image.byteLength||result.end>instance.memory.buffer.byteLength)throw new Error('Candidate image does not match this engine build.');
      let source=new Uint8Array(result.image),destination=new Uint8Array(instance.memory.buffer);const imageBytes=source.length;let copied=0;
      peakOwnedBytes=Math.max(peakOwnedBytes,ownedBytes());const copyBegan=performance.now();
      await schedule(()=>{
        const count=Math.min(65536,source.length-copied);destination.set(source.subarray(copied,copied+count),result.start+copied);copied+=count;
        current.progress=copied/source.length;return copied===source.length;
      },current);
      current.copyWallMs=performance.now()-copyBegan;current.abort.signal.throwIfAborted();
      if(instance.abi_version()!==2||!instance.engine_import_check())throw new Error('Candidate failed its import integrity/clearance check.');
      source=null;destination=null;result.image=null;current.packetBytes=0;phase='uploading';emit('progress');const uploadBegan=performance.now(),gpu=renderer;
      const mesh=await gpu.stage(instance,step=>schedule(step,current),current.abort.signal);
      if(disposed||job!==current||renderer!==gpu||current.abort.signal.aborted){mesh.destroy();throw abortError();}
      current.uploadWallMs=performance.now()-uploadBegan;
      const report={accepted:true,seed:current.seed,settings:normalized,stats:result.stats,workerMs:result.workerMs,copyWallMs:current.copyWallMs,uploadWallMs:current.uploadWallMs,
        preparationWallMs:performance.now()-current.began,preparationFrames:current.intervals.length,frameMs:summary(current.intervals),cpuMs:summary(current.cpu),imageBytes};
      pending={id,sim:instance,mesh,activate:false,report};lastResult=report;phase='staged';emit('staged');return report;
    }catch(cause){
      const rejected={accepted:false,cancelled:cause.name==='AbortError',error:cause.message,seed:current.seed,settings:normalized};
      if(job===current&&!disposed){lastResult=rejected;phase=rejected.cancelled?'cancelled':'rejected';emit(phase);}return rejected;
    }finally{
      clearTimeout(current.watchdog);current.worker?.terminate();current.worker=null;current.rejectWorker=null;current.packetBytes=0;
      if(job===current)job=null;
    }
  }
  function view(value={}){
    resolution=[0,360,540,720].includes(value.resolution)?value.resolution:resolution;
    wire=value.collision===undefined?wire:!!value.collision;lightmap=value.lightmap===undefined?lightmap:!!value.lightmap;atlas=value.atlas===undefined?atlas:!!value.atlas;
    relief=Number.isFinite(value.relief)?Math.max(0,Math.min(1,value.relief)):relief;
    if(Number.isInteger(value.movement)&&value.movement!==movement){movement=Math.max(0,Math.min(1,value.movement));sim?.engine_profile(movement);}
    if(Number.isInteger(value.camera)&&value.camera!==camera){camera=Math.max(0,Math.min(2,value.camera));sim?.engine_camera_mode(camera);bits=0;lookX=0;lookY=0;}
    workBudget=Number.isFinite(value.workBudget)?Math.max(.25,Math.min(3,value.workBudget)):workBudget;
    sim?.engine_options(wire||camera===2?1:0,wire?0:relief,lightmap?1:0);resizeDirty=true;request();
  }
  const gpuOptions={signal,onError:fatal,onLost:()=>{void recover();}};
  async function recover(){
    if(disposed||recovering||error)return;
    if(!ready||recoveries>=2){fatal(new Error('The graphics device disconnected. Retry to rebuild the benchmark.'));return;}
    recovering=true;recoveries++;epoch++;gpuWaiting=false;cancelPreparation('recovery');cancelFrame();renderer?.destroy();renderer=null;emit('recovering');
    try{renderer=await createRenderer(canvas,sim,gpuOptions);const mesh=await renderer.stage(sim);signal.throwIfAborted();renderer.activate(mesh);resizeDirty=true;last=0;recovering=false;phase='active';emit('restored');request();}
    catch(cause){recovering=false;if(!disposed)fatal(cause);}
  }
  function restorePlayer(target,state){return target.engine_inherit_player(...state.position,...state.velocity,state.yaw,state.pitch,state.simulationTime,movement,state.physicsSteps);}
  function frame(now){
    raf=0;if(disposed||error||recovering||document.hidden||frozen)return;const before=performance.now();
    try{
      if(pending?.activate){
        const start=performance.now(),next=pending;pending=null;
        const retained=restorePlayer(next.sim,readStats(sim));
        sim=next.sim;renderer.setSimulation(sim);renderer.activate(next.mesh);sim.engine_camera_mode(camera);view();
        activationMs=performance.now()-start;revision++;lastResult={...next.report,phase:'active',activationMs,retainedPlayer:!!retained};remember(history,lastResult,30);phase='active';
        recording=false;replaying=false;emit('activated');
      }
      if(dpr!==devicePixelRatio){dpr=devicePixelRatio;resizeDirty=true;}
      if(resizeDirty){const rect=canvas.getBoundingClientRect();renderer.resize(Math.max(1,rect.width),Math.max(1,rect.height),resolution);resizeDirty=false;}
      let dt=last?Math.max(0,Math.min(.1,(now-last)/1000)):0;last=now;
      let input=playing?bits:0,dx=playing?lookX:0,dy=playing?lookY:0,stepDt=playing?dt:0;
      if(replaying&&playing){
        const step=route.steps[routeAt++];if(step){[stepDt,input,dx,dy]=step;}else{replaying=false;emit('route-finished');}
      }
      if(recording&&playing){if(route.steps.length<7200)route.steps.push([stepDt,input,dx,dy]);else{recording=false;emit('route-limit');}}
      sim.engine_tick(stepDt,input,dx,dy);lookX=0;lookY=0;
      if(replaying&&routeAt===route.steps.length){
        replaying=false;route.replayEnd=readStats(sim);route.endpointError=route.end?Math.hypot(...route.replayEnd.position.map((x,i)=>x-route.end.position[i])):null;emit('route-finished');
      }
      const drain=renderer.render(wire||camera===2,atlas);doWork();frames++;
      const cpu=performance.now()-before;remember(intervals,dt*1000);remember(cpuTimes,cpu);
      if(job){if(dt>0)job.intervals.push(dt*1000);job.cpu.push(cpu);peakOwnedBytes=Math.max(peakOwnedBytes,ownedBytes());}
      if(!ready){ready=true;firstPaintMs=performance.now()-began;phase='active';emit('ready');}
      if(drain){const current=epoch;gpuWaiting=true;cancelFrame();void drain.then(()=>{if(current!==epoch)return;gpuWaiting=false;request();});}else request();
    }catch(cause){fatal(cause);}
  }
  function destroy(){
    if(disposed)return;disposed=true;ready=false;epoch++;cancelPreparation('destroy');cancelFrame();lifetime.abort();observer?.disconnect();renderer?.destroy();renderer=null;sim=null;module=null;
    for(const task of tasks.splice(0))task.reject(abortError());options.signal?.removeEventListener('abort',destroy);
  }
  options.signal?.addEventListener('abort',destroy,{once:true});
  try{
    options.signal?.throwIfAborted();const response=await fetch(new URL('engine.wasm',base),{signal});if(!response.ok)throw new Error(`Could not load engine.wasm (${response.status}).`);
    try{module=await WebAssembly.compileStreaming(response.clone());}catch{signal.throwIfAborted();module=await WebAssembly.compile(await response.arrayBuffer());}
    sim=(await WebAssembly.instantiate(module,imports())).exports;
    if(sim.abi_version()!==2||sim.engine_init((options.seed??27011984)>>>0)||!sim.engine_activate(sim.candidate_id()))throw new Error('The small baseline could not initialize.');
    renderer=await createRenderer(canvas,sim,gpuOptions);renderer.activate(await renderer.stage(sim));signal.throwIfAborted();
    observer=new ResizeObserver(()=>{resizeDirty=true;request();});observer.observe(canvas);
    document.addEventListener('visibilitychange',()=>{cancelFrame();last=0;bits=0;lookX=0;lookY=0;if(!document.hidden){resizeDirty=true;request();}},{signal});
    document.addEventListener('freeze',()=>{frozen=true;cancelFrame();last=0;},{signal});document.addEventListener('resume',()=>{frozen=false;last=0;request();},{signal});request();
  }catch(cause){destroy();throw cause;}
  return {get ready(){return ready;},get error(){return error;},get playing(){return playing;},
    play(value=true){playing=!!value;bits=0;lookX=0;lookY=0;last=0;emit(playing?'playing':'unlocked');request();},
    input(value,dx=0,dy=0){bits=value>>>0;if(Number.isFinite(dx))lookX+=dx;if(Number.isFinite(dy))lookY+=dy;},
    generate,cancel:cancelPreparation,view,
    activate(){if(!pending)return false;pending.activate=true;request();return true;},
    resetPlayer(){sim?.engine_reset_player();sim?.engine_profile(movement);},
    resetMeasurements(){intervals.length=0;cpuTimes.length=0;},
    route(action){
      if(action==='record'){camera=0;sim.engine_camera_mode(0);sim.engine_reset_player();sim.engine_profile(movement);routeStart=readStats(sim);route={seed:routeStart.seed,geometryHash:routeStart.geometryHash,movement,steps:[],start:routeStart};recording=true;replaying=false;}
      else if(action==='stop'){if(recording&&route)route.end=readStats(sim);recording=false;replaying=false;}
      else if(action==='play'){
        if(!route?.steps.length||readStats(sim).geometryHash!==route.geometryHash)return false;
        recording=false;camera=0;sim.engine_camera_mode(0);movement=route.movement;sim.engine_reset_player();restorePlayer(sim,route.start);routeAt=0;replaying=true;
      }return true;
    },
    snapshot(){
      const frameMs=summary(intervals.filter(x=>x>0));
      return {version:VERSION,deployment:globalThis.__EIGENGOTT_BUILD||null,ready,playing,error,phase,busy:!!job,staged:!!pending,frames,firstPaintMs,recovering,recoveries,disposed,arenaRevision:revision,activationMs,lastResult,history,
        fps:document.hidden?0:frameMs.median?1000/frameMs.median:0,frameMs,cpuMs:summary(cpuTimes),...readStats(sim),
        wasmMemoryBytes:sim?.memory.buffer.byteLength||0,ownedMemoryEstimate:ownedBytes(),peakOwnedMemoryEstimate:peakOwnedBytes,
        preparation:job?{seed:job.seed,settings:job.settings,phase,progress:job.progress||0,elapsedMs:performance.now()-job.began}:null,
        route:{recording,replaying,steps:route?.steps.length||0,index:routeAt,endpointError:route?.endpointError??null},gpuSceneMs:null,gpuPresentMs:null,...(renderer?.diagnostics||{})};
    },
    destroy,
    ...(options.testing?{simulateDeviceLoss:()=>renderer?.simulateLoss(),tryPlace:(...args)=>sim.engine_try_place(...args),playerClear:()=>!!sim.engine_player_clear()}:{}),
  };
}
