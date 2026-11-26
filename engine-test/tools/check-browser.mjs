import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from '../../dos-maze/tools/browser.mjs';
import {pixels} from '../../dos-maze/tools/pixels.mjs';
const out=new URL('../evidence/',import.meta.url),checks=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors,requests})=>{
  const snapshot=()=>evaluate('window.__ENGINE_TEST.snapshot()');
  const capture=async name=>{const {data}=await cmd('Page.captureScreenshot',{format:'png'});const png=Buffer.from(data,'base64');await writeFile(new URL(name+'.png',out),png);return pixels(png);};
  const key=async(key,code,type)=>cmd('Input.dispatchKeyEvent',{key,code,type});
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:origin+'/engine-test/?test'});await wait('window.__ENGINE_TEST?.ready');await sleep(200);
  const initial=await snapshot();assert.equal(initial.candidateErrors,0);assert.equal(initial.components,1);assert.equal(initial.unmatchedEdges,0);assert.equal(initial.nonmanifoldEdges,0);assert.equal(initial.passes,2);
  assert.ok(requests.every(url=>url.startsWith(origin+'/engine-test/')||url===origin+'/favicon.ico'),'Runtime requested a dependency outside its directory');
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),true);
  const rect=await evaluate('(()=>{const r=document.querySelector("#enter").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...rect});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...rect});
  await wait('document.pointerLockElement===document.querySelector("#scene")');assert.equal((await snapshot()).playing,true);
  await key('w','KeyW','keyDown');await sleep(500);await key('w','KeyW','keyUp');await sleep(100);
  assert.ok((await snapshot()).position[1]>initial.position[1]+.5);assert.equal(await evaluate('window.__ENGINE_TEST.playerClear()'),true);
  checks.push('WebGPU/Rust startup, native Pointer Lock, keyboard movement, no gameplay HUD');await capture('arena');
  await key('h','KeyH','keyDown');await key('h','KeyH','keyUp');await wait('!document.querySelector("#controls").hidden');
  assert.equal((await snapshot()).playing,false);assert.equal(await evaluate('document.pointerLockElement'),null);
  const before=await snapshot();
  await evaluate('document.querySelector("#seed").value=94;document.querySelector("#generate").click()');await wait('window.__ENGINE_TEST.snapshot().staged');
  assert.equal((await snapshot()).seed,before.seed);assert.equal((await snapshot()).geometryHash,before.geometryHash,'Staging replaced the active arena');
  await evaluate('document.querySelector("#activate").click()');await wait('window.__ENGINE_TEST.snapshot().seed===94');assert.equal(await evaluate('window.__ENGINE_TEST.playerClear()'),true);
  checks.push('Candidate validation and GPU staging preserve the active arena until explicit activation');
  const active=await snapshot();
  for(let fault=1;fault<=8;fault++){
    const id=(await snapshot()).candidateId;
    await evaluate(`document.querySelector('#fault').value=${JSON.stringify(String(fault))};document.querySelector('#generate').click()`);
    await wait(`window.__ENGINE_TEST.snapshot().candidateId>${id}&&!window.__ENGINE_TEST.snapshot().busy`);
    const d=await snapshot();assert.notEqual(d.candidateErrors,0);assert.equal(d.seed,94);assert.equal(d.geometryHash,active.geometryHash);assert.deepEqual(d.position,active.position);assert.equal(d.staged,false);
  }
  await capture('rejected-candidate');checks.push('Eight invalid candidates leave rendering, collision, and player state intact');
  const races=await evaluate('Promise.all([window.__ENGINE_TEST.generate(101),window.__ENGINE_TEST.generate(102)])');assert.equal(races[0].accepted,false);assert.equal(races[1].accepted,true);assert.equal((await snapshot()).seed,94);
  await evaluate('window.__ENGINE_TEST.activate()');await wait('window.__ENGINE_TEST.snapshot().seed===102');checks.push('Superseded staged requests cannot activate');
  await key('h','KeyH','keyDown');await key('h','KeyH','keyUp');await evaluate('window.__ENGINE_TEST.play(true)');await sleep(200);
  const full=await capture('surface-relief');await evaluate('window.__ENGINE_TEST.view({relief:0})');await sleep(100);const flat=await capture('surface-retracted');
  let changed=0;for(let i=0;i<full.data.length;i++)if(full.data[i]!==flat.data[i])changed++;assert.ok(changed/full.data.length>.005,'Surface relief control did not change visible geometry');
  await evaluate('window.__ENGINE_TEST.view({relief:1,collision:true})');await sleep(100);await capture('structural-seams');await evaluate('window.__ENGINE_TEST.view({collision:false})');
  const pos=(await snapshot()).position;
  assert.equal(await evaluate(`window.__ENGINE_TEST.tryPlace(${pos.join(',')},0,-1.1)`),1);await sleep(100);await capture('true-first-person-body');
  checks.push('Real surface relief, structural seam view, and visible world-space player body');
  for(const [width,height,dpr]of[[390,844,1],[900,600,1.5],[1376,768,2]]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});await sleep(160);assert.equal((await snapshot()).error,null);
  }await capture('high-dpi');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await evaluate('window.__ENGINE_TEST.view({resolution:720,lightmap:false})');await sleep(200);assert.equal((await snapshot()).renderSize[1],720);
  await evaluate('window.__ENGINE_TEST.view({resolution:360,lightmap:true});window.__ENGINE_TEST.resetPlayer()');await sleep(1500);
  const measured=await snapshot();assert.ok(measured.fps>20);if(measured.gpuTimestamps)assert.ok(measured.gpuSceneMs!==null);
  checks.push('Portrait/high-DPI resize, resolution controls, lighting switch, and optional GPU timing');
  assert.equal((await evaluate('window.__ENGINE_TEST.generate(103,1)')).accepted,false);
  const t=measured.simulationTime;await cmd('Page.setWebLifecycleState',{state:'frozen'});await sleep(600);await cmd('Page.setWebLifecycleState',{state:'active'});
  // CDP unfreezing leaves the page hidden until it is brought to the front.
  // A hidden page must remain paused; test recovery after actual visibility.
  await cmd('Page.bringToFront');await cmd('Emulation.setFocusEmulationEnabled',{enabled:true});await wait('!document.hidden');await sleep(100);
  const resumed=await snapshot();assert.ok(resumed.frames>measured.frames,'Visible page did not resume rendering');
  assert.ok(resumed.simulationTime-t<.4,'Suspended time advanced simulation');
  for(let n=1;n<=2;n++){
    const old=(await snapshot()).frames;await evaluate('window.__ENGINE_TEST.simulateDeviceLoss()');
    try{await wait(`window.__ENGINE_TEST.snapshot().recoveries===${n}&&!window.__ENGINE_TEST.snapshot().recovering&&window.__ENGINE_TEST.snapshot().frames>${old}`);}catch(error){console.log(await snapshot());throw error;}
    const recovered=await snapshot();assert.equal(recovered.error,null);assert.equal(recovered.seed,measured.seed);assert.equal(recovered.geometryHash,measured.geometryHash);
    assert.equal(await evaluate('document.querySelector("#status").hidden'),true);
  }
  await evaluate('window.__ENGINE_TEST.simulateDeviceLoss()');await wait('window.__ENGINE_TEST.error!==null');assert.equal(await evaluate('document.querySelector("#retry").hidden'),false);
  await evaluate('document.querySelector("#retry").click()');await wait('window.__ENGINE_TEST?.ready');checks.push('Freeze/resume, two GPU recoveries, and bounded failure/retry');
  await key('h','KeyH','keyDown');await key('h','KeyH','keyUp');await evaluate('window.__ENGINE_TEST.destroy()');const stopped=await snapshot();await sleep(1100);
  assert.equal((await snapshot()).frames,stopped.frames);assert.equal((await snapshot()).wasmMemoryBytes,0);checks.push('Explicit disposal releases component resources and stops frame work');
  await cmd('Network.setBlockedURLs',{urls:['*engine-test/engine.wasm*']});await cmd('Page.navigate',{url:origin+'/engine-test/'});await wait('!document.querySelector("#retry").hidden');
  await cmd('Network.setBlockedURLs',{urls:[]});await evaluate('document.querySelector("#retry").click()');await wait('window.__ENGINE_TEST?.ready');
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"gpu",{value:undefined});'});await cmd('Page.navigate',{url:origin+'/engine-test/'});await wait('!document.querySelector("#retry").hidden');assert.match(await evaluate('document.querySelector("#message").textContent'),/WebGPU/);
  checks.push('Missing assets and unsupported WebGPU show actionable errors');assert.deepEqual(errors,[]);
  await writeFile(new URL('browser-verification.json',out),JSON.stringify({passed:true,browser:'Chrome headless / Metal WebGPU',checks,initial,measured},null,2)+'\n');
});
console.log(JSON.stringify({passed:true,checks},null,2));
