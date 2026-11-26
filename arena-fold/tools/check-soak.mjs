import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from '../../dos-maze/tools/browser.mjs';
await mkdir('.local/arena-fold',{recursive:true});
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
 const url=new URL('?test',process.env.FOLD_URL||origin+'/arena-fold/');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
 await cmd('Performance.enable');await cmd('Page.navigate',{url:url.href});await wait('window.__fold?.snapshot().ready');
 await evaluate('document.querySelector("#gate").hidden=true;window.__fold.configure({loop:true});window.__fold.trigger();window.__fold.play(true)');
 await cmd('HeapProfiler.collectGarbage');const metrics=await cmd('Performance.getMetrics'),heap0=metrics.metrics.find(m=>m.name==='JSHeapUsedSize').value;
 const samples=[];let lastPhase=0,reversals=0,sign=1;
 for(let n=0;n<30;n++){
  await sleep(1000);await evaluate('window.__fold.input(0,2,0)');const d=await evaluate('window.__fold.snapshot()');
  assert.ok(d.fold.clear&&d.fold.sealed&&d.fold.bounded);assert.equal(d.error,null);assert.equal(d.wasmBytes,4194304);assert.ok(d.render.pendingFrames<=2);
  const next=Math.sign(d.fold.phase-lastPhase);if(next&&next!==sign)reversals++;if(next)sign=next;lastPhase=d.fold.phase;
  samples.push({second:n+1,fps:d.fps,cpuMs:d.cpuMs,gpuMs:d.render.gpuMs,phase:d.fold.phase,queue:d.render.pendingFrames,targets:d.render.renderTargetBytes});
 }
 assert.ok(reversals>=4);await cmd('HeapProfiler.collectGarbage');const end=await cmd('Performance.getMetrics'),heap1=end.metrics.find(m=>m.name==='JSHeapUsedSize').value;
 assert.deepEqual(errors,[]);const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
 const gpu=samples.map(s=>s.gpuMs?.total).filter(Number.isFinite),fps=samples.map(s=>s.fps);
 const report={passed:true,url:url.href,seconds:30,userAgent:await evaluate('navigator.userAgent'),snapshot:await evaluate('window.__fold.snapshot()'),reversals,retainedJSHeapBytes:{before:heap0,after:heap1,delta:heap1-heap0},sampledGPU:{p50:percentile(gpu,.5),p95:percentile(gpu,.95),max:Math.max(...gpu)},sampledFPS:{min:Math.min(...fps),median:percentile(fps,.5)},samples};
 await writeFile('.local/arena-fold/soak.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,snapshot:undefined,samples:undefined},null,2));
});
