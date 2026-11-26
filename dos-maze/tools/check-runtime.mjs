import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from './browser.mjs';
const checks=[],root=new URL('../',import.meta.url);
await withBrowser(async({origin,cmd,evaluate,wait,errors,requests})=>{
  const open=async()=>{await cmd('Page.navigate',{url:origin+'/dos-maze/?test&paused'});await wait('window.__DOS_MAZE?.ready');await sleep(200);};
  const snapshot=()=>evaluate('window.__DOS_MAZE.snapshot()');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});await open();
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),true);
  assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("h2")).map(e=>e.textContent)'),['Playback','Render quality','Diagnostics']);
  assert.ok(requests.every(url=>!url.includes('/vector-labyrinth/')),'Production must be standalone');
  assert.equal((await snapshot()).passes,3);assert.equal((await snapshot()).wasmMemoryBytes,8*1048576);
  assert.equal((await snapshot()).version,'1.1.1');assert.equal((await snapshot()).timeScale,.5);assert.deepEqual((await snapshot()).quality,{dprCap:1,antialias:false});assert.equal((await snapshot()).samples,1);
  checks.push('v1.1.1 defaults: half speed, pixel ratio 1, antialiasing off');
  await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'});
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);
  await evaluate(`document.querySelector('#ratio').value=.8;document.querySelector('#ratio').dispatchEvent(new Event('input'));document.querySelector('#antialias').checked=true;document.querySelector('#antialias').dispatchEvent(new Event('input'));document.querySelector('#speed').value=1.5;document.querySelector('#speed').dispatchEvent(new Event('input'));`);
  await open();assert.deepEqual((await snapshot()).quality,{dprCap:.8,antialias:true});assert.equal((await snapshot()).timeScale,1.5);
  await evaluate(`document.querySelector('#reset-quality').click()`);await sleep(150);
  assert.deepEqual((await snapshot()).quality,{dprCap:1,antialias:false});checks.push('Quality and speed save/restore; reset to accepted render quality');
  const before=(await snapshot()).frames;await sleep(300);assert.equal((await snapshot()).frames,before,'Paused runtime must not render');
  await evaluate(`document.querySelector('#step').click()`);await wait(`window.__DOS_MAZE.snapshot().frames>${before}`);assert.ok((await snapshot()).time>0);
  checks.push('Pause stops rendering; single-step renders on demand');
  for(let i=0;i<18;i++){
    const width=i%2?390:1376,height=i%2?844:768;
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:i%3===0?1.5:1,mobile:false});
    await sleep(45);
  }
  await sleep(200);assert.equal((await snapshot()).targetCount,3);assert.equal((await snapshot()).error,null);
  await evaluate('window.__DOS_MAZE.setQuality({dprCap:1.5,antialias:true})');
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:false});
  // CDP changes DPR without sending the native OS display-change events.
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await wait(`window.__DOS_MAZE.snapshot().renderSize[0]===585`);
  assert.equal((await snapshot()).paused,true);
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await evaluate('window.dispatchEvent(new Event("resize"))');
  await wait(`window.__DOS_MAZE.snapshot().renderSize[0]===390`);
  checks.push('18 landscape/portrait and DPR changes with bounded render targets');
  await evaluate('window.__DOS_MAZE.resume()');await sleep(200);
  for(let n=1;n<=2;n++){
    const before=(await snapshot()).frames;await evaluate('window.__DOS_MAZE.simulateDeviceLoss()');
    await wait(`window.__DOS_MAZE.snapshot().recoveries===${n}&&!window.__DOS_MAZE.snapshot().recovering&&window.__DOS_MAZE.snapshot().frames>${before}`);
    assert.equal((await snapshot()).error,null);
  }
  await evaluate('window.__DOS_MAZE.simulateDeviceLoss()');await wait('window.__DOS_MAZE.error!==null');
  assert.equal(await evaluate('document.querySelector("#retry").hidden'),false);
  await evaluate('document.querySelector("#retry").click()');await wait('window.__DOS_MAZE?.ready');
  checks.push('Two automatic device-loss recoveries; bounded failure and user retry');
  await evaluate('window.__DOS_MAZE.pause()');await sleep(150);
  await evaluate(`(async()=>{
    window.__DOS_MAZE.destroy();const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;top:0;left:0;width:640px;height:360px';document.body.append(canvas);
    window.engineCanvas=canvas;window.engineMaze=await (await import('./runtime.js')).createDOSMaze(canvas,{paused:true,flicker:false});
  })()`);
  await wait('window.engineMaze?.ready');assert.equal(await evaluate('window.engineMaze.timeScale'),.5);assert.deepEqual(await evaluate('window.engineMaze.quality'),{dprCap:1,antialias:false});assert.deepEqual(await evaluate('window.engineMaze.snapshot().renderSize'),[640,360]);
  await evaluate('window.engineCanvas.style.width="800px"');await wait('window.engineMaze.snapshot().renderSize[0]===800');
  await evaluate('window.engineMaze.destroy()');const stopped=await evaluate('window.engineMaze.snapshot()');await sleep(150);
  assert.equal((await evaluate('window.engineMaze.snapshot()')).frames,stopped.frames);assert.equal(stopped.wasmMemoryBytes,0);
  checks.push('Engine mount, embedded-canvas resize, and explicit disposal');
  await cmd('Network.setBlockedURLs',{urls:['*dos-maze/maze.wasm*']});
  await cmd('Page.navigate',{url:origin+'/dos-maze/'});await wait('!document.querySelector("#retry").hidden');
  await cmd('Network.setBlockedURLs',{urls:[]});await evaluate('document.querySelector("#retry").click()');await wait('window.__DOS_MAZE?.ready');
  checks.push('Missing asset produces a recoverable error instead of a blank screen');
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"gpu",{value:undefined});'});
  await cmd('Page.navigate',{url:origin+'/dos-maze/'});await wait('!document.querySelector("#retry").hidden');
  assert.match(await evaluate('document.querySelector("#message").textContent'),/WebGPU/);
  checks.push('Unsupported WebGPU produces a clear error');assert.deepEqual(errors,[]);
});
await writeFile(new URL('evidence/runtime-verification.json',root),JSON.stringify({passed:true,browser:'Chrome headless / Metal WebGPU',checks},null,2)+'\n');console.log(JSON.stringify({passed:true,checks},null,2));
