import {createEngine} from './engine.js';
import {PRESETS} from './stats.js';
import {parseFixture,loadFixtures,storeFixtures} from './fixtures.js';
const $=id=>document.getElementById(id),canvas=$('scene'),controls=$('controls'),parameters=new URLSearchParams(location.search);
const bindings={KeyW:1,KeyS:2,KeyA:4,KeyD:8,Space:16,ControlLeft:32,ControlRight:32,ShiftLeft:64,ShiftRight:64};
let app,attempt,disposed=false,keys=0,fixtures=loadFixtures(),suite=null,reports=[];
function settings(){return {profile:+$('profile').value,lights:+$('lights').value,density:+$('density').value,detail:+$('detail').value};}
function applySettings(value){for(const key of ['profile','lights','density','detail'])$(key).value=value[key];}
function state(value){
  if(value==='ready'){$('status').hidden=true;$('gate').hidden=!controls.hidden;$('generate').disabled=false;}
  if(value==='playing')$('gate').hidden=true;
  if(value==='unlocked'&&app?.ready)$('gate').hidden=!controls.hidden;
  if(value==='recovering'){$('status').hidden=false;$('message').textContent='Restoring the active arena…';}
  if(value==='restored')$('status').hidden=true;
  if(value==='generating'){$('activate').disabled=true;$('candidate-status').textContent='Preparing in a worker. The active arena is unchanged.';}
  if(value==='staged'){$('activate').disabled=false;$('progress').value=1;$('candidate-status').textContent='Validated and uploaded. Activate when ready.';}
  if(value==='activated'){$('activate').disabled=true;$('candidate-status').textContent='Rendering and physics switched to the validated arena.';}
  if(value==='cancelled'||value==='rejected'){$('activate').disabled=true;$('progress').value=0;}
}
async function boot(){
  if(suite)suite.cancelled=true;attempt?.abort();app?.destroy();app=null;attempt=new AbortController();$('status').hidden=false;$('retry').hidden=true;$('gate').hidden=true;$('generate').disabled=true;$('activate').disabled=true;
  try{
    app=await createEngine(canvas,{signal:attempt.signal,seed:parameters.has('seed')?+parameters.get('seed'):27011984,testing:parameters.has('test'),onState:state,onError:message=>{document.exitPointerLock?.();keys=0;$('status').hidden=false;$('message').textContent=message;$('retry').hidden=false;}});view();
  }catch(error){if(error.name!=='AbortError'&&!disposed){$('message').textContent=error.message;$('retry').hidden=false;}}
}
Object.defineProperty(window,'__ARENA_BENCHMARK',{get:()=>app});
async function enter(){if(!app?.ready)return;try{await canvas.requestPointerLock({unadjustedMovement:false});}catch{$('gate').hidden=false;$('gate').querySelector('.eyebrow').textContent='Mouse capture unavailable · H opens inspection tools';}}
function toggle(){controls.hidden=!controls.hidden;keys=0;app?.input(0);if(!controls.hidden){document.exitPointerLock?.();app?.play(false);$('gate').hidden=true;diagnostics();}else $('gate').hidden=!app?.ready;}
function returnToPlay(){controls.hidden=true;$('gate').hidden=false;void enter();}
function view(){
  app?.view({resolution:+$('resolution').value,collision:$('collision').checked,lightmap:$('lightmap').checked,atlas:$('atlas').checked,relief:+$('relief').value,movement:+$('movement').value,camera:+$('camera').value,workBudget:+$('budget').value});
  $('relief-value').value=(+$('relief').value).toFixed(2);$('budget-value').value=(+$('budget').value).toFixed(2)+' ms / frame';
}
async function generate(play=$('return-play').checked){
  const seed=+$('seed').value,workload=settings();
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(workload.lights)||workload.lights<1||workload.lights>64){$('candidate-status').textContent='Use a uint32 seed and 1–64 emitters.';return;}
  const promise=app?.generate(seed,+$('fault').value,workload);if(play)returnToPlay();
  const result=await promise;if(result&&!result.accepted)$('candidate-status').textContent=result.cancelled?'Preparation cancelled. Active arena preserved.':'Rejected: '+(result.messages?.join(', ')||result.error)+'. Active arena preserved.';diagnostics();return result;
}
function diagnostics(){
  if(!app||disposed||controls.hidden||document.hidden)return;const d=app.snapshot();if(d.disposed)return;
  const bytes=value=>(value/1048576).toFixed(1),ms=value=>Number(value||0).toFixed(2);
  $('diagnostics').textContent=[`Active ${PRESETS[d.profile]?.name} · seed ${d.seed}`,`${d.arenaWidth.toFixed(1)} m wide · ${d.cells} sectors · ${d.triangles} structural triangles`,
    `${d.vertices} surface vertices · ${d.lights} emitters · ${d.bvhNodes} BVH nodes`,`${Math.round(d.fps)} fps · frame p95/p99 ${ms(d.frameMs.p95)} / ${ms(d.frameMs.p99)} ms`,
    `Frame CPU median/p95/p99 ${ms(d.cpuMs.median)} / ${ms(d.cpuMs.p95)} / ${ms(d.cpuMs.p99)} ms`,
    d.gpuSceneMs===null?'GPU timestamps unavailable / warming up':`GPU scene ${ms(d.gpuSceneMs)} ms · display ${ms(d.gpuPresentMs)} ms`,
    `Next: ${d.preparation?d.preparation.phase+' · '+ms(d.preparation.elapsedMs)+' ms':d.phase}`,`Last activation ${ms(d.activationMs)} ms`,
    `Active build: generate ${ms(d.generationMs)} · validate ${ms(d.validationMs)} ms`,`Surfaces ${ms(d.surfaceMs)} · bake ${ms(d.bakeMs)} ms`,
    `Atlas ${d.atlasSize}² · ${(d.bakedTexels/(d.atlasSize*d.atlasSize)*100).toFixed(1)}% occupied`,`${d.bakedTexels} luxels · ${d.visibilityRays} visibility rays · ${d.visibilitySteps} grid steps`,
    `Validation ${d.intersectionPairs} candidate pairs · unmatched ${d.unmatchedEdges} · nonmanifold ${d.nonmanifoldEdges}`,
    `WASM ${bytes(d.wasmMemoryBytes)} MiB active · owned estimate ${bytes(d.ownedMemoryEstimate)} MiB`,
    `Peak owned estimate ${bytes(d.peakOwnedMemoryEstimate)} MiB · GPU arena ${bytes(d.gpuMeshBytes||0)} MiB`,
    `GPU staged ${bytes(d.stagedGpuBytes||0)} MiB · targets ~${bytes(d.targetBytes||0)} MiB`,
    `Position ${d.position.map(x=>x.toFixed(2)).join(', ')} · ${d.movementProfile?'Quake reference':'baseline'} movement`,
    `${d.renderSize?.join(' × ')} internal · ${d.version}`].join('\n');
  if(d.preparation){$('candidate-status').textContent=d.preparation.phase+' · active gameplay continues';$('progress').value=({generating:.1,validating:.25,surfaces:.4,baking:.55,transferring:.65,copying:.7,uploading:.85})[d.preparation.phase]||0;}
  $('route-status').textContent=d.route.recording?`Recording · ${d.route.steps} input frames`:d.route.replaying?`Replaying · ${d.route.index}/${d.route.steps}`:`Saved route · ${d.route.steps} input frames`;
}
function refreshFixtures(){const select=$('fixtures');select.replaceChildren(new Option('Choose fixture…',''));fixtures.forEach((f,i)=>select.add(new Option(f.name,String(i))));}
function currentFixture(){return parseFixture({version:1,name:$('fixture-name').value.trim()||`Arena ${$('seed').value}`,seed:+$('seed').value,settings:settings(),movement:+$('movement').value});}
function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function loadFixture(f){applySettings(f.settings);$('seed').value=f.seed;$('movement').value=f.movement;$('fixture-name').value=f.name;view();$('fixture-status').textContent='Settings loaded. Prepare to build this fixture.';}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runSuite(){
  if(suite||!app?.ready)return;const run={cancelled:false};suite=run;reports=[];returnToPlay();$('run-suite').disabled=true;
  try{
    const baseSeed=+$('seed').value>>>0;
    for(const preset of PRESETS){
      if(run.cancelled)break;applySettings(preset);$('seed').value=baseSeed;$('fault').value='0';$('suite-status').textContent='Preparing '+preset.name;
      const preparation=await app.generate(baseSeed,0,preset);if(run.cancelled)break;if(!preparation.accepted)throw new Error(preparation.messages?.join(', ')||preparation.error);
      app.activate();while(!run.cancelled&&app.snapshot().staged)await delay(16);if(run.cancelled)break;
      app.resetMeasurements();const start=performance.now();while(!run.cancelled&&performance.now()-start<2000)await delay(100);
      const steady=app.snapshot();reports.push({preset,seed:baseSeed,preparation,steady});$('suite-status').textContent=`${reports.length}/3 complete · ${Math.round(steady.fps)} fps`;
    }
    $('suite-status').textContent=run.cancelled?'Suite stopped. Active arena preserved.':`Suite complete · ${reports.length} workloads. Export the report for comparison.`;
  }catch(error){$('suite-status').textContent='Suite stopped: '+error.message;}
  finally{if(suite===run)suite=null;$('run-suite').disabled=false;}
}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('feedback').textContent='Fullscreen is unavailable.';}}
$('enter').onclick=enter;canvas.onclick=()=>{if(controls.hidden)void enter();};$('close').onclick=toggle;$('retry').onclick=boot;
$('profile').onchange=()=>applySettings(PRESETS[+$('profile').value]);$('generate').onclick=()=>generate();$('randomize').onclick=()=>{$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];void generate();};
$('cancel').onclick=()=>app?.cancel();$('activate').onclick=()=>app?.activate();
for(const id of ['resolution','collision','lightmap','atlas','relief','movement','camera','budget'])$(id).oninput=view;
$('reset-player').onclick=()=>app?.resetPlayer();$('fullscreen').onclick=fullscreen;$('reset-metrics').onclick=()=>app?.resetMeasurements();
$('record-route').onclick=()=>{app?.route('record');$('camera').value='0';returnToPlay();};$('stop-route').onclick=()=>app?.route('stop');$('play-route').onclick=()=>{if(app?.route('play')){$('camera').value='0';$('movement').value=app.snapshot().movementProfile;returnToPlay();}else $('route-status').textContent='Record a route in this exact arena first.';};
$('save-fixture').onclick=()=>{try{const f=currentFixture();fixtures=fixtures.filter(x=>x.name!==f.name);fixtures.push(f);storeFixtures(fixtures);refreshFixtures();$('fixture-status').textContent='Fixture saved in this browser.';}catch(error){$('fixture-status').textContent=error.message;}};
$('load-fixture').onclick=()=>{if($('fixtures').value!=='')loadFixture(fixtures[+$('fixtures').value]);};
$('delete-fixture').onclick=()=>{if($('fixtures').value==='')return;try{fixtures.splice(+$('fixtures').value,1);storeFixtures(fixtures);refreshFixtures();}catch(error){$('fixture-status').textContent=error.message;}};
$('export-fixture').onclick=()=>{try{download(currentFixture(),'eigengott-arena-fixture.json');}catch(error){$('fixture-status').textContent=error.message;}};
$('import-fixture').onclick=()=>$('fixture-file').click();$('fixture-file').onchange=async()=>{try{const file=$('fixture-file').files[0];if(!file)return;if(file.size>16384)throw new Error('Fixture file exceeds 16 KiB.');loadFixture(parseFixture(JSON.parse(await file.text())));}catch(error){$('fixture-status').textContent=error.message;}finally{$('fixture-file').value='';}};
$('run-suite').onclick=runSuite;$('stop-suite').onclick=()=>{if(suite)suite.cancelled=true;app?.cancel();};
$('export-report').onclick=()=>download({version:1,createdAt:new Date().toISOString(),browser:navigator.userAgent,reports,current:app?.snapshot()},'eigengott-arena-benchmark.json');
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(app?.snapshot(),null,2));$('feedback').textContent='Diagnostics copied.';}catch{$('feedback').textContent='Clipboard is unavailable.';}};
document.addEventListener('pointerlockchange',()=>{keys=0;app?.input(0);app?.play(document.pointerLockElement===canvas);});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas)app?.input(keys,e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{
  if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(!e.repeat&&e.key.toLowerCase()==='h'){e.preventDefault();toggle();return;}
  if(!e.repeat&&e.key.toLowerCase()==='f'){e.preventDefault();void fullscreen();return;}
  if(!e.repeat&&e.key.toLowerCase()==='n'&&app?.playing){e.preventDefault();$('seed').value=((+$('seed').value+1)>>>0);void generate(false);return;}
  if(document.pointerLockElement===canvas&&bindings[e.code]){e.preventDefault();keys|=bindings[e.code];app?.input(keys);}
});
document.addEventListener('keyup',e=>{if(bindings[e.code]){keys&=~bindings[e.code];app?.input(keys);}});
window.addEventListener('blur',()=>{keys=0;app?.input(0);});
const timer=setInterval(diagnostics,500);
window.addEventListener('pagehide',e=>{if(!e.persisted){disposed=true;if(suite)suite.cancelled=true;clearInterval(timer);attempt?.abort();app?.destroy();}});
refreshFixtures();void boot();
