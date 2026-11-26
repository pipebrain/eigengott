import assert from 'node:assert/strict';
import {writeFile,mkdir,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {withBrowser,sleep} from '../../dos-maze/tools/browser.mjs';
const evidence=new URL('../evidence/',import.meta.url),checks=[],measurements=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors,requests})=>{
  const snapshot=()=>evaluate('window.__ARENA_BENCHMARK.snapshot()');
  const key=async(key,code,type='keyDown')=>cmd('Input.dispatchKeyEvent',{key,code,type});
  const press=async(k,c)=>{await key(k,c);await key(k,c,'keyUp');};
  const click=async selector=>{
    const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point});
    await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point});
  };
  const capture=async name=>{const {data}=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(new URL(name+'.png',evidence),Buffer.from(data,'base64'));};
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:origin+'/engine-benchmark/?test'});await wait('window.__ARENA_BENCHMARK?.ready');
  const initial=await snapshot();assert.equal(initial.profile,0);assert.equal(initial.candidateErrors,0);
  assert.ok(requests.every(url=>url.startsWith(origin+'/engine-benchmark/')||url===origin+'/favicon.ico'));
  await click('#enter');await wait('document.pointerLockElement===document.querySelector("#scene")');
  await key('w','KeyW');await sleep(400);await key('w','KeyW','keyUp');assert.equal(await evaluate('window.__ARENA_BENCHMARK.playerClear()'),true);
  checks.push('Small startup and native Pointer Lock/movement');await press('h','KeyH');

  // Browser fixtures survive a reload; fixture import is a real file-input operation.
  await evaluate('document.querySelector("#fixture-name").value="Browser fixture";document.querySelector("#save-fixture").click()');
  await cmd('Page.reload');await wait('window.__ARENA_BENCHMARK?.ready');await press('h','KeyH');
  assert.match(await evaluate('document.querySelector("#fixtures").textContent'),/Browser fixture/);
  await mkdir('.local/benchmark-check',{recursive:true});const fixturePath=resolve('.local/benchmark-check/fixture.json');
  await writeFile(fixturePath,JSON.stringify({version:1,name:'Imported large',seed:94,settings:{profile:2,lights:48,density:2,detail:1},movement:0}));
  const {root}=await cmd('DOM.getDocument'),{nodeId}=await cmd('DOM.querySelector',{nodeId:root.nodeId,selector:'#fixture-file'});
  await cmd('DOM.setFileInputFiles',{nodeId,files:[fixturePath]});await wait('document.querySelector("#seed").value==="94"');
  assert.equal(await evaluate('document.querySelector("#profile").value'),'2');checks.push('Saved fixtures persist; validated JSON import updates workload settings');

  await click('#generate');await wait('document.pointerLockElement===document.querySelector("#scene")');await key('w','KeyW');
  await wait('window.__ARENA_BENCHMARK.snapshot().staged');await key('w','KeyW','keyUp');
  const staged=await snapshot(),prepared=staged.lastResult;measurements.push(prepared);
  assert.equal(staged.seed,initial.seed);assert.equal(staged.profile,0);assert.ok(staged.simulationTime>0);
  assert.ok(prepared.preparationFrames>=5);assert.ok(prepared.frameMs.p95<25);assert.ok(prepared.frameMs.max<50,'A long frame interrupted background preparation');
  assert.ok(prepared.cpuMs.p95<6);assert.equal(prepared.stats.profile,2);assert.ok(prepared.stats.triangles>10000);
  checks.push('Large arena prepares on a worker with live movement, bounded copy/upload, and no long frame');
  await evaluate('window.__ARENA_BENCHMARK.activate()');await wait('window.__ARENA_BENCHMARK.snapshot().seed===94');await sleep(300);
  assert.equal(await evaluate('window.__ARENA_BENCHMARK.playerClear()'),true);assert.ok((await snapshot()).activationMs<8);
  await capture('large-player-view');checks.push('Validated rendering/physics activation preserves clearance');

  await evaluate('window.__ARENA_BENCHMARK.play(false)');const active=await snapshot();
  for(let fault=1;fault<=9;fault++){
    const result=await evaluate(`window.__ARENA_BENCHMARK.generate(95,${fault},{profile:2,lights:48,density:2,detail:1})`);
    assert.equal(result.accepted,false);assert.notEqual(result.errors,0);const d=await snapshot();assert.equal(d.seed,94);assert.equal(d.geometryHash,active.geometryHash);assert.deepEqual(d.position,active.position);
  }
  await evaluate('window.NativeWorker=Worker;window.Worker=class extends NativeWorker{constructor(url,options){super(new URL("missing-worker.js",location.href),options)}}');
  assert.equal((await evaluate('window.__ARENA_BENCHMARK.generate(96,0,{profile:2,lights:48,density:2,detail:1})')).accepted,false);
  await evaluate('window.Worker=window.NativeWorker');assert.equal((await snapshot()).geometryHash,active.geometryHash);
  checks.push('Nine broken arenas and a failed worker preserve active rendering, collision, and player');

  // Cancel worker computation and partial GPU upload; no abandoned candidate may activate.
  await evaluate('window.cancelledRequest=window.__ARENA_BENCHMARK.generate(100,0,{profile:2,lights:64,density:2,detail:2});window.__ARENA_BENCHMARK.cancel()');
  assert.equal((await evaluate('window.cancelledRequest')).cancelled,true);assert.equal((await snapshot()).staged,false);
  await evaluate('void(window.cancelledUpload=window.__ARENA_BENCHMARK.generate(101,0,{profile:2,lights:64,density:2,detail:2}))');
  await wait('window.__ARENA_BENCHMARK.snapshot().phase==="uploading"');await evaluate('window.__ARENA_BENCHMARK.cancel()');
  assert.equal((await evaluate('window.cancelledUpload')).cancelled,true);assert.equal((await snapshot()).seed,94);
  const races=await evaluate('Promise.all([window.__ARENA_BENCHMARK.generate(102,0,{profile:1,lights:24,density:2,detail:1}),window.__ARENA_BENCHMARK.generate(103,0,{profile:1,lights:24,density:2,detail:1})])');
  assert.equal(races[0].accepted,false);assert.equal(races[1].accepted,true);await evaluate('window.__ARENA_BENCHMARK.activate()');await wait('window.__ARENA_BENCHMARK.snapshot().seed===103');
  checks.push('Cancellation during worker/upload and latest-request activation are safe');

  await evaluate('window.__ARENA_BENCHMARK.view({camera:2})');await sleep(100);await capture('medium-overview');
  await evaluate('window.__ARENA_BENCHMARK.view({camera:1,lightmap:false});window.__ARENA_BENCHMARK.play(true);window.__ARENA_BENCHMARK.input(1|16)');const still=await snapshot();await sleep(250);assert.deepEqual((await snapshot()).position,still.position);
  await evaluate('window.__ARENA_BENCHMARK.play(false);window.__ARENA_BENCHMARK.view({atlas:true})');await sleep(100);await capture('lightmap-atlas');
  await evaluate('window.__ARENA_BENCHMARK.view({atlas:false,camera:0,lightmap:true,movement:1});window.__ARENA_BENCHMARK.resetPlayer()');
  assert.equal((await snapshot()).movementProfile,1);assert.equal(await evaluate('window.__ARENA_BENCHMARK.playerClear()'),true);
  checks.push('Free/top-down camera, atlas inspection, and safe optional Quake-referenced profile');

  await evaluate('window.__ARENA_BENCHMARK.route("record");window.__ARENA_BENCHMARK.play(true);window.__ARENA_BENCHMARK.input(1)');await sleep(700);
  await evaluate('window.__ARENA_BENCHMARK.route("stop");window.__ARENA_BENCHMARK.play(false)');assert.ok((await snapshot()).route.steps>20);
  assert.equal(await evaluate('window.__ARENA_BENCHMARK.route("play")'),true);await evaluate('window.__ARENA_BENCHMARK.play(true)');
  await wait('!window.__ARENA_BENCHMARK.snapshot().route.replaying');assert.ok((await snapshot()).route.endpointError<.001,'Recorded route did not reproduce its endpoint');
  checks.push('Recorded physical input route replays to the same endpoint');

  // The H suite drives all three sizes and exports a real browser download.
  await press('h','KeyH');await click('#run-suite');await wait('document.pointerLockElement===document.querySelector("#scene")');
  await wait('document.querySelector("#suite-status").textContent.startsWith("Suite complete")');
  const large=await snapshot();assert.equal(large.profile,2);assert.ok(large.fps>50);assert.equal(large.error,null);
  const downloadDir=resolve('.local/benchmark-check/downloads');await mkdir(downloadDir,{recursive:true});await cmd('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  await evaluate('document.querySelector("#export-report").click()');let downloaded;
  for(let i=0;i<50;i++){const files=await readdir(downloadDir);const file=files.find(x=>x.endsWith('.json'));if(file){downloaded=JSON.parse(await readFile(resolve(downloadDir,file),'utf8'));break;}await sleep(100);}
  assert.equal(downloaded.reports.length,3);await writeFile(new URL('suite-report.json',evidence),JSON.stringify(downloaded,null,2)+'\n');
  checks.push('H benchmark suite measures all three workloads and exports its report');

  for(const [width,height,dpr] of [[390,844,1],[900,600,1.5],[1376,768,1]]){await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});await sleep(100);assert.equal((await snapshot()).error,null);}
  const t=(await snapshot()).simulationTime;await cmd('Page.setWebLifecycleState',{state:'frozen'});await sleep(500);await cmd('Page.setWebLifecycleState',{state:'active'});await cmd('Emulation.setFocusEmulationEnabled',{enabled:true});await wait('!document.hidden');await sleep(100);assert.ok((await snapshot()).simulationTime-t<.4);
  const hash=(await snapshot()).geometryHash;
  for(let n=1;n<=2;n++){const count=(await snapshot()).frames;await evaluate('window.__ARENA_BENCHMARK.simulateDeviceLoss()');await wait(`window.__ARENA_BENCHMARK.snapshot().recoveries===${n}&&!window.__ARENA_BENCHMARK.snapshot().recovering&&window.__ARENA_BENCHMARK.snapshot().frames>${count}`);assert.equal((await snapshot()).geometryHash,hash);}
  await evaluate('window.__ARENA_BENCHMARK.simulateDeviceLoss()');await wait('window.__ARENA_BENCHMARK.error!==null');await evaluate('document.querySelector("#retry").click()');await wait('window.__ARENA_BENCHMARK?.ready');
  await evaluate('window.__ARENA_BENCHMARK.destroy()');const stopped=(await snapshot()).frames;await sleep(300);assert.equal((await snapshot()).frames,stopped);assert.equal((await snapshot()).wasmMemoryBytes,0);
  checks.push('Resize, freeze/resume, active-arena GPU recovery, retry, and disposal');assert.deepEqual(errors,[]);
  await writeFile(new URL('browser-verification.json',evidence),JSON.stringify({passed:true,browser:(await cmd('Browser.getVersion')).product,checks,measurements,initial,large},null,2)+'\n');
});
console.log(JSON.stringify({passed:true,checks},null,2));
