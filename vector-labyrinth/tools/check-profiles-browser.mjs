import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'evidence');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'eigengott-vector-check-')),download=join(profile,'downloads');await mkdir(download);
const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless=new','--enable-unsafe-webgpu','--use-angle=metal','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',
],{stdio:['ignore','ignore','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
function pixels(png){
  const parts=[];let width,height,type;
  for(let p=8;p<png.length;){const n=png.readUInt32BE(p),kind=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);type=data[9];assert.equal(data[8],8);}if(kind==='IDAT')parts.push(data);p+=n+12;}
  assert.ok(type===2||type===6);const bpp=type===6?4:3,stride=width*bpp,raw=inflateSync(Buffer.concat(parts));
  const result=new Uint8Array(width*height*3);let previous=new Uint8Array(stride),cursor=0;
  const paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[cursor++],row=new Uint8Array(stride);for(let x=0;x<stride;x++){const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0;row[x]=(raw[cursor++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}for(let x=0;x<width;x++)result.set(row.subarray(x*bpp,x*bpp+3),(y*width+x)*3);previous=row;}
  return {width,height,data:result};
}
try{
  const url=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),20000);chrome.on('error',reject);chrome.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0;const pending=new Map(),runtimeErrors=[];
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params)=>send(method,params,sessionId);
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;const error=await evaluate('!document.querySelector("#status")?.hidden?document.querySelector("#status")?.innerText:null');if(error&&!error.includes('Drawing the labyrinth'))throw new Error(error);await sleep(100);}throw new Error('Timed out: '+expression+' '+JSON.stringify(runtimeErrors)+' '+JSON.stringify(await evaluate('window.__VECTOR_STUDY')));};
  const set=async(key,value)=>{await evaluate(`(()=>{const input=document.getElementById(${JSON.stringify(key)});if(input.type==='checkbox')input.checked=${JSON.stringify(value)};else input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input'));})()`);await sleep(100);};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const paused=async value=>{if(await evaluate('window.__VECTOR_STUDY.paused')!==value)await click('#pause');};
  const reload=async()=>{await cmd('Page.reload');await sleep(200);await waitFor('window.__VECTOR_STUDY?.ready');};
  const upload=async(selector,path)=>{const {root:dom}=await cmd('DOM.getDocument',{depth:0}),{nodeId}=await cmd('DOM.querySelector',{nodeId:dom.nodeId,selector});await cmd('DOM.setFileInputFiles',{nodeId,files:[path]});};
  const key=async k=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k==='h'?'KeyH':k===' '?'Space':'KeyR'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k==='h'?'KeyH':k===' '?'Space':'KeyR'});};
  const screenshot=async name=>{const {data}=await cmd('Page.captureScreenshot',{format:'png'});const png=Buffer.from(data,'base64');if(name)await writeFile(join(out,name+'.png'),png);return png;};
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:'http://127.0.0.1:8080/vector-labyrinth/?paused&state=0&flicker=off'});
  await waitFor('window.__VECTOR_STUDY?.ready');await sleep(200);
  const initial=await evaluate('window.__VECTOR_STUDY');assert.equal(initial.settings.lockTitle,true);assert.equal(initial.settings.constantGap,true);assert.equal(initial.settings.lineProfiles,true);assert.equal(initial.settings.collisionEdges,true);
  await screenshot('profiles-home');const homeTransforms=initial.glyphTransforms;
  await set('manualState',1);await waitFor('window.__VECTOR_STUDY.perspectivePlaneCount>0&&window.__VECTOR_STUDY.fillPlaneCount>0');
  assert.deepEqual(await evaluate('window.__VECTOR_STUDY.glyphTransforms'),homeTransforms,'Anchored title ignores tectonic translation and rotation');await screenshot('profiles-chaos');
  const chaos=await evaluate('window.__VECTOR_STUDY');assert.ok(chaos.collisionDecisionCount>0);assert.equal(chaos.wallWidth,initial.wallWidth);
  await set('lockTitle',false);assert.notDeepEqual(await evaluate('window.__VECTOR_STUDY.glyphTransforms'),homeTransforms,'Title drift is available when unlocked');await set('lockTitle',true);
  await set('timeScale',4);await set('collisionHold',.25);const before=await evaluate('window.__VECTOR_STUDY.collisionDecisionCount');await paused(false);await sleep(650);await paused(true);
  assert.ok(await evaluate('window.__VECTOR_STUDY.collisionDecisionCount')>before,'Visibility does not remain tied to a fixed draw index');
  await set('fillPlanesVisible',false);assert.equal(await evaluate('window.__VECTOR_STUDY.fillPlaneCount'),0);await screenshot('perspective-profile-only');
  await set('fillPlanesVisible',true);await set('perspectiveVisible',false);assert.equal(await evaluate('window.__VECTOR_STUDY.perspectivePlaneCount'),0);await screenshot('fill-profile-only');
  await set('fillLineSpeed',2);await set('fillHatchRate',3);const fillBefore=pixels(await screenshot());await paused(false);await sleep(350);await paused(true);assert.notDeepEqual(pixels(await screenshot('fill-profile-moved')).data,fillBefore.data,'Fill planes independently randomize and move hatching');
  await set('perspectiveVisible',true);await set('constantGap',false);await screenshot('profiles-grid-off');assert.equal(await evaluate('window.__VECTOR_STUDY.constantGap'),false);await set('constantGap',true);
  const posePixels=pixels(await screenshot('profiles-saved-pose'));await click('#export');const presetPath=join(download,'eigengott-labyrinth-preset.json');let preset;
  for(let i=0;i<40;i++){try{preset=JSON.parse(await readFile(presetPath,'utf8'));break;}catch{await sleep(100);}}
  assert.ok(preset.runtime.collisions.edges.length>0);assert.ok(preset.runtime.collisions.edges.some(([,v])=>v.revisions.some(r=>r>0)));assert.equal(preset.settings.lockTitle,true);assert.equal(preset.settings.lineProfiles,true);
  await click('#home');await upload('#preset-file',presetPath);await sleep(200);assert.deepEqual(pixels(await screenshot('profiles-restored-pose')).data,posePixels.data,'Saved collision decisions and edge redraw state restore the same pixels');
  await click('#home');await set('period',6);await set('stableHold',.75);await set('chaosHold',.5);await set('autoState',true);const cycleHome=pixels(await screenshot());await paused(false);await waitFor('window.__VECTOR_STUDY.baseState>.98');await waitFor('window.__VECTOR_STUDY.time>=6&&window.__VECTOR_STUDY.baseState===0');await paused(true);assert.deepEqual(pixels(await screenshot('profiles-return')).data,cycleHome.data,'The new profiles return to the exact gridded home composition');
  await evaluate('(async()=>{const {tectonicDefaults}=await import("./settings.js");localStorage.setItem("eigengott-vector-labyrinth-v2",JSON.stringify({version:2,defaultRevision:2,activePreset:"builtin:reference-filled",settings:{...tectonicDefaults(),title:"V5 KEPT"}}));})()');await reload();
  assert.equal(await evaluate('window.__VECTOR_STUDY.settings.lineProfiles'),true);assert.equal(await evaluate('window.__VECTOR_STUDY.settings.lockTitle'),true);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("eigengott-vector-labyrinth-v2-before-perspective-profiles")).settings.title'),'V5 KEPT');
  await evaluate('document.querySelector("#browser-preset").value="before-perspective-profiles"');await click('#browser-load');await waitFor('window.__VECTOR_STUDY.title==="V5 KEPT"');assert.equal(await evaluate('window.__VECTOR_STUDY.settings.lockTitle'),false);await click('#reset');await paused(true);
  await set('manualState',1);await paused(false);await sleep(1400);const measuredFPS=await evaluate('window.__VECTOR_STUDY.fps');await paused(true);
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(250);await screenshot('profiles-portrait');
  assert.deepEqual(await evaluate('window.__VECTOR_STUDY.errors'),[]);assert.deepEqual(runtimeErrors,[]);
  const report={passed:true,measuredFPS,perspectivePlanes:chaos.perspectivePlaneCount,fillPlanes:chaos.fillPlaneCount,checks:['Anchored title default and unlock toggle','Common-vanishing-point and fill profiles rendered by WebGPU','Collision-driven visibility changes during ongoing contacts','Perspective and fill profile toggles','Independent hatch movement / randomization','Grid toggle','Pixel-exact saved collision/edge redraw pose','Pixel-exact full-cycle recovery','Previous v5 options preserved on migration','Portrait rendering','No GPU or runtime errors']};await writeFile(join(out,'profiles-browser-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{socket?.close();chrome.kill('SIGTERM');await sleep(500);await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:300});}
