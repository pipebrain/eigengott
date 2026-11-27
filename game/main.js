import {createDOSMaze} from '../dos-maze/runtime.js';
import {PROFILE} from '../dos-maze/profile.js';
import {VERSION,PRESET} from './preset.js';
const screen=document.getElementById('title-screen'),canvas=document.getElementById('scene'),titleCanvas=document.getElementById('title-scene'),controller=new AbortController(),tools=new URLSearchParams(location.search).has('tools');
let maze=null,app=null,requested=tools,inputs=0,disposed=false,audioContext=null;
const launch=globalThis.__EIGENGOTT_LAUNCH={preset:PRESET,checkpointKey:`eigengott.game.v${VERSION}.checkpoint`,ready(api){app=api;if(requested)activate();else app.standby(true);}};
const inputTypes=['keydown','pointerdown','pointermove','wheel'];
function removeInputs(){for(const type of inputTypes)window.removeEventListener(type,start,true);}
function activate(){if(!app||disposed)return;app.standby(false);document.getElementById('gate').hidden=true;if(tools){document.getElementById('controls').hidden=false;return;}app.play(true);if(audioContext)void app.enableAudio(audioContext);}
function dismiss(){screen.hidden=true;document.body.dataset.menu='false';controller.abort();maze?.destroy();maze=null;}
function start(event){
 if(requested||!event.isTrusted||event.repeat||event.type==='pointermove'&&!event.movementX&&!event.movementY)return;
 requested=true;inputs++;if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();removeInputs();dismiss();
 // Capture and audio unlocking must happen in the original input gesture, even on a cold load.
 if(canvas.requestPointerLock)try{const p=canvas.requestPointerLock();p?.catch(()=>{});}catch{}
 if(app)void app.enableAudio();else try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(C){audioContext=new C();void audioContext.resume().catch(()=>{});}}catch{}
 activate();
}
for(const type of inputTypes)window.addEventListener(type,start,{capture:true,passive:false});
document.getElementById('release-version').textContent='v'+VERSION;
if(tools){removeInputs();dismiss();}else void createDOSMaze(titleCanvas,{signal:controller.signal,quality:{dprCap:PROFILE.dprCap,antialias:PROFILE.antialias},timeScale:PROFILE.timeScale,onError(message){if(!requested){const error=document.getElementById('title-error');error.textContent=message;error.hidden=false;}}}).then(api=>{if(requested||disposed)api.destroy();else maze=api;}).catch(error=>{if(error.name!=='AbortError'&&!requested){const message=document.getElementById('title-error');message.textContent=error.message;message.hidden=false;}});
// Gameplay prepares behind the title, then stands by until the first real input.
void import('../playable-test/main.js');
globalThis.__EIGENGOTT_GAME={version:VERSION,get app(){return app;},snapshot:()=>({version:VERSION,menu:!requested,inputs,menuRenderer:maze?.snapshot()||null,game:app?.snapshot()||null})};
window.addEventListener('pagehide',event=>{if(!event.persisted){disposed=true;removeInputs();controller.abort();maze?.destroy();if(!app)void audioContext?.close();}});
