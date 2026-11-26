import {createDOSMaze} from './runtime.js';
import {PROFILE,VERSION,BUILD} from './profile.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=$('controls');
const key='eigengott-dos-maze-v1-options';let api,attempt,disposed=false;
let preferences={timeScale:1,quality:{dprCap:PROFILE.dprCap,antialias:PROFILE.antialias}};
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&typeof saved==='object')preferences={...preferences,...saved};}catch{}
const params=new URLSearchParams(location.search);
function save(){if(!api)return;preferences={timeScale:api.timeScale,quality:api.quality};try{localStorage.setItem(key,JSON.stringify(preferences));}catch{$('feedback').textContent='Browser options cannot be saved on this device.';}}
function sync(){
  if(!api)return;$('pause').textContent=api.paused?'Resume':'Pause';$('speed').value=api.timeScale;$('speed-value').value='×'+api.timeScale.toFixed(2);
  const q=api.quality;$('ratio').value=q.dprCap;$('ratio-value').value=q.dprCap.toFixed(2);$('antialias').checked=q.antialias;
}
function diagnostics(){
  if(!api||controls.hidden||document.hidden)return;const d=api.snapshot();
  $('diagnostics').textContent=[`v${d.version} · ${d.build}`,`${d.paused?'Paused':d.recovering?'Recovering':Math.round(d.fps)+' fps'} · state ${d.state.toFixed(3)}`,
    `${d.renderSize?.join(' × ')||'—'} · ${d.samples||0}× samples`,`${d.segmentCount.toLocaleString()} maze walls · ${d.passes||0} passes`,
    `CPU median / p95: ${d.cpuMs.median.toFixed(2)} / ${d.cpuMs.p95.toFixed(2)} ms`,`Last generation: ${d.geometryMs.toFixed(2)} ms`,
    `WASM: ${(d.wasmMemoryBytes/1048576).toFixed(0)} MiB`,`GPU buffers: ${((d.gpuBufferBytes||0)/1048576).toFixed(2)} MiB`,
    `First frame: ${d.firstPaintMs.toFixed(0)} ms`,`Device recoveries: ${d.recoveries}`,...(d.overflow?['Wall capacity reached.']:[]),...(d.error?[d.error]:[])].join('\n');
}
function toggle(){controls.hidden=!controls.hidden;if(!controls.hidden){sync();diagnostics();}}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('feedback').textContent='Fullscreen is unavailable in this browser.';}}
async function boot(){
  attempt?.abort();api?.destroy();api=null;attempt=new AbortController();
  $('status').hidden=false;$('retry').hidden=true;$('message').textContent='Starting DOS-maze…';
  try{
    api=await createDOSMaze(canvas,{signal:attempt.signal,quality:preferences.quality,timeScale:preferences.timeScale,
      paused:params.has('paused'),time:+params.get('time')||0,state:params.has('state')?+params.get('state'):null,flicker:params.get('flicker')!=='off',testing:params.has('test'),
      onState:state=>{if(state==='running')$('status').hidden=true;else if(state==='recovering'){$('status').hidden=false;$('message').textContent='Restoring graphics…';}},
      onError:message=>{$('status').hidden=false;$('message').textContent=message;$('retry').hidden=false;},
    });
    sync();
  }catch(error){if(error.name!=='AbortError'&&!disposed){$('message').textContent=error.message;$('retry').hidden=false;}}
}
Object.defineProperty(window,'__DOS_MAZE',{get:()=>api});
$('version').textContent=`v${VERSION} · ${BUILD}`;
$('retry').onclick=boot;$('close').onclick=()=>controls.hidden=true;
$('pause').onclick=()=>{api?.toggle();sync();diagnostics();};$('step').onclick=()=>{api?.step();sync();};$('restart').onclick=()=>api?.restart();
$('fullscreen').onclick=fullscreen;
$('speed').oninput=event=>{api?.setTimeScale(+event.target.value);sync();save();};
function quality(){api?.setQuality({dprCap:+$('ratio').value,antialias:$('antialias').checked});sync();save();}
$('ratio').oninput=quality;$('antialias').oninput=quality;
$('reset-quality').onclick=()=>{api?.setQuality({dprCap:PROFILE.dprCap,antialias:PROFILE.antialias});sync();save();};
$('copy-diagnostics').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(api?.snapshot(),null,2));$('feedback').textContent='Diagnostics copied.';}catch{$('feedback').textContent='Clipboard unavailable. Diagnostics are shown above.';}};
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){controls.hidden=true;return;}
  if(event.repeat||/SELECT|TEXTAREA/.test(event.target.tagName)||(event.target.tagName==='INPUT'&&!['range','checkbox'].includes(event.target.type)))return;
  const k=event.key.toLowerCase();
  if(k==='h'||k==='`'){event.preventDefault();toggle();}
  else if(k===' '&&event.target.type!=='checkbox'){event.preventDefault();api?.toggle();sync();diagnostics();}
  else if(k==='r'){event.preventDefault();api?.restart();}
  else if(k==='f'){event.preventDefault();void fullscreen();}
});
canvas.addEventListener('touchstart',event=>{if(event.touches.length===3){event.preventDefault();toggle();}},{passive:false});
const timer=setInterval(diagnostics,1000);
window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;clearInterval(timer);attempt?.abort();api?.destroy();}});
void boot();
