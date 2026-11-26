import {createRenderer} from './renderer.js';
import {imports,readStats} from './stats.js';
export const DEFAULTS=Object.freeze({geometry:true,loop:false,duration:4,margin:.2,openingFollow:true,opening:.78,feedback:true,feedbackFreeze:false,halfLife:2.4,stretch:2,worldAnchor:true,style:0,pitch:9,lineWidth:1,branch:.5,grid:1,monoWorld:false,monoVoid:true,seed:17,inspection:0,resolution:360,dpr:1,showBody:true,camera:0,debug:0});
export async function createEngine(canvas,options={}){
 const response=await fetch(new URL('fold.wasm',import.meta.url),{signal:options.signal});if(!response.ok)throw new Error('Fold WASM download failed.');
 const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),imports()),sim=instance.exports;sim.fold_init();
 if(sim.abi_version()!==1)throw new Error('Unexpected fold ABI.');
 let renderer,disposed=false,recovering=false,error=null,suspended=false,raf=0,last=0,frames=0,playerInput=false,bits=0,dx=0,dy=0,resizeDirty=true,ratio=0,feedbackTime=0;
 let settings={...DEFAULTS},cpu=[],fpsTimes=[],recoveries=0;
 const start=performance.now(),emit=()=>options.onState?.();
 const cancel=()=>{cancelAnimationFrame(raf);raf=0;};
 const request=()=>{if(!disposed&&!error&&!recovering&&!suspended&&!document.hidden&&!raf)raf=requestAnimationFrame(frame);};
 const fatal=cause=>{if(disposed)return;error=cause?.message||String(cause);cancel();renderer?.destroy();renderer=null;emit();options.onError?.(error);};
 async function lost(){
  if(disposed||recovering)return;recovering=true;recoveries++;cancel();renderer?.destroy();renderer=null;emit();
  try{renderer=await createRenderer(canvas,{onLost:lost,onError:fatal});if(disposed){renderer.destroy();return;}recovering=false;resizeDirty=true;last=0;emit();request();}catch(cause){recovering=false;fatal(cause);}
 }
 renderer=await createRenderer(canvas,{onLost:lost,onError:fatal});
 if(options.signal?.aborted){renderer.destroy();throw new DOMException('Cancelled','AbortError');}
 const resize=()=>{resizeDirty=true;request();};
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 const visibility=()=>{bits=0;dx=dy=0;last=0;if(document.hidden)cancel();else{renderer?.clear();request();}};document.addEventListener('visibilitychange',visibility);
 function apply(value){
  const old=settings;settings={...settings,...value};
  for(const [key,lo,hi]of [['duration',1,30],['margin',.05,.6],['opening',0,1],['halfLife',.05,12],['stretch',0,12],['pitch',3,40],['lineWidth',.5,4],['branch',0,1],['resolution',180,1080],['dpr',.5,2],['style',0,1],['inspection',0,3],['grid',0,2],['camera',0,2],['debug',0,3],['seed',0,999]])settings[key]=Number.isFinite(+settings[key])?Math.min(hi,Math.max(lo,+settings[key])):DEFAULTS[key];
  for(const key of ['geometry','loop','openingFollow','feedback','feedbackFreeze','worldAnchor','monoWorld','monoVoid','showBody'])settings[key]=!!settings[key];
  const d=readStats(sim);sim.fold_options(+settings.geometry,+d.playing,+settings.loop,settings.duration,settings.margin);sim.fold_debug(settings.debug);
  if(settings.camera!==old.camera){sim.fold_camera(settings.camera);renderer?.clear();bits=0;dx=dy=0;}
  if(['style','grid','seed','worldAnchor','feedback'].some(k=>settings[k]!==old[k]))renderer?.clear();
  if(settings.dpr!==old.dpr||settings.resolution!==old.resolution)resizeDirty=true;
  emit();request();return {...settings};
 }
 function size(){
  const rect=canvas.getBoundingClientRect();ratio=Math.min(devicePixelRatio||1,settings.dpr);
  canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
  const height=Math.max(1,Math.min(Math.round(settings.resolution),canvas.height)),width=Math.max(1,Math.round(height*canvas.width/canvas.height));
  renderer.resize(width,height);sim.fold_view(width,height);resizeDirty=false;
 }
 function render(dt){
  const d=readStats(sim);if(!settings.feedbackFreeze)feedbackTime+=dt;
  const envelope=d.phase>0&&d.phase<1?Math.sin(Math.PI*d.phase):0;
  const opening=settings.opening*(settings.openingFollow?envelope:1);
  return renderer.render(sim,{...settings,phase:d.phase,opening},dt,feedbackTime);
 }
 function frame(now){
  raf=0;if(disposed||error||recovering||document.hidden)return;
  if(renderer.busy){request();return;}
  const began=performance.now(),dt=last?Math.min(.1,(now-last)/1000):0;last=now;
  if(resizeDirty||ratio!==Math.min(devicePixelRatio||1,settings.dpr))size();
  sim.fold_tick(dt,playerInput?bits:0,playerInput?dx:0,playerInput?dy:0);dx=dy=0;render(dt);frames++;
  cpu.push(performance.now()-began);if(cpu.length>600)cpu.shift();if(dt>0){fpsTimes.push(dt);if(fpsTimes.length>120)fpsTimes.shift();}request();
 }
 const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:0;
 const snapshot=()=>({version:'arena-fold-1',build:globalThis.__EIGENGOTT_BUILD||null,ready:!!renderer&&!error&&!recovering,error,recovering,recoveries,frames,elapsedMs:performance.now()-start,wasmBytes:sim.memory.buffer.byteLength,settings:{...settings},fold:readStats(sim),render:renderer?.snapshot()||null,cpuMs:{p50:percentile(cpu,.5),p95:percentile(cpu,.95)},fps:fpsTimes.length?fpsTimes.length/fpsTimes.reduce((a,b)=>a+b,0):0,hidden:document.hidden});
 function reset(scenario=0){sim.fold_reset(scenario);settings.camera=0;bits=0;dx=dy=0;renderer?.clear();feedbackTime=0;last=0;emit();request();}
 const api={snapshot,configure:apply,input(input,x=0,y=0){bits=input&63;dx+=Number.isFinite(x)?x:0;dy+=Number.isFinite(y)?y:0;},play(value){playerInput=!!value;bits=0;dx=dy=0;},trigger(){const d=readStats(sim);sim.fold_trigger(d.target>.5?0:1);emit();request();},pause(){const d=readStats(sim);sim.fold_options(+settings.geometry,+!d.playing,+settings.loop,settings.duration,settings.margin);emit();},seek(phase){const accepted=!!sim.fold_seek(phase);sim.fold_options(+settings.geometry,0,+settings.loop,settings.duration,settings.margin);emit();request();return accepted;},step(direction=1){return api.seek(readStats(sim).phase+direction/120);},reset,clearHistory(){renderer?.clear();},destroy(){if(disposed)return;disposed=true;cancel();observer.disconnect();document.removeEventListener('visibilitychange',visibility);renderer?.destroy();renderer=null;},get playing(){return playerInput;}};
 if(new URLSearchParams(location.search).has('test'))api.test={sim,stop(){suspended=true;cancel();},resume(){suspended=false;last=0;request();},async render(dt=0){cancel();if(resizeDirty)size();render(dt);await new Promise(r=>setTimeout(r,0));return snapshot();},async history(){const r=await renderer.readHistory();let hash=2166136261,alpha=0,lit=0;for(const b of new Uint8Array(r.data.buffer))hash=Math.imul(hash^b,16777619)>>>0;for(let i=0;i<r.data.length;i++){if(i%4===3)alpha+=r.data[i];else if(r.data[i])lit++;}return {width:r.width,height:r.height,hash,alpha,lit};},lose(){renderer.lose();},place(...args){const ok=!!sim.fold_place(...args);renderer?.clear();return ok;}};
 apply({});request();return api;
}
