// Development-only: native CDP over Node's WebSocket. No browser packages.
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';

// Inspect real browser output without an image-processing dependency.
function colorMetrics(png){
  let width,height,type;const parts=[];
  for(let p=8;p<png.length;){
    const size=png.readUInt32BE(p),kind=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+size);
    if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);type=data[9];}
    if(kind==='IDAT')parts.push(data);p+=size+12;
  }
  assert.ok(type===2||type===6,'RGB or RGBA screenshot');
  const bpp=type===6?4:3,stride=width*bpp,raw=inflateSync(Buffer.concat(parts));
  let previous=new Uint8Array(stride),cursor=0,colored=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[cursor++],row=new Uint8Array(stride);
    for(let x=0;x<stride;x++){
      const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0;
      const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
      row[x]=(raw[cursor++]+predictor)&255;
    }
    for(let x=0;x<stride;x+=bpp)if(row[x]!==row[x+1]||row[x+1]!==row[x+2])colored++;
    previous=row;
  }
  return {width,height,coloredPixels:colored};
}

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'eigengott-chrome-'));
const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless=new','--enable-unsafe-webgpu','--use-angle=metal','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',
],{stdio:['ignore','ignore','pipe']});
let socket;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  const url=await new Promise((resolve,reject)=>{
    let log='';const timer=setTimeout(()=>reject(new Error(`Chrome did not start: ${log.slice(-1500)}`)),20000);
    chrome.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    chrome.on('error',reject);
  });
  socket=new WebSocket(url);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0;const pending=new Map(),browserErrors=[];
  socket.onmessage=event=>{
    const m=JSON.parse(event.data);
    if(m.id){const callback=pending.get(m.id);if(callback){pending.delete(m.id);m.error?callback.reject(new Error(JSON.stringify(m.error))):callback.resolve(m.result);}}
    if(m.method==='Runtime.exceptionThrown') browserErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  };
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params)=>send(method,params,sessionId);
  await cmd('Page.enable');await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  const evaluate=async expression=>{
    const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
    return r.result.value;
  };
  const navigate=async query=>{
    await cmd('Page.navigate',{url:`http://127.0.0.1:8080/${query}`});
    for(let i=0;i<160;i++) {
      const result=await evaluate('({ready:!!window.__EIGENGOTT?.ready,error:!document.querySelector("#status")?.hidden?document.querySelector("#status")?.innerText:null})');
      if(result.ready){await pause(500);return;}
      if(result.error && !result.error.includes('Assembling')) throw new Error(result.error);
      await pause(150);
    }
    throw new Error('Scene did not initialize in time');
  };
  await mkdir(join(root,'evidence'),{recursive:true});
  const screenshot=async name=>{
    const {data}=await cmd('Page.captureScreenshot',{format:'png'});
    const png=Buffer.from(data,'base64');
    await writeFile(join(root,'evidence',name),png);return png;
  };
  const waitFor=async expression=>{
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}
    throw new Error(`Timed out: ${expression}`);
  };
  const snapshots=[];
  for(const [time,name] of [[0,'rest.png'],[16,'fracture.png'],[25.5,'return.png']]) {
    await navigate(`?time=${time}&paused`);
    const state=await evaluate('window.__EIGENGOTT');
    assert.equal(state.ready,true);assert.deepEqual(state.errors,[]);
    assert.equal(state.lighting,false);assert.equal(state.shadows,false);assert.equal(state.renderPasses,1);
    assert.equal(state.geometry.characterCount,9);assert.equal(state.palette,'bw');
    assert.equal(await evaluate('document.querySelector("#controls").hidden'),true);
    snapshots.push(state);const png=await screenshot(name);
    assert.equal(colorMetrics(png).coloredPixels,0,'Default artwork contains only grayscale pixels');
  }
  assert.ok(snapshots[1].separation>.8,'Fracture pose separates');
  assert.ok(snapshots[2].separation<.03,'Title returns to rest');
  assert.deepEqual(snapshots[0].camera,snapshots[1].camera,'Camera does not drift');
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'});
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'});
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);
  await screenshot('controls.png');
  const home=await evaluate('window.__EIGENGOTT.camera');
  await evaluate('const c=document.querySelector("#cameraX");c.value="3";c.dispatchEvent(new Event("input"))');
  await pause(200);assert.notDeepEqual(await evaluate('window.__EIGENGOTT.camera'),home);
  await evaluate('document.querySelector("#camera-reset").click()');await pause(200);
  assert.deepEqual(await evaluate('window.__EIGENGOTT.camera'),home,'Camera reset restores the front view');
  await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x:200,y:500,button:'left',clickCount:1});
  await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:270,y:540,button:'left',buttons:1});
  await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x:270,y:540,button:'left',clickCount:1});
  await pause(200);assert.notDeepEqual(await evaluate('window.__EIGENGOTT.camera'),home,'Canvas drag pans the camera');
  await evaluate('document.querySelector("#camera-reset").click()');
  await evaluate('const y=document.querySelector("#yaw");y.value="20";y.dispatchEvent(new Event("input"))');
  await pause(200);assert.ok(Math.abs((await evaluate('window.__EIGENGOTT.cameraBack'))[0])>.3);
  await screenshot('camera.png');await evaluate('document.querySelector("#camera-reset").click()');
  await evaluate('document.querySelector("#pause").click()');await pause(400);
  assert.equal(await evaluate('window.__EIGENGOTT.paused'),false);
  const a=await evaluate('window.__EIGENGOTT.time');await pause(500);
  assert.ok(await evaluate('window.__EIGENGOTT.time')>a,'Animation advances');
  await evaluate('document.querySelector("#pause").click()');await pause(100);
  const b=await evaluate('window.__EIGENGOTT.time');await pause(200);
  assert.equal(await evaluate('window.__EIGENGOTT.time'),b,'Pause freezes time');
  await evaluate('document.querySelector("#reform").click()');await pause(200);
  assert.equal(await evaluate('window.__EIGENGOTT.separation'),0);
  await evaluate('const slider=document.querySelector("#lineWidth");slider.value="0.6";slider.dispatchEvent(new Event("input"))');
  await navigate('?paused');
  assert.equal(await evaluate('document.querySelector("#lineWidth").value'),'0.6','Settings persist');
  const buildCount=await evaluate('window.__EIGENGOTT.maskBuilds');await pause(200);
  assert.equal(await evaluate('window.__EIGENGOTT.maskBuilds'),buildCount,'Masks are not rasterized each frame');
  await evaluate('const text=document.querySelector("#text");text.value="STACKS";text.dispatchEvent(new Event("input"))');
  await waitFor('window.__EIGENGOTT.text==="STACKS"');
  assert.equal(await evaluate('window.__EIGENGOTT.geometry.characterCount'),6,'Live text changes the number of character stacks');
  await screenshot('edited-title.png');
  const {root:dom}=await cmd('DOM.getDocument',{depth:0});
  const {nodeId}=await cmd('DOM.querySelector',{nodeId:dom.nodeId,selector:'#font-file'});
  await cmd('DOM.setFileInputFiles',{nodeId,files:[process.env.TEST_FONT||'/System/Library/Fonts/Supplemental/Arial Black.ttf']});
  await waitFor('window.__EIGENGOTT.font==="custom"');
  assert.match(await evaluate('document.querySelector("#font-status").textContent'),/loaded for this session/);
  await screenshot('font-file.png');
  await evaluate('const p=document.querySelector("#palette");p.value="muted";p.dispatchEvent(new Event("input"))');
  await pause(200);assert.equal(await evaluate('window.__EIGENGOTT.palette'),'muted');
  assert.ok(colorMetrics(await screenshot('muted.png')).coloredPixels>100,'Muted mode actually produces colored pixels');
  await evaluate('{const t=document.querySelector("#text");t.value="";t.dispatchEvent(new Event("input"));}');
  await waitFor('window.__EIGENGOTT.geometry.characterCount===0');
  await evaluate('{const t=document.querySelector("#text");t.value="ABCDEFGHIJKLMNOPQRSTUVWXYZ";t.dispatchEvent(new Event("input"));}');
  await waitFor('window.__EIGENGOTT.geometry.characterCount===24');
  assert.equal(await evaluate('window.__EIGENGOTT.text.length'),24,'Long titles are bounded to 24 character stacks');
  await evaluate('document.querySelector("#reset").click()');
  await waitFor('window.__EIGENGOTT.text==="EIGENGOTT" && window.__EIGENGOTT.font==="block"');
  assert.equal(await evaluate('window.__EIGENGOTT.palette'),'bw','Reset returns to black and white');
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'});
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'});
  await evaluate('document.querySelector("#slices").focus()');
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'});
  await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'});
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),true,'H works while a tuning slider has focus');
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await pause(600);await screenshot('portrait.png');
  assert.deepEqual(await evaluate('window.__EIGENGOTT.errors'),[]);
  assert.deepEqual(browserErrors,[]);
  const report={passed:true,browser:'Chrome headless / Metal WebGPU',checks:['WASM + WGSL initialization','One stack per character','Grayscale pixels verified in default mode','One unlit draw call with no shadows','Rest/displacement/return poses','Fixed default camera','Camera slider, drag, look and reset','Hidden controls and H shortcut','Pause/resume','Reassembly','Persistent controls','Live text editing','Local font file loading','Masks generated only on edits','Colored pixels verified in muted mode','Empty and 24-character titles','Portrait resize','No runtime or WebGPU errors'],snapshots};
  await writeFile(join(root,'evidence','verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {
  socket?.close();chrome.kill('SIGTERM');await pause(500);
  await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:300});
}
