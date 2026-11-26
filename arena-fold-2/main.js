import {createEngine,DEFAULTS} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=$('controls');
const bindings={KeyW:1,KeyS:2,KeyA:4,KeyD:8,Space:16,ShiftLeft:32,ShiftRight:32};
let app,keys=0,attempt,disposed=false;
const checkKeys=['waves','loop','stageBodies','showCorpses','showBody','cutaway','feedback','feedbackFreeze','worldAnchor','monoWorld','monoVoid'];
const valueKeys=['interval','tail','roots','spread','delay','depth','jitter','seed','slotDuration','hz','blank','margin','coherence','camera','style','halfLife','stretch','branch','grid','pitch','lineWidth','inspection','resolution','dpr'];
for(let row=4;row>=0;row--)for(let col=0;col<4;col++){const cell=document.createElement('div');cell.id='sector-'+(row*4+col);cell.className='sector';$('sectors').append(cell);}
function sync(){if(!app)return;const d=app.snapshot();for(const key of checkKeys)$(key).checked=d.settings[key];for(const key of valueKeys)$(key).value=d.settings[key];$('colliders').checked=!!(d.settings.debug&1);$('protection').checked=!!(d.settings.debug&2);$('sector-bounds').checked=!!(d.settings.debug&4);diagnostics();}
function configure(){if(!app)return;const s={};for(const key of checkKeys)s[key]=$(key).checked;for(const key of valueKeys)s[key]=+$(key).value;s.debug=+$('colliders').checked|((+$('protection').checked)<<1)|((+$('sector-bounds').checked)<<2);app.configure(s);diagnostics();}
function diagnostics(){
 if(!app||controls.hidden)return;const d=app.snapshot(),w=d.wave;
 for(const key of ['spread','jitter','blank','coherence','branch'])$(key+'-value').value=d.settings[key].toFixed(2);
 $('trigger').disabled=w.active;$('pause').disabled=!w.active;$('step').disabled=!w.active||w.playing;$('pause').textContent=w.playing?'Pause wave':'Resume wave';
 $('wave-state').textContent=`${w.active?(w.playing?'CORRUPTION ACTIVE':'WAVE PAUSED'):'SETTLED'} · ${w.bodies?'body fixtures remain':'all old bodies cleared'} · wave ${w.cycle}`;
 $('effective').textContent=`Next roots: ${d.settings.coherence===1?0:Math.ceil(d.settings.roots*(1-d.settings.coherence))} · effective neighbour chance ${(w.effectiveSpread*100).toFixed(1)}%`;
 for(const s of d.sectors){const cell=$('sector-'+s.id);cell.dataset.state=s.state;cell.dataset.root=+s.instigator;cell.textContent=`${String(s.id).padStart(2,'0')} / ${s.age}`;cell.title=`Sector ${s.id}: layout ${s.variant}, preview ${s.visible}, parent ${s.parent}, depth ${s.depth}, epoch ${s.epoch}${s.protectedBy?', protected '+s.protectedBy:''}`;}
 $('diagnostics').textContent=`${w.clear&&w.sealed&&w.catalogValid?'PASS':'FAIL'} · player / seal / catalogue\nWave ${w.cycle} · completed ${w.completed} · ${w.waveTime.toFixed(2)} s\nVisited ${w.visited}/20 · changed ${w.changed} · protected ${w.protected}\nPending ${w.pending} · flickering ${w.flickering} · roots ${w.instigators}\nOldest sector age ${w.oldestAge} · body cleanups ${w.bodyClears}\nPreview slots ${w.previews} · protected auditions ${w.previewBlocks}\nPlayer [${w.position.map(x=>x.toFixed(2)).join(', ')}]\n${d.fps.toFixed(1)} fps · CPU p50 ${d.cpuMs.p50.toFixed(2)} / p95 ${d.cpuMs.p95.toFixed(2)} ms\nGPU ${d.render?.gpuMs?d.render.gpuMs.total.toFixed(2)+' ms (sampled)':'timing unavailable / pending'}\nRender ${d.render?.resolution.join('×')} → ${d.render?.output.join('×')}\nWASM ${(d.wasmBytes/1048576).toFixed(1)} MiB · targets ${((d.render?.renderTargetBytes||0)/1048576).toFixed(1)} MiB\nMesh revision ${w.meshRevision} · upload ${d.render?.uploadsPerFrame} bytes\nGPU recoveries ${d.recoveries}`;
}
async function boot(){
 attempt?.abort();app?.destroy();app=null;attempt=new AbortController();const current=attempt;$('status').hidden=false;$('retry').hidden=true;$('gate').hidden=true;$('message').textContent='Preparing fixed sector layouts…';
 try{const next=await createEngine(canvas,{signal:current.signal,onState:diagnostics,onError:message=>{$('message').textContent=message;$('status').hidden=false;$('retry').hidden=false;}});if(current!==attempt||disposed){next.destroy();return;}app=next;if(new URLSearchParams(location.search).has('test'))window.__wave=app;$('status').hidden=true;$('gate').hidden=!controls.hidden;sync();}
 catch(error){if(current!==attempt||disposed)return;$('message').textContent=error.message;$('retry').hidden=false;}
}
function showTools(show){controls.hidden=!show;keys=0;app?.input(0);app?.play(false);if(show){document.exitPointerLock?.();$('gate').hidden=true;sync();}else $('gate').hidden=!app;}
async function enter(){if(!app)return;if(!canvas.requestPointerLock){showTools(true);$('feedback-message').textContent='Pointer Lock is unavailable here. Inspection tools remain usable.';return;}try{await canvas.requestPointerLock();$('gate').hidden=true;}catch{showTools(true);$('feedback-message').textContent='Mouse capture was denied. Inspection tools remain usable.';}}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('feedback-message').textContent='Fullscreen is unavailable.';}}
for(const key of [...checkKeys,...valueKeys,'colliders','protection','sector-bounds'])$(key).oninput=configure;
$('trigger').onclick=()=>app?.trigger();$('pause').onclick=()=>app?.pause();$('step').onclick=()=>app?.step();$('stage-bodies').onclick=()=>app?.stageBodies();$('reset').onclick=()=>{app?.reset();sync();};
$('body-guard').onclick=()=>{app?.fixture(0);sync();};$('weapon-guard').onclick=()=>{app?.fixture(1);sync();};
for(const [id,coherence]of [['chaotic',0],['late-game',.9],['static',1]])$(id).onclick=()=>{app?.configure({coherence});sync();};
$('clear-history').onclick=()=>app?.clearHistory();$('defaults').onclick=()=>{app?.configure({...DEFAULTS});app?.reset();sync();};$('enter').onclick=enter;$('inspect').onclick=()=>showTools(true);$('close').onclick=()=>showTools(false);$('retry').onclick=boot;$('fullscreen').onclick=fullscreen;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(app?.snapshot(),null,2));$('feedback-message').textContent='Diagnostics copied.';}catch{$('feedback-message').textContent='Clipboard is unavailable.';}};
canvas.onclick=()=>{if(controls.hidden)void enter();};
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;keys=0;app?.play(locked);if(locked){controls.hidden=true;$('gate').hidden=true;}else if(controls.hidden)$('gate').hidden=!app;});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas)app?.input(keys,e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(!e.repeat&&e.key.toLowerCase()==='h'){e.preventDefault();showTools(controls.hidden);return;}if(!e.repeat&&e.key.toLowerCase()==='f'){e.preventDefault();void fullscreen();return;}if(!e.repeat&&e.key.toLowerCase()==='n'){e.preventDefault();app?.trigger();return;}if(document.pointerLockElement===canvas&&bindings[e.code]){e.preventDefault();keys|=bindings[e.code];app?.input(keys);}});
document.addEventListener('keyup',e=>{if(bindings[e.code]){keys&=~bindings[e.code];app?.input(keys);}});window.addEventListener('blur',()=>{keys=0;app?.input(0);});
const timer=setInterval(diagnostics,250);window.addEventListener('pagehide',e=>{if(!e.persisted){disposed=true;clearInterval(timer);attempt?.abort();app?.destroy();}});void boot();
