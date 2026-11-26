import {createEngine,DEFAULTS} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=$('controls');
const bindings={KeyW:1,KeyS:2,KeyA:4,KeyD:8,Space:16,ShiftLeft:32,ShiftRight:32};
let app,keys=0,attempt,disposed=false;
const checkKeys=['geometry','loop','openingFollow','feedback','feedbackFreeze','worldAnchor','monoWorld','monoVoid','showBody'];
const valueKeys=['duration','margin','opening','style','halfLife','stretch','branch','grid','pitch','lineWidth','seed','camera','inspection','resolution','dpr'];
function sync(){if(!app)return;const s=app.snapshot();for(const key of checkKeys)$(key).checked=s.settings[key];for(const key of valueKeys)$(key).value=s.settings[key];$('colliders').checked=!!(s.settings.debug&1);$('protection').checked=!!(s.settings.debug&2);diagnostics();}
function configure(){if(!app)return;const s={};for(const key of checkKeys)s[key]=$(key).checked;for(const key of valueKeys)s[key]=+$(key).value;s.debug=(+$('colliders').checked)|((+$('protection').checked)<<1);app.configure(s);diagnostics();}
function diagnostics(){
 if(!app||controls.hidden)return;const d=app.snapshot(),f=d.fold;
 if(document.activeElement!==$('phase'))$('phase').value=f.phase;
 $('phase-value').value=f.phase.toFixed(3);$('opening-value').value=d.settings.opening.toFixed(2);$('branch-value').value=d.settings.branch.toFixed(2);
 $('pause').textContent=f.playing?'Pause':'Resume';$('guard').textContent=f.blockedPanels?`HOLD · ${f.blockedBy===2?'weapon':f.blockedBy===1?'body':'body + weapon'} · panels ${f.blockedPanels.toString(2).padStart(4,'0')}`:'CLEAR · outer enclosure sealed';
 $('diagnostics').textContent=`${f.clear&&f.sealed&&f.bounded?'PASS':'FAIL'} · body / weapon / enclosure\nPhase ${f.phase.toFixed(4)} → ${f.target.toFixed(0)} · ${f.physicsSteps} physics steps\nPlayer [${f.position.map(x=>x.toFixed(2)).join(', ')}]\nMoving clearance: body ${f.bodyClearance.toFixed(3)} m / gun ${f.weaponClearance.toFixed(3)} m\nGuards ${f.checks} · held ${f.rejections} · subdivision ${f.deepestSubdivision}\n${d.fps.toFixed(1)} fps · CPU p50 ${d.cpuMs.p50.toFixed(2)} / p95 ${d.cpuMs.p95.toFixed(2)} ms\nGPU ${d.render?.gpuMs?d.render.gpuMs.total.toFixed(2)+' ms (sampled)':'timing unavailable / pending'}\nRender ${d.render?.resolution.join('×')} → ${d.render?.output.join('×')}\nWASM ${(d.wasmBytes/1048576).toFixed(1)} MiB · targets ${((d.render?.renderTargetBytes||0)/1048576).toFixed(1)} MiB\nGPU recoveries ${d.recoveries}${d.recovering?' · recovering':''}`;
}
async function boot(){
 attempt?.abort();app?.destroy();app=null;attempt=new AbortController();const current=attempt;
 $('status').hidden=false;$('retry').hidden=true;$('gate').hidden=true;$('message').textContent='Preparing the protected chamber…';
 try{const next=await createEngine(canvas,{signal:current.signal,onState:diagnostics,onError:message=>{$('message').textContent=message;$('status').hidden=false;$('retry').hidden=false;}});if(current!==attempt||disposed){next.destroy();return;}app=next;if(new URLSearchParams(location.search).has('test'))window.__fold=app;$('status').hidden=true;$('gate').hidden=!controls.hidden;sync();}
 catch(error){if(current!==attempt||disposed)return;$('message').textContent=error.message;$('retry').hidden=false;}
}
function showTools(show){controls.hidden=!show;keys=0;app?.input(0);app?.play(false);if(show){document.exitPointerLock?.();$('gate').hidden=true;sync();}else $('gate').hidden=!app;}
async function enter(){if(!app)return;if(!canvas.requestPointerLock){showTools(true);$('feedback-message').textContent='Pointer Lock is unavailable here. Inspection tools remain usable.';return;}try{await canvas.requestPointerLock();$('gate').hidden=true;}catch{showTools(true);$('feedback-message').textContent='Mouse capture was denied. Inspection tools remain usable.';}}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('feedback-message').textContent='Fullscreen is unavailable.';}}
for(const key of [...checkKeys,...valueKeys,'colliders','protection'])$(key).oninput=configure;
$('phase').oninput=()=>app?.seek(+$('phase').value);$('trigger').onclick=()=>app?.trigger();$('pause').onclick=()=>app?.pause();$('step-back').onclick=()=>app?.step(-1);$('step-forward').onclick=()=>app?.step(1);
for(const [id,scenario]of [['reset',0],['weapon-fixture',1],['body-fixture',2]])$(id).onclick=()=>{app?.reset(scenario);sync();};
$('clear-history').onclick=()=>app?.clearHistory();$('defaults').onclick=()=>{app?.configure({...DEFAULTS});app?.reset();sync();};
$('enter').onclick=enter;$('inspect').onclick=()=>showTools(true);$('close').onclick=()=>showTools(false);$('retry').onclick=boot;$('fullscreen').onclick=fullscreen;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(app?.snapshot(),null,2));$('feedback-message').textContent='Diagnostics copied.';}catch{$('feedback-message').textContent='Clipboard is unavailable.';}};
canvas.onclick=()=>{if(controls.hidden)void enter();};
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;keys=0;app?.play(locked);if(locked){controls.hidden=true;$('gate').hidden=true;}else if(controls.hidden)$('gate').hidden=!app;});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas)app?.input(keys,e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{
 if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 if(!e.repeat&&e.key.toLowerCase()==='h'){e.preventDefault();showTools(controls.hidden);return;}
 if(!e.repeat&&e.key.toLowerCase()==='f'){e.preventDefault();void fullscreen();return;}
 if(!e.repeat&&e.key.toLowerCase()==='n'){e.preventDefault();app?.trigger();return;}
 if(document.pointerLockElement===canvas&&bindings[e.code]){e.preventDefault();keys|=bindings[e.code];app?.input(keys);}
});
document.addEventListener('keyup',e=>{if(bindings[e.code]){keys&=~bindings[e.code];app?.input(keys);}});window.addEventListener('blur',()=>{keys=0;app?.input(0);});
const timer=setInterval(diagnostics,250);window.addEventListener('pagehide',e=>{if(!e.persisted){disposed=true;clearInterval(timer);attempt?.abort();app?.destroy();}});
void boot();
