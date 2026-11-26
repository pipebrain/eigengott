import {createEngine} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=$('controls');
let app,attempt,disposed=false,keys=0;const bindings={KeyW:1,KeyS:2,KeyA:4,KeyD:8,Space:16};
const parameters=new URLSearchParams(location.search);
function state(value){
  if(value==='ready'){$('status').hidden=true;$('gate').hidden=!controls.hidden;if(app)$('seed').value=app.snapshot().seed;}
  if(value==='playing')$('gate').hidden=true;
  if(value==='unlocked'&&app?.ready)$('gate').hidden=!controls.hidden;
  if(value==='recovering'){$('status').hidden=false;$('message').textContent='Restoring the graphics device…';$('activate').disabled=true;$('generate').disabled=true;$('randomize').disabled=true;}
  if(value==='restored'){$('status').hidden=true;$('generate').disabled=false;$('randomize').disabled=false;$('generation-status').textContent='Current arena restored. Generate a new candidate to stage another replacement.';}
  if(value==='activated'){$('generation-status').textContent='Validated arena activated. Rendering and collision switched together.';$('activate').disabled=true;}
  if(value==='generating'){$('generate').disabled=true;$('randomize').disabled=true;$('activate').disabled=true;$('generation-status').textContent='Constructing, binding, and checking candidate…';}
  if(value==='staged'){$('generation-status').textContent='Candidate passed validation and its graphics resources are staged. Activate when ready.';$('activate').disabled=false;}
  if(value==='rejected'){$('generation-status').textContent='Candidate rejected. The current arena is preserved.';$('activate').disabled=true;}
  if(value==='staged'||value==='rejected'||value==='activated'){$('generate').disabled=false;$('randomize').disabled=false;}
}
async function boot(){
  attempt?.abort();app?.destroy();app=null;attempt=new AbortController();$('status').hidden=false;$('retry').hidden=true;$('gate').hidden=true;$('generate').disabled=true;$('randomize').disabled=true;$('activate').disabled=true;$('message').textContent='Constructing and checking the arena…';
  try{app=await createEngine(canvas,{signal:attempt.signal,seed:parameters.has('seed')?+parameters.get('seed'):27011984,testing:parameters.has('test'),onState:state,onError:message=>{document.exitPointerLock?.();keys=0;$('status').hidden=false;$('message').textContent=message;$('retry').hidden=false;}});view();}
  catch(error){if(error.name!=='AbortError'&&!disposed){$('message').textContent=error.message;$('retry').hidden=false;}}
}
Object.defineProperty(window,'__ENGINE_TEST',{get:()=>app});
async function enter(){try{await canvas.requestPointerLock({unadjustedMovement:false});}catch{$('gate').hidden=false;$('gate').querySelector('.eyebrow').textContent=typeof canvas.requestPointerLock==='function'?'Mouse capture declined · click Enter arena to retry':'Mouse capture unavailable · use H for scene inspection';}}
function toggle(){
  controls.hidden=!controls.hidden;keys=0;app?.input(0);
  if(!controls.hidden){document.exitPointerLock?.();app?.play(false);$('gate').hidden=true;diagnostics();}
  else $('gate').hidden=!app?.ready;
}
function diagnostics(){
  if(!app||controls.hidden||document.hidden)return;const d=app.snapshot();if(d.disposed)return;
  $('diagnostics').textContent=[`Seed ${d.seed} · arena ${d.activeId}`,`${Math.round(d.fps)} fps · CPU ${d.cpuMs.median.toFixed(2)} / ${d.cpuMs.p95.toFixed(2)} ms (median / p95)`,
    `${d.renderSize?.join(' × ')} internal · ${d.passes} passes`,d.gpuSceneMs===null?'GPU timestamps unavailable / warming up':`GPU scene ${d.gpuSceneMs.toFixed(3)} ms · display ${d.gpuPresentMs.toFixed(3)} ms`,`${d.cells} open cells · ${d.triangles} structural triangles`,`${d.vertices} surface vertices · ${d.lights} emitters`,
    `Candidate: ${d.candidateMessages.length?d.candidateMessages.join(', '):'valid'}`,`Unmatched ${d.unmatchedEdges} · nonmanifold ${d.nonmanifoldEdges} · components ${d.components}`,
    `Generation ${d.generationMs.toFixed(2)} ms · validation ${d.validationMs.toFixed(2)} ms`,`Surfaces ${d.surfaceMs.toFixed(2)} ms · bake ${d.bakeMs.toFixed(2)} ms`,
    `Position ${d.position.map(x=>x.toFixed(2)).join(', ')}`,`120 Hz steps ${d.physicsSteps} · contacts ${d.collisionHits}`,`WASM ${(d.wasmMemoryBytes/1048576).toFixed(0)} MiB · GPU arena ${((d.gpuMeshBytes||0)/1048576).toFixed(2)} MiB`,
    `First frame ${d.firstPaintMs.toFixed(0)} ms · recoveries ${d.recoveries}`,...(d.lastResult?.error?[d.lastResult.error]:[])].join('\n');
}
async function generate(){const seed=Number($('seed').value);if(!Number.isInteger(seed)||seed<0||seed>0xffffffff){$('generation-status').textContent='Use a whole-number seed between 0 and 4294967295.';return;}const result=await app?.generate(seed,+$('fault').value);if(result&&!result.accepted)$('generation-status').textContent='Rejected: '+(result.messages?.join(', ')||result.error||'superseded candidate')+'. Current arena preserved.';diagnostics();}
function view(){app?.view({resolution:+$('resolution').value,collision:$('collision').checked,relief:+$('relief').value,lightmap:$('lightmap').checked});$('relief-value').value=(+$('relief').value).toFixed(2);}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('feedback').textContent='Fullscreen is unavailable.';}}
$('enter').onclick=enter;canvas.onclick=()=>{if(controls.hidden&&app?.ready)void enter();};$('retry').onclick=boot;$('close').onclick=toggle;
$('generate').onclick=generate;$('randomize').onclick=()=>{$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];void generate();};$('activate').onclick=()=>app?.activate();
for(const id of ['resolution','collision','relief','lightmap'])$(id).oninput=view;
$('reset-player').onclick=()=>app?.resetPlayer();$('fullscreen').onclick=fullscreen;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(app?.snapshot(),null,2));$('feedback').textContent='Diagnostics copied.';}catch{$('feedback').textContent='Clipboard is unavailable.';}};
document.addEventListener('pointerlockchange',()=>{keys=0;app?.input(0);app?.play(document.pointerLockElement===canvas);});
document.addEventListener('mousemove',event=>{if(document.pointerLockElement===canvas)app?.input(keys,event.movementX,event.movementY);});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!controls.hidden){toggle();return;}
  const editing=/INPUT|SELECT|TEXTAREA/.test(event.target.tagName);if(editing)return;
  if(!event.repeat&&(event.key.toLowerCase()==='h'||event.key==='`')){event.preventDefault();toggle();return;}
  if(!event.repeat&&event.key.toLowerCase()==='f'){event.preventDefault();void fullscreen();return;}
  if(document.pointerLockElement===canvas&&bindings[event.code]){event.preventDefault();keys|=bindings[event.code];app?.input(keys);}
});
document.addEventListener('keyup',event=>{if(bindings[event.code]){keys&=~bindings[event.code];app?.input(keys);}});
window.addEventListener('blur',()=>{keys=0;app?.input(0);});
const timer=setInterval(diagnostics,1000);
window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;clearInterval(timer);attempt?.abort();app?.destroy();}});
void boot();
