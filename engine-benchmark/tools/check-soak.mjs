import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from '../../dos-maze/tools/browser.mjs';
const preparations=[],checks=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
  const snapshot=()=>evaluate('window.__ARENA_BENCHMARK.snapshot()');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:origin+'/engine-benchmark/?test'});await wait('window.__ARENA_BENCHMARK?.ready');
  await evaluate('window.__ARENA_BENCHMARK.play(true)');
  assert.equal((await evaluate('window.__ARENA_BENCHMARK.generate(94,0,{profile:2,lights:48,density:2,detail:1})')).accepted,true);
  await evaluate('window.__ARENA_BENCHMARK.activate()');await wait('window.__ARENA_BENCHMARK.snapshot().profile===2');
  await sleep(300);await cmd('HeapProfiler.collectGarbage');const heapBefore=await cmd('Runtime.getHeapUsage'),initial=await snapshot(),start=performance.now();
  let iterations=0,activations=0,rejections=0,recoveredDuringPreparation=false;
  while(performance.now()-start<45000){
    await evaluate(`window.__ARENA_BENCHMARK.input(${[1,9,8,10,2,6,4,5][iterations%8]},${iterations%2?70:-50},${iterations%2?-15:15})`);
    if(iterations%6===0){
      const seed=(94+iterations*1777)>>>0,preset={profile:iterations%12===0?2:1,lights:iterations%12===0?64:24,density:2,detail:iterations%12===0?2:1};
      const before=await snapshot();assert.equal((await evaluate(`window.__ARENA_BENCHMARK.generate(${seed},${iterations/6%8+1},${JSON.stringify(preset)})`)).accepted,false);
      assert.equal((await snapshot()).geometryHash,before.geometryHash);rejections++;
      const result=await evaluate(`window.__ARENA_BENCHMARK.generate(${seed},0,${JSON.stringify(preset)})`);assert.equal(result.accepted,true);preparations.push(result);
      assert.ok(result.frameMs.p95<25);assert.ok(result.frameMs.max<50,'Preparation caused a long gameplay frame');
      await evaluate('window.__ARENA_BENCHMARK.activate()');await wait(`window.__ARENA_BENCHMARK.snapshot().seed===${seed}`);activations++;
      assert.equal(await evaluate('window.__ARENA_BENCHMARK.playerClear()'),true);
    }
    if(iterations%8===0){
      const portrait=iterations%16===0;await cmd('Emulation.setDeviceMetricsOverride',{width:portrait?500:1376,height:portrait?900:768,deviceScaleFactor:portrait?1.5:1,mobile:false});
      await evaluate(`window.__ARENA_BENCHMARK.view({resolution:${portrait?540:360},movement:${iterations%16===0?1:0},relief:${portrait?.5:1}})`);
    }
    if(!recoveredDuringPreparation&&performance.now()-start>20000){
      const old=await snapshot();
      await evaluate('void(window.interruptedArena=window.__ARENA_BENCHMARK.generate(98765,0,{profile:2,lights:64,density:2,detail:2}))');
      await sleep(25);await evaluate('window.__ARENA_BENCHMARK.simulateDeviceLoss()');
      await wait('window.__ARENA_BENCHMARK.snapshot().recoveries===1&&!window.__ARENA_BENCHMARK.snapshot().recovering');
      assert.equal((await evaluate('window.interruptedArena')).accepted,false);assert.equal((await snapshot()).geometryHash,old.geometryHash);recoveredDuringPreparation=true;
    }
    await sleep(350);const state=await snapshot();assert.equal(state.error,null);assert.equal(state.wasmMemoryBytes,32*1048576);assert.equal(await evaluate('window.__ARENA_BENCHMARK.playerClear()'),true);iterations++;
  }
  await evaluate('window.__ARENA_BENCHMARK.input(0)');await cmd('HeapProfiler.collectGarbage');const heapAfter=await cmd('Runtime.getHeapUsage'),final=await snapshot();
  assert.ok(final.frames-initial.frames>1800);assert.ok(heapAfter.usedSize-heapBefore.usedSize<4*1048576);
  if(heapAfter.backingStorageSize&&heapBefore.backingStorageSize)assert.ok(heapAfter.backingStorageSize-heapBefore.backingStorageSize<16*1048576,'Arena backing storage was retained after GC');
  assert.equal(recoveredDuringPreparation,true);assert.equal(final.staged,false);assert.equal(final.busy,false);assert.deepEqual(errors,[]);
  checks.push('Live body/gun movement across repeated valid and rejected replacements','Every sampled preparation keeps frame p95 below 25 ms and maximum below 50 ms','Portrait/high-DPI and both movement profiles while preparing','GPU loss during construction cancels the job and restores the active arena','Fixed per-instance WASM and bounded retained JS/backing storage');
  const report={passed:true,durationMs:performance.now()-start,iterations,activations,rejections,frames:final.frames-initial.frames,browser:(await cmd('Browser.getVersion')).product,heapBefore,heapAfter,
    maxPreparationFrameP95Ms:Math.max(...preparations.map(x=>x.frameMs.p95)),maxPreparationFrameMs:Math.max(...preparations.map(x=>x.frameMs.max)),maxPreparationCpuP95Ms:Math.max(...preparations.map(x=>x.cpuMs.p95)),checks,preparations,final};
  await writeFile(new URL('../evidence/soak-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,preparations:undefined,final:undefined},null,2));
});
