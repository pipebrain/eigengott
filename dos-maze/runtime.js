import {PROFILE,VERSION,BUILD} from './profile.js';
import {Animation,stateAt} from './animation.js';
import {createTitle} from './title.js';
import {createRenderer} from './renderer.js';
const base=new URL('./',import.meta.url);
const qualityOf=value=>({dprCap:Number.isFinite(value?.dprCap)?Math.max(.5,Math.min(2,value.dprCap)):PROFILE.dprCap,antialias:typeof value?.antialias==='boolean'?value.antialias:PROFILE.antialias});
async function loadSource(signal){
  const fetchOK=async path=>{const response=await fetch(new URL(path,base),{signal});if(!response.ok)throw new Error(`Could not load ${path} (${response.status}).`);return response;};
  const imports={env:{sin:Math.sin,cos:Math.cos}};
  const [wasm,meta,packed]=await Promise.all([
    fetchOK('maze.wasm').then(async response=>{
      try{return await WebAssembly.instantiateStreaming(response.clone(),imports);}
      catch(error){signal.throwIfAborted();return WebAssembly.instantiate(await response.arrayBuffer(),imports);}
    }),
    fetchOK('assets/title.json').then(r=>r.json()),fetchOK('assets/title.bin.gz').then(r=>r.arrayBuffer()),
  ]);
  if(meta.version!==1||meta.atlasSize!==512||meta.layers!==9||meta.maskBytes!==9*32768||meta.guideBytes!==344*192||meta.glyphs?.length!==9)throw new Error('Invalid DOS-maze asset metadata.');
  let asset=new Uint8Array(packed);
  if(asset[0]===31&&asset[1]===139){
    if(typeof DecompressionStream==='undefined')throw new Error('This browser needs native gzip decompression support.');
    asset=new Uint8Array(await new Response(new Blob([asset]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  if(asset.byteLength!==meta.maskBytes+meta.guideBytes)throw new Error('Incomplete DOS-maze title assets.');
  const digest=await crypto.subtle.digest('SHA-256',asset);
  const hex=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(hex!==meta.sha256)throw new Error('DOS-maze assets failed their integrity check. Reload to update cached files.');
  return {sim:wasm.instance.exports,meta,asset};
}
// Engine-facing component. The HTML controls are a separate development shell.
// No localStorage, imported fonts, old laboratory modules, or per-frame DOM work.
export async function createDOSMaze(canvas,options={}){
  if(!(canvas instanceof HTMLCanvasElement))throw new TypeError('A canvas element is required.');
  const controller=new AbortController(),{signal}=controller;
  let renderer,sim,source,title,destroyed=false,ready=false,recovering=false,recoveries=0,resumePending=false;
  let animation=new Animation(),quality=qualityOf(options.quality),paused=options.paused===true;
  let time=Number.isFinite(options.time)?Math.max(0,Math.min(1e8,options.time)):0;
  let manual=Number.isFinite(options.state)?Math.max(0,Math.min(1,options.state)):null;
  let speed=Number.isFinite(options.timeScale)?Math.max(0,Math.min(4,options.timeScale)):PROFILE.timeScale;
  const flicker=options.flicker!==false;
  let raf=0,last=0,lastGeometry=-Infinity,meshDirty=true,viewDirty=true,lastDpr=0,width=0,height=0,gpuWaiting=false;
  let frames=0,generations=0,segmentCount=0,state=0,geometryMs=0,totalCpuMs=0,firstPaintMs=0,error=null;
  const frameTimes=new Float64Array(256),cpuTimes=new Float64Array(256);let measured=0,frameCursor=0;
  const started=performance.now();
  const cancel=()=>{cancelAnimationFrame(raf);raf=0;};
  function fatal(cause){
    if(destroyed)return;error=cause instanceof Error?cause.message:String(cause);cancel();renderer?.destroy();renderer=null;
    options.onState?.('error');options.onError?.(error);
  }
  function request(){if(!destroyed&&!error&&!recovering&&!gpuWaiting&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);}
  function uploadAtlas(){
    const input=new Uint8Array(sim.memory.buffer,sim.get_glyph_input(),32768);
    for(let i=0;i<9;i++){
      input.set(source.asset.subarray(i*32768,(i+1)*32768));sim.build_glyph();
      renderer.setAtlasLayer(i,new Uint8Array(sim.memory.buffer,sim.get_buffer(),512*512*2));
    }
    new Uint8Array(sim.memory.buffer,sim.get_guide_buffer(),344*192).set(source.asset.subarray(source.meta.maskBytes));
  }
  const gpuOptions={signal,onError:fatal,onLost:()=>{void recover();}};
  async function recover(){
    if(destroyed||recovering||error)return;
    if(recoveries>=2){fatal('The graphics device disconnected repeatedly. Reload to retry.');return;}
    recovering=true;recoveries++;cancel();renderer?.destroy();renderer=null;options.onState?.('recovering');
    try{
      renderer=await createRenderer(canvas,gpuOptions);signal.throwIfAborted();uploadAtlas();
      viewDirty=true;meshDirty=true;lastGeometry=-Infinity;last=0;recovering=false;resumePending=true;request();
    }catch(cause){recovering=false;if(!destroyed)fatal(cause);}
  }
  function frame(now){
    raf=0;if(destroyed||error||recovering||document.hidden)return;
    const cpuStart=performance.now();
    try{
      const dt=last?Math.max(0,Math.min(.1,(now-last)/1000)):0;last=now;
      if(!paused)time+=dt*speed;
      if(lastDpr!==devicePixelRatio){lastDpr=devicePixelRatio;viewDirty=true;}
      if(viewDirty){
        const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
        renderer.resize(width,height,quality);renderer.uploadTitle(title.resize(width,height));meshDirty=true;viewDirty=false;
      }
      state=manual===null?stateAt(time):manual;
      const redraw=animation.update(time,state,manual===null,flicker);if(redraw)meshDirty=true;
      const data=title.update(state,time);
      if(meshDirty||(!paused&&now-lastGeometry>=1000/PROFILE.geometryHz)){
        const before=performance.now();sim.generate(width,height,animation.seed,state,time);
        segmentCount=sim.get_count();
        if(sim.get_overflow()&&segmentCount===0)throw new Error('The viewport exceeds DOS-maze generation limits.');
        renderer.uploadMaze(new Float32Array(sim.memory.buffer,sim.get_buffer(),segmentCount*4));
        geometryMs=performance.now()-before;generations++;lastGeometry=now;meshDirty=false;
      }
      // Approximately 16 ms of queued frames, capped at 32 for uncapped/high-Hz
      // embedding and two at ordinary refresh rates. No image-quality changes.
      const queueLimit=Math.max(2,Math.min(32,Math.ceil(16/Math.max(dt*1000,.1))));
      const drain=renderer.render(data,animation,quality,queueLimit);frames++;
      const cpu=performance.now()-cpuStart;totalCpuMs+=cpu;
      frameTimes[frameCursor]=dt*1000;cpuTimes[frameCursor]=cpu;frameCursor=(frameCursor+1)%256;measured=Math.min(256,measured+1);
      if(!ready){ready=true;firstPaintMs=performance.now()-started;options.onState?.('running');}
      else if(resumePending){resumePending=false;options.onState?.('running');}
      if(drain){
        gpuWaiting=true;cancel();void drain.then(()=>{gpuWaiting=false;if((!paused&&speed>0)||meshDirty||viewDirty)request();});
      }else if(!paused&&speed>0)request();
    }catch(cause){fatal(cause);}
  }
  function destroy(){
    if(destroyed)return;destroyed=true;ready=false;cancel();controller.abort();observer?.disconnect();dprQuery?.removeEventListener('change',dprChanged);renderer?.destroy();renderer=null;sim=null;source=null;title=null;
    options.signal?.removeEventListener('abort',destroy);
  }
  options.signal?.addEventListener('abort',destroy,{once:true});
  let observer,dprQuery;
  function watchDpr(){
    dprQuery?.removeEventListener('change',dprChanged);
    dprQuery=matchMedia(`(resolution: ${devicePixelRatio||1}dppx)`);dprQuery.addEventListener('change',dprChanged,{once:true});
  }
  function dprChanged(){watchDpr();viewDirty=true;request();}
  try{
    options.signal?.throwIfAborted();
    const loading=loadSource(signal);
    const gpu=createRenderer(canvas,gpuOptions).then(value=>{renderer=value;return value;});
    [source]=await Promise.all([loading,gpu]);signal.throwIfAborted();sim=source.sim;title=createTitle(source.meta);uploadAtlas();
    observer=new ResizeObserver(()=>{viewDirty=true;request();});observer.observe(canvas);watchDpr();
    window.addEventListener('resize',()=>{viewDirty=true;request();},{signal});
    document.addEventListener('visibilitychange',()=>{cancel();last=0;if(!document.hidden){viewDirty=true;request();}},{signal});
    document.addEventListener('freeze',()=>{cancel();last=0;},{signal});
    document.addEventListener('resume',()=>{last=0;viewDirty=true;request();},{signal});
    request();
  }catch(cause){destroy();throw cause;}
  return {
    get ready(){return ready;},get paused(){return paused;},get time(){return time;},get state(){return state;},get error(){return error;},
    get quality(){return {...quality};},get timeScale(){return speed;},
    pause(){paused=true;cancel();last=0;},resume(){paused=false;last=0;request();},
    toggle(){if(paused)this.resume();else this.pause();},
    restart(){time=0;manual=null;animation.reset();meshDirty=true;last=0;request();},
    step(){this.pause();time+=speed/60;meshDirty=true;request();},
    seek(value,{state:amount=null,redraw=0}={}){
      if(!Number.isFinite(value)||value<0||value>1e8)throw new RangeError('Invalid animation time.');
      time=value;manual=Number.isFinite(amount)?Math.max(0,Math.min(1,amount)):null;
      animation.reset();animation.redraw=Math.max(0,Math.min(1e6,Math.trunc(redraw)||0));meshDirty=true;last=0;request();
    },
    setTimeScale(value){if(!Number.isFinite(value))return;speed=Math.max(0,Math.min(4,value));last=0;request();},
    setQuality(value){quality=qualityOf(value);viewDirty=true;request();},
    snapshot(){
      const summarize=(data)=>{const values=Array.from(data.subarray(0,measured)).sort((a,b)=>a-b);return {median:values[Math.floor(values.length/2)]||0,p95:values[Math.floor(values.length*.95)]||0};};
      const intervals=summarize(frameTimes),cpu=summarize(cpuTimes);
      return {version:VERSION,build:BUILD,ready,paused,time,state,frames,generations,segmentCount,redraws:animation.redraw,hierarchy:Array.from(animation.order),
        recovering,recoveries,error,firstPaintMs,geometryMs,averageCpuMs:frames?totalCpuMs/frames:0,cpuMs:cpu,frameMs:intervals,fps:!paused&&speed>0&&!document.hidden&&intervals.median?1000/intervals.median:0,
        destroyed,quality:{...quality},timeScale:speed,wasmMemoryBytes:sim?.memory.buffer.byteLength||0,overflow:sim?!!sim.get_overflow():false,...(renderer?.diagnostics||{})};
    },
    destroy,
    // Explicit fault injection is opt-in for the test harness, absent in normal use.
    ...(options.testing?{simulateDeviceLoss:()=>renderer?.loseDeviceForTest()}:{}),
  };
}
