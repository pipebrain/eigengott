import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBrowser,sleep} from '../../dos-maze/tools/browser.mjs';
import {pixels} from '../../dos-maze/tools/pixels.mjs';
const checks=[],samples=[];await mkdir('.local/arena-fold',{recursive:true});
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
 const base=new URL(process.env.FOLD_URL||origin+'/arena-fold/');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
 await cmd('Page.navigate',{url:new URL('?test',base).href});await wait('window.__fold?.snapshot().ready');await sleep(1500);
 const initial=await evaluate('window.__fold.snapshot()');assert.ok(initial.fold.clear&&initial.fold.sealed);samples.push({name:'startup',snapshot:initial});
 await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'});
 assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);
 await evaluate('window.__fold.test.stop()');
 // The world under the actor must be identical with actor visibility and
 // debug overlays changed. Read back the owned history, not a screenshot.
 const actor=await evaluate(`(async()=>{const a=window.__fold;a.reset();a.test.stop();a.configure({openingFollow:false,opening:0,showBody:true,debug:0});a.clearHistory();await a.test.render();return a.test.history();})()`);
 const noActor=await evaluate(`(async()=>{const a=window.__fold;a.configure({showBody:false});a.clearHistory();await a.test.render();return a.test.history();})()`);
 const debug=await evaluate(`(async()=>{const a=window.__fold;a.configure({showBody:true,debug:3});a.clearHistory();await a.test.render();return a.test.history();})()`);
 assert.equal(actor.hash,noActor.hash);assert.equal(actor.hash,debug.hash);assert.ok(actor.alpha>actor.width*actor.height*.99);
 checks.push('Body, weapon and debug lines excluded from history (exact GPU readback equality)');
 const black=await evaluate(`(async()=>{const a=window.__fold;a.configure({opening:1,feedback:false,showBody:false,debug:0});a.clearHistory();await a.test.render();return a.test.history();})()`);
 assert.equal(black.alpha,0);assert.equal(black.lit,0);checks.push('Feedback disabled + all faces hidden produces a cleared black void');
 const retained=await evaluate(`(async()=>{const a=window.__fold;a.configure({opening:0,feedback:true,worldAnchor:false,stretch:0,feedbackFreeze:false});a.clearHistory();await a.test.render();a.configure({opening:1});for(let n=0;n<24;n++)await a.test.render(.1);return a.test.history();})()`);
 assert.ok(retained.alpha>actor.alpha*.47&&retained.alpha<actor.alpha*.51);assert.ok(retained.lit>0);
 const frozen=await evaluate(`(async()=>{const a=window.__fold;a.configure({feedbackFreeze:true});for(let n=0;n<10;n++)await a.test.render(.1);return a.test.history();})()`);
 assert.equal(retained.hash,frozen.hash);
 const faded=await evaluate(`(async()=>{const a=window.__fold;a.configure({feedbackFreeze:false});for(let n=0;n<240;n++)await a.test.render(.1);return a.test.history();})()`);
 assert.ok(faded.alpha<actor.alpha*.001);checks.push('Time-based half-life, independent feedback freeze, and long decay without an 8-bit retention floor');
 // Guard fixtures exercise the same exported core through the running page.
 for(const [fixture,reason]of [[1,2],[2,1]]){
  const result=await evaluate(`(()=>{const a=window.__fold;a.reset(${fixture});a.test.stop();a.configure({geometry:true,duration:1});a.trigger();for(let n=0;n<240;n++)a.test.sim.fold_tick(1/120,0,0,0);return a.snapshot();})()`);
  assert.ok(result.fold.blockedPanels);assert.equal(result.fold.blockedBy,reason);assert.ok(result.fold.clear&&result.fold.sealed);
 }
 checks.push('Weapon and body fixtures hold safely through browser WASM');
 // Independent controls: geometry paused while feedback advances, then
 // geometry advances with feedback disabled.
 const independent=await evaluate(`(async()=>{const a=window.__fold;a.reset();a.test.stop();a.configure({geometry:false,openingFollow:false,opening:0,feedback:true,feedbackFreeze:false,worldAnchor:false,stretch:3,debug:0,showBody:true});a.trigger();await a.test.render();a.configure({opening:.9});for(let n=0;n<30;n++){a.test.sim.fold_tick(1/120,0,0,0);await a.test.render(1/60);}const f=a.snapshot().fold.phase;a.configure({geometry:true,feedback:false});for(let n=0;n<60;n++)a.test.sim.fold_tick(1/120,0,0,0);return {f,g:a.snapshot().fold.phase};})()`);
 assert.equal(independent.f,0);assert.ok(independent.g>.4);checks.push('Geometry and feedback enable / pause controls operate independently');
 // Final-pixel hatches keep exact one-pixel walls / nine-pixel pitch at
 // different internal resolutions. History is seeded before opening all faces.
 for(const resolution of [180,360,720]){
  await evaluate(`(async()=>{const a=window.__fold;a.reset();a.test.stop();a.configure({resolution:${resolution},openingFollow:false,opening:0,feedback:true,feedbackFreeze:true,worldAnchor:false,stretch:0,style:0,grid:1,pitch:9,lineWidth:1,branch:1,showBody:false,debug:0});a.clearHistory();await a.test.render();a.configure({opening:1});await a.test.render();document.querySelector('#gate').hidden=true;document.querySelector('#controls').hidden=true;})()`);
  const shot=await cmd('Page.captureScreenshot',{format:'png'}),p=pixels(Buffer.from(shot.data,'base64')),y=Math.floor(p.height*.51);
  for(let x=0;x<p.width;x++){const on=p.data[(y*p.width+x)*3]>4;assert.equal(on,x%9===0,`Grid deviated at ${x}, resolution ${resolution}`);}
 }
 checks.push('GPU screenshot: exact one-pixel lines and nine-pixel pitch at 180 / 360 / 720 internal heights');
 await evaluate('window.__fold.configure({branch:.5});window.__fold.test.render()');
 const mixedShot=await cmd('Page.captureScreenshot',{format:'png'}),mixed=pixels(Buffer.from(mixedShot.data,'base64'));
 for(let y=0;y<mixed.height;y++)for(let x=0;x<mixed.width;x++)if(mixed.data[(y*mixed.width+x)*3]>4)assert.ok(x%9===0||y%9===0,`Branch seam escaped the grid at ${x},${y}`);
 checks.push('Mixed hatch directions and branch seams remain on the exact output grid');
 // Draw representative line and colour modes; all passes must stay valid.
 for(const [name,settings]of [['architectural',{style:0,worldAnchor:true,grid:1}],['perspective',{style:0,worldAnchor:true,grid:0}],['diagonal',{style:0,worldAnchor:true,grid:2}],['afterimages',{style:1,worldAnchor:false,grid:1}]]){
  await evaluate(`(async()=>{const a=window.__fold;a.reset();a.test.stop();a.configure({geometry:true,duration:4,feedback:true,feedbackFreeze:false,openingFollow:true,opening:.78,stretch:2,showBody:true,debug:0,...${JSON.stringify(settings)}});a.clearHistory();a.trigger();await a.test.render();for(let n=0;n<240;n++){a.test.sim.fold_tick(1/120,0,n%4===0?.4:0,0);if(n%2===0)await a.test.render(1/60);}document.querySelector('#gate').hidden=true;document.querySelector('#controls').hidden=true;await a.test.render();})()`);
  const shot=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(`.local/arena-fold/${name}.png`,Buffer.from(shot.data,'base64'));
  assert.equal(await evaluate('window.__fold.snapshot().error'),null);
 }
 checks.push('Architectural, perspective, 45-degree hatch and colour afterimage modes render without WebGPU errors');
 for(const [width,height,quality]of [[390,844,180],[1376,768,720],[960,540,360]]){
  await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:false});await sleep(100);
  const result=await evaluate(`(async()=>{const a=window.__fold;a.configure({resolution:${quality},dpr:1});await a.test.render();return a.snapshot();})()`);
  assert.deepEqual(result.render.output,[width,height]);assert.equal(result.render.resolution[1],Math.min(height,quality));assert.equal(result.render.renderTargetBytes,result.render.resolution[0]*result.render.resolution[1]*28);
 }
 checks.push('Resize / quality / DPR reset and recreate bounded history targets');
 const beforeLoss=await evaluate('window.__fold.snapshot().fold');
 await evaluate('window.__fold.test.lose()');await wait('window.__fold?.snapshot().ready&&window.__fold.snapshot().recoveries===1');
 await evaluate('window.__fold.test.render()');const afterLoss=await evaluate('window.__fold.snapshot().fold');assert.ok(afterLoss.clear);assert.deepEqual(afterLoss.position,beforeLoss.position);assert.equal(afterLoss.phase,beforeLoss.phase);checks.push('GPU device loss recovery preserves physical state and resets history');
 await evaluate('window.__fold.test.resume()');await sleep(300);
 const beforeHide=await evaluate('window.__fold.snapshot().fold.time');
 await cmd('Page.setWebLifecycleState',{state:'frozen'});await sleep(400);await cmd('Page.setWebLifecycleState',{state:'active'});await cmd('Emulation.setFocusEmulationEnabled',{enabled:true});await wait('!document.hidden');
 await sleep(100);assert.ok(await evaluate(`window.__fold.snapshot().fold.time-${beforeHide}<.3`));checks.push('Hidden / frozen lifecycle pauses simulation without a catch-up jump');
 // Native user entry and H release, then a bounded animated stress run.
 await evaluate('window.__fold.reset();document.querySelector("#controls").hidden=true;document.querySelector("#gate").hidden=false');
 const center=await evaluate('(()=>{const r=document.querySelector("#enter").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
 await cmd('Page.bringToFront');await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...center});await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...center});await wait('document.pointerLockElement===document.querySelector("#scene")');
 await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'});await wait('!document.pointerLockElement&&!document.querySelector("#controls").hidden');checks.push('Native Pointer Lock entry and H-menu release');
 await evaluate('window.__fold.configure({geometry:true,loop:true,duration:1,feedback:true,openingFollow:true,resolution:360,style:0,worldAnchor:true,grid:1});window.__fold.trigger()');
 for(let n=0;n<8;n++){await sleep(1000);const d=await evaluate('window.__fold.snapshot()');assert.ok(d.fold.clear&&d.fold.sealed&&d.fold.bounded);assert.equal(d.error,null);assert.ok(d.render.pendingFrames<=2);if(n%3===0)samples.push({name:'animated-'+n,snapshot:d});}
 checks.push('Eight-second bounded animated run: sealed, clear, bounded queue and memory');
 const {identifier}=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(document,"exitPointerLock",{value:undefined,configurable:true});Object.defineProperty(Element.prototype,"requestPointerLock",{value:undefined,configurable:true});'});
 await cmd('Page.navigate',{url:new URL('?test',base).href});await wait('window.__fold?.snapshot().ready');await evaluate('document.querySelector("#enter").click()');assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);checks.push('Inspection fallback without Pointer Lock APIs');await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier});
 const noGPU=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"gpu",{value:undefined,configurable:true});'});
 await cmd('Page.navigate',{url:new URL('?test',base).href});await wait('document.querySelector("#retry")?.hidden===false');assert.match(await evaluate('document.querySelector("#message").textContent'),/WebGPU is unavailable/);await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:noGPU.identifier});
 await evaluate('document.querySelector("#retry").click()'); // Same document still has no GPU: no crash / unsafe fallback.
 await sleep(100);checks.push('Unavailable WebGPU shows a bounded retry state');
 assert.deepEqual(errors,[]);
 const report={passed:true,url:base.href,userAgent:await evaluate('navigator.userAgent'),checks,samples,history:{actor,noActor,debug,black,retained,frozen,faded}};
 await writeFile('.local/arena-fold/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks,samples:samples.map(s=>({name:s.name,fps:s.snapshot.fps,cpuMs:s.snapshot.cpuMs,gpuMs:s.snapshot.render.gpuMs}))},null,2));
});
