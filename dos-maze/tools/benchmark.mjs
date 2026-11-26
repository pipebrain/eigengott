import {writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from './browser.mjs';
const cases=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
  await cmd('Performance.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`
    const submit=GPUQueue.prototype.submit;GPUQueue.prototype.submit=function(commands){window.__benchQueue=this;GPUQueue.prototype.submit=submit;return submit.call(this,commands);};
    const raf=requestAnimationFrame;window.__benchHold=false;
    window.requestAnimationFrame=function(callback){window.__benchFrame=callback;if(window.__benchHold)return 0;return window.__benchRaf=raf(callback);};
  `});
  for(const [width,height] of [[1376,768],[3840,2160]]){
    const results={width,height,dpr:1};
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    for(const app of ['vector-labyrinth','dos-maze']){
      await cmd('Page.navigate',{url:`${origin}/${app}/?state=0.5&time=7.5&flicker=off`});
      await wait(app==='dos-maze'?'window.__DOS_MAZE?.ready':'window.__VECTOR_STUDY?.ready');await sleep(1500);
      const counter=app==='dos-maze'?'window.__DOS_MAZE.snapshot().frames':'window.__VECTOR_STUDY.frameRequests';
      const boundary=resume=>evaluate(`(async()=>{window.__benchHold=true;cancelAnimationFrame(window.__benchRaf);await window.__benchQueue.onSubmittedWorkDone();const value={now:performance.now(),frames:${counter}};${resume?'window.__benchHold=false;requestAnimationFrame(window.__benchFrame);':''}return value;})()`);
      const before=await boundary(true),beforeMetrics=Object.fromEntries((await cmd('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
      await sleep(3000);
      const after=await boundary(false),afterMetrics=Object.fromEntries((await cmd('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
      const frames=after.frames-before.frames,elapsedMs=after.now-before.now;
      results[app]={frames,elapsedMs,fps:frames/elapsedMs*1000,mainThreadMsPerFrame:(afterMetrics.TaskDuration-beforeMetrics.TaskDuration)*1000/frames,jsHeapBytes:afterMetrics.JSHeapUsedSize};
    }
    results.throughputRatio=results['dos-maze'].fps/results['vector-labyrinth'].fps;
    results.mainThreadReduction=1-results['dos-maze'].mainThreadMsPerFrame/results['vector-labyrinth'].mainThreadMsPerFrame;
    cases.push(results);console.log(JSON.stringify(results));
  }
  if(errors.length)throw new Error(JSON.stringify(errors));
},{unlimited:true});
const report={environment:'Local Chrome headless, Metal WebGPU; vsync/frame-rate limit disabled; GPU queue drained at both measurement boundaries',scope:'Same default 4x MSAA and DPR, continuously moving state 0.5, flicker disabled; local results are not physical-device guarantees',cases};
await writeFile(new URL('../evidence/browser-benchmark.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
