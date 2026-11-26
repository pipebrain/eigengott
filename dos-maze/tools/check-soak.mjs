import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from './browser.mjs';
const checkpoints=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
  await cmd('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await cmd('Performance.enable');await cmd('Page.navigate',{url:origin+'/dos-maze/'});await wait('window.__DOS_MAZE?.ready');
  await cmd('HeapProfiler.collectGarbage');
  const heap=async()=>Object.fromEntries((await cmd('Performance.getMetrics')).metrics.map(m=>[m.name,m.value])).JSHeapUsedSize;
  const initialHeap=await heap();
  for(let n=0;n<6;n++){
    await sleep(10500);const d=await evaluate('window.__DOS_MAZE.snapshot()');
    assert.equal(d.error,null);assert.equal(d.recoveries,0);assert.equal(d.wasmMemoryBytes,8*1048576);assert.equal(d.targetCount,4);
    assert.ok(Number.isFinite(d.state)&&d.state>=0&&d.state<=1);assert.ok(d.frames>0);
    checkpoints.push(d);console.log(JSON.stringify({time:d.time,frames:d.frames,redraws:d.redraws,fps:d.fps,cpuMs:d.cpuMs}));
  }
  const last=checkpoints.at(-1);assert.ok(last.time>=60,'Two complete animation cycles must be exercised');assert.ok(last.redraws>=15,'Flicker redraws must be exercised');
  await cmd('HeapProfiler.collectGarbage');const finalHeap=await heap();
  assert.ok(finalHeap-initialHeap<3*1048576,'Retained JS heap grew unexpectedly');
  // A suspended tab stops its clock, then resumes without catching up missed time.
  await cmd('Page.setWebLifecycleState',{state:'frozen'});await sleep(1000);await cmd('Page.setWebLifecycleState',{state:'active'});await sleep(200);
  const resumed=await evaluate('window.__DOS_MAZE.snapshot()');assert.ok(resumed.time-last.time<.7);
  assert.deepEqual(errors,[]);
  const report={passed:true,browser:'Chrome headless / Metal WebGPU',durationSeconds:last.time,initialHeapBytes:initialHeap,finalHeapBytes:finalHeap,checkpoints,checks:['Two full cycles with default flicker/redraw','Stable WASM memory and render-target count','Bounded retained JS heap after collection','Freeze/resume without advancing suspended time','No runtime or WebGPU errors']};
  await writeFile(new URL('../evidence/soak-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
});
