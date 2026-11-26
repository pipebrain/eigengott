import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from '../../dos-maze/tools/browser.mjs';

await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:origin+'/engine-test/?test'});
  await wait('window.__ENGINE_TEST?.ready');await evaluate('window.__ENGINE_TEST.play(true)');await sleep(1200);
  const snapshot=()=>evaluate('window.__ENGINE_TEST.snapshot()');
  await cmd('HeapProfiler.collectGarbage');const heapBefore=await cmd('Runtime.getHeapUsage'),initial=await snapshot();
  const start=performance.now(),samples=[];let activated=0,rejected=0,iterations=0;
  while(performance.now()-start<30000){
    const bits=[1,9,8,10,2,6,4,5][iterations%8];
    await evaluate(`window.__ENGINE_TEST.input(${bits},${iterations%3===0?130:-60},${iterations%2===0?25:-25})`);
    if(iterations%8===0){
      const seed=(27011984+iterations*1777)>>>0,before=await snapshot();
      const bad=await evaluate(`window.__ENGINE_TEST.generate(${seed},${iterations/8%8+1})`);
      assert.equal(bad.accepted,false);assert.equal((await snapshot()).activeId,before.activeId);rejected++;
      const good=await evaluate(`window.__ENGINE_TEST.generate(${seed},0)`);assert.equal(good.accepted,true);
      await evaluate('window.__ENGINE_TEST.activate()');await wait(`window.__ENGINE_TEST.snapshot().seed===${seed}`);activated++;
    }
    if(iterations%10===0){
      const portrait=iterations%20===0;
      await cmd('Emulation.setDeviceMetricsOverride',{width:portrait?500:1376,height:portrait?900:768,deviceScaleFactor:iterations%20===0?1.5:1,mobile:false});
      await evaluate(`window.__ENGINE_TEST.view({resolution:${portrait?540:360},relief:${portrait?.5:1}})`);
    }
    await sleep(500);const d=await snapshot();samples.push(d);
    assert.equal(d.error,null);assert.equal(d.wasmMemoryBytes,16*1048576);assert.ok(d.gpuMeshBytes<2*1048576);
    assert.equal(await evaluate('window.__ENGINE_TEST.playerClear()'),true,'Movement/activation penetrated structural geometry');
    iterations++;
  }
  await evaluate('window.__ENGINE_TEST.input(0);window.__ENGINE_TEST.view({resolution:360,relief:1})');
  await cmd('HeapProfiler.collectGarbage');const heapAfter=await cmd('Runtime.getHeapUsage'),final=await snapshot();
  assert.ok(final.frames-initial.frames>600,'The frame loop stalled during the soak');
  assert.ok(heapAfter.usedSize-heapBefore.usedSize<4*1048576,'Retained JS heap grew beyond the bounded test allowance');
  assert.deepEqual(errors,[]);
  const report={passed:true,durationMs:performance.now()-start,iterations,activated,rejected,frames:final.frames-initial.frames,
    browser:(await cmd('Browser.getVersion')).product,heapBeforeBytes:heapBefore.usedSize,heapAfterBytes:heapAfter.usedSize,
    wasmMemoryBytes:final.wasmMemoryBytes,maxActiveMeshBytes:Math.max(...samples.map(s=>s.gpuMeshBytes)),
    minMedianFps:Math.min(...samples.map(s=>s.fps)),maxCpuP95Ms:Math.max(...samples.map(s=>s.cpuMs.p95)),
    checks:['Continuous body/weapon movement remains clear','Repeated valid staging/activation and invalid rejection','Portrait/high-DPI and quality changes while moving','Fixed WASM memory and bounded active mesh/retained JS heap','No uncaught errors or frame-loop stall'],final};
  await writeFile(new URL('../evidence/soak-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,final:undefined},null,2));
});
