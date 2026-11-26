import {createRenderer} from './renderer.js';
import {imports,readStats,readSectors,readEvents} from './stats.js';
export const DEFAULTS=Object.freeze({waves:true,loop:false,spread:.72,coherence:0,delay:.38,slotDuration:1.1,hz:12,blank:.28,jitter:.25,roots:2,depth:6,margin:.2,tail:.5,interval:2,stageBodies:true,cutaway:false,showCorpses:true,feedback:true,feedbackFreeze:false,halfLife:2.4,stretch:3,worldAnchor:false,style:1,pitch:9,lineWidth:1,branch:.5,grid:1,monoWorld:false,monoVoid:true,seed:27011984,inspection:0,resolution:360,dpr:1,showBody:true,camera:0,debug:0});
export async function createEngine(canvas,options={}){
 const response=await fetch(new URL('wave.wasm',import.meta.url),{signal:options.signal});if(!response.ok)throw new Error('Wave WASM download failed.');
 const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),imports()),sim=instance.exports;sim.fold_init(DEFAULTS.seed);
 if(sim.abi_version()!==2)throw new Error('Unexpected wave ABI.');
 let renderer,disposed=false,recovering=false,error=null,suspended=false,raf=0,last=0,frames=0,playerInput=false,bits=0,dx=0,dy=0,resizeDirty=true,ratio=0,feedbackTime=0;
 let settings={...DEFAULTS},cpu=[],fpsTimes=[],recoveries=0;
 const start=performance.now(),emit=()=>options.onState?.(),cancel=()=>{cancelAnimationFrame(raf);raf=0;};
 const request=()=>{if(!disposed&&!error&&!recovering&&!suspended&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);};
 const fatal=cause=>{if(disposed)return;error=cause?.message||String(cause);cancel();renderer?.destroy();renderer=null;emit();options.onError?.(error);};
 async function lost(){
  if(disposed||recovering)return;recovering=true;recoveries++;cancel();renderer?.destroy();renderer=null;emit();
  try{renderer=await createRenderer(canvas,{onLost:lost,onError:fatal});if(disposed){renderer.destroy();return;}recovering=false;resizeDirty=true;last=0;emit();request();}catch(cause){recovering=false;fatal(cause);}
 }
 renderer=await createRenderer(canvas,{onLost:lost,onError:fatal});
 if(options.signal?.aborted){renderer.destroy();throw new DOMException('Cancelled','AbortError');}
 const observer=new ResizeObserver(()=>{resizeDirty=true;request();});observer.observe(canvas);
 const visibility=()=>{bits=0;dx=dy=0;last=0;if(document.hidden)cancel();else{renderer?.clear();request();}};document.addEventListener('visibilitychange',visibility);
 function apply(value){
  const old=settings;settings={...settings,...value};
  for(const [key,lo,hi]of [['spread',0,1],['coherence',0,1],['delay',.08,2],['slotDuration',.25,4],['hz',2,30],['blank',0,1],['jitter',0,.8],['roots',1,8],['depth',0,12],['margin',.05,.6],['tail',.1,3],['interval',.25,10],['halfLife',.05,12],['stretch',0,12],['pitch',3,40],['lineWidth',.5,4],['branch',0,1],['resolution',180,1080],['dpr',.5,2],['style',0,1],['inspection',0,3],['grid',0,2],['camera',0,2],['debug',0,7],['seed',0,4294967295]])settings[key]=Number.isFinite(+settings[key])?Math.min(hi,Math.max(lo,+settings[key])):DEFAULTS[key];
  for(const key of ['waves','loop','stageBodies','cutaway','showCorpses','feedback','feedbackFreeze','worldAnchor','monoWorld','monoVoid','showBody'])settings[key]=!!settings[key];
  settings.seed>>>=0;settings.roots=Math.round(settings.roots);settings.depth=Math.round(settings.depth);
  sim.wave_options(+settings.waves,+settings.loop,settings.spread,settings.coherence,settings.delay,settings.slotDuration,settings.hz,settings.blank,settings.jitter,settings.roots,settings.depth,settings.margin,settings.tail,settings.interval,+settings.stageBodies);
  sim.wave_seed(settings.seed);sim.fold_debug(settings.debug);sim.fold_render_options(+settings.cutaway,+settings.showBody,+settings.showCorpses);
  if(settings.camera!==old.camera){sim.fold_camera(settings.camera);renderer?.clear();bits=0;dx=dy=0;}
  if(['style','grid','worldAnchor','feedback','cutaway'].some(k=>settings[k]!==old[k]))renderer?.clear();
  if(settings.dpr!==old.dpr||settings.resolution!==old.resolution)resizeDirty=true;
  emit();request();return {...settings};
 }
 function size(){
  const rect=canvas.getBoundingClientRect();ratio=Math.min(devicePixelRatio||1,settings.dpr);canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
  const height=Math.max(1,Math.min(Math.round(settings.resolution),canvas.height)),width=Math.max(1,Math.round(height*canvas.width/canvas.height));renderer.resize(width,height);sim.fold_view(width,height);resizeDirty=false;
 }
 function render(dt){const w=readStats(sim);if(!settings.feedbackFreeze)feedbackTime+=dt;return renderer.render(sim,{...settings,seed:settings.seed%997,phase:0,opening:0,showBody:true,meshRevision:w.meshRevision},dt,feedbackTime);}
 function frame(now){
  raf=0;if(disposed||error||recovering||document.hidden)return;if(renderer.busy){request();return;}
  const began=performance.now(),dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(resizeDirty||ratio!==Math.min(devicePixelRatio||1,settings.dpr))size();
  sim.fold_tick(dt,playerInput?bits:0,playerInput?dx:0,playerInput?dy:0);dx=dy=0;render(dt);frames++;
  cpu.push(performance.now()-began);if(cpu.length>600)cpu.shift();if(dt>0){fpsTimes.push(dt);if(fpsTimes.length>120)fpsTimes.shift();}request();
 }
 const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:0;
 const snapshot=()=>({version:'arena-fold-candidate-2',build:globalThis.__EIGENGOTT_BUILD||null,ready:!!renderer&&!error&&!recovering,error,recovering,recoveries,frames,elapsedMs:performance.now()-start,wasmBytes:sim.memory.buffer.byteLength,settings:{...settings},wave:readStats(sim),sectors:readSectors(sim),events:readEvents(sim),render:renderer?.snapshot()||null,cpuMs:{p50:percentile(cpu,.5),p95:percentile(cpu,.95)},fps:fpsTimes.length?fpsTimes.length/fpsTimes.reduce((a,b)=>a+b,0):0,hidden:document.hidden});
 function reset(){sim.fold_init(settings.seed);settings.camera=0;apply(settings);bits=0;dx=dy=0;renderer?.clear();feedbackTime=0;last=0;emit();request();}
 const api={snapshot,configure:apply,input(input,x=0,y=0){bits=input&63;dx+=Number.isFinite(x)?x:0;dy+=Number.isFinite(y)?y:0;},play(value){playerInput=!!value;bits=0;dx=dy=0;},trigger(){const ok=!!sim.wave_start();emit();request();return ok;},pause(){sim.wave_pause(+!readStats(sim).playing);emit();},step(){sim.wave_step();emit();request();},reset,fixture(kind){apply({seed:kind===1?17:24,spread:1,coherence:0,roots:1,depth:12,jitter:0,delay:.08,slotDuration:.25,tail:.1,waves:true,loop:false,debug:6});reset();const ok=!!sim.fold_place(-2,kind===1?-5.6:-4,.035,0,0);renderer?.clear();emit();request();return ok;},stageBodies(){sim.wave_stage_bodies();emit();request();},clearHistory(){renderer?.clear();},destroy(){if(disposed)return;disposed=true;cancel();observer.disconnect();document.removeEventListener('visibilitychange',visibility);renderer?.destroy();renderer=null;},get playing(){return playerInput;}};
 if(new URLSearchParams(location.search).has('test'))api.test={sim,stop(){suspended=true;cancel();},resume(){suspended=false;last=0;request();},async render(dt=0){cancel();if(resizeDirty)size();render(dt);await new Promise(r=>setTimeout(r,0));return snapshot();},async history(){const r=await renderer.readHistory();let hash=2166136261,alpha=0,lit=0;for(const b of new Uint8Array(r.data.buffer))hash=Math.imul(hash^b,16777619)>>>0;for(let i=0;i<r.data.length;i++){if(i%4===3)alpha+=r.data[i];else if(r.data[i])lit++;}return {width:r.width,height:r.height,hash,alpha,lit};},lose(){renderer.lose();},place(...args){const ok=!!sim.fold_place(...args);renderer?.clear();return ok;}};
 apply({});request();return api;
}
