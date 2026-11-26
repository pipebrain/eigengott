import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from '../../dos-maze/tools/browser.mjs';
await mkdir('.local/arena-fold-2',{recursive:true});
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
 const url=new URL('?test',process.env.WAVE_URL||origin+'/arena-fold-2/');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
 await cmd('Performance.enable');await cmd('Page.navigate',{url:url.href});await wait('window.__wave?.snapshot().ready');
 await evaluate('document.querySelector("#gate").hidden=true;window.__wave.configure({loop:true});window.__wave.trigger();window.__wave.play(true)');
 await cmd('HeapProfiler.collectGarbage');const metrics=await cmd('Performance.getMetrics'),heap0=metrics.metrics.find(m=>m.name==='JSHeapUsedSize').value;
 const samples=[];let maximumAge=0;
 for(let n=0;n<30;n++){
  await sleep(1000);await evaluate('window.__wave.input(0,2,0)');const d=await evaluate('window.__wave.snapshot()');
  assert.ok(d.wave.clear&&d.wave.sealed&&d.wave.catalogValid);assert.equal(d.error,null);assert.equal(d.wasmBytes,4194304);assert.ok(d.render.pendingFrames<=2);
  maximumAge=Math.max(maximumAge,d.wave.oldestAge);if(n===9)await evaluate("window.__wave.configure({coherence:.5})");if(n===19)await evaluate("window.__wave.configure({coherence:.9})");
  samples.push({second:n+1,fps:d.fps,cpuMs:d.cpuMs,gpuMs:d.render.gpuMs,cycle:d.wave.cycle,completed:d.wave.completed,visited:d.wave.visited,changed:d.wave.changed,bodies:d.wave.bodies,coherence:d.wave.coherence,age:d.wave.oldestAge,queue:d.render.pendingFrames,targets:d.render.renderTargetBytes});
 }
 assert.ok(maximumAge>=2);assert.ok((await evaluate("window.__wave.snapshot().wave.completed"))>=3);await cmd('HeapProfiler.collectGarbage');const end=await cmd('Performance.getMetrics'),heap1=end.metrics.find(m=>m.name==='JSHeapUsedSize').value;
 assert.deepEqual(errors,[]);const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
 const gpu=samples.map(s=>s.gpuMs?.total).filter(Number.isFinite),fps=samples.map(s=>s.fps);
 const report={passed:true,url:url.href,seconds:30,userAgent:await evaluate('navigator.userAgent'),snapshot:await evaluate('window.__wave.snapshot()'),maximumAge,retainedJSHeapBytes:{before:heap0,after:heap1,delta:heap1-heap0},sampledGPU:{p50:percentile(gpu,.5),p95:percentile(gpu,.95),max:Math.max(...gpu)},sampledFPS:{min:Math.min(...fps),median:percentile(fps,.5)},samples};
 await writeFile('.local/arena-fold-2/soak.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,snapshot:undefined,samples:undefined},null,2));
});
