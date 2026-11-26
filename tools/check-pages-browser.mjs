import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {withBrowser,sleep} from '../dos-maze/tools/browser.mjs';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
  const base=new URL(process.env.PAGES_URL||`${origin}/_site/`);
  const buildResponse=await fetch(new URL(`build.json?check=${Date.now()}`,base));assert.equal(buildResponse.status,200);
  const build=await buildResponse.json();assert.equal(build.commit,commit);
  await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:base.href});await wait('document.querySelector("#build")?.textContent.includes("Build")');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  assert.equal(await evaluate('globalThis.__EIGENGOTT_BUILD.commit'),commit);checks.push('Mobile-width landing page, build identity, and test links');
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  for(const [app,handle] of [['engine-test','__ENGINE_TEST'],['engine-benchmark','__ARENA_BENCHMARK'],['dos-maze','__DOS_MAZE']]){
    await cmd('Page.navigate',{url:new URL(`${app}/?tools=1`,base).href});await wait(`window.${handle}?.ready`);
    assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);
    assert.equal(await evaluate(`window.${handle}.snapshot().deployment.commit`),commit);
    assert.equal(await evaluate('document.querySelector("[data-deployment-build]").dataset.deploymentBuild'),commit);
    if(app==='engine-benchmark'){
      const result=await evaluate('window.__ARENA_BENCHMARK.generate(94,0,{profile:2,lights:48,density:2,detail:1})');assert.equal(result.accepted,true);
      await evaluate('window.__ARENA_BENCHMARK.activate()');await wait('window.__ARENA_BENCHMARK.snapshot().profile===2');assert.equal(await evaluate('window.__ARENA_BENCHMARK.snapshot().candidateErrors'),0);
    }
    checks.push(`${app}: WebGPU/WASM startup, tools URL, deployed commit${app==='engine-benchmark'?', worker generation and activation':''}`);
  }
  await cmd('Page.navigate',{url:new URL('vector-labyrinth/?tools=1',base).href});await wait('location.pathname.endsWith("/vector-labyrinth/")&&document.querySelector("#status")?.hidden');
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);assert.equal(await evaluate('document.querySelector("[data-deployment-build]").dataset.deploymentBuild'),commit);
  checks.push('Full vector lab loads its presets, reference geometry, shaders, and WASM');
  await cmd('Page.navigate',{url:new URL('arena-fold/?test&tools=1',base).href});await wait('window.__fold?.snapshot().ready');
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);assert.equal(await evaluate('window.__fold.snapshot().build.commit'),commit);
  assert.equal(await evaluate('document.querySelector("[data-deployment-build]").dataset.deploymentBuild'),commit);
  await evaluate('window.__fold.configure({duration:1});window.__fold.trigger()');await wait('window.__fold.snapshot().fold.phase>.4');
  assert.equal(await evaluate('window.__fold.snapshot().fold.clear&&window.__fold.snapshot().fold.sealed'),true);
  checks.push('Arena fold: deployed identity, tools URL, protected moving geometry and feedback');
  const {identifier}=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(document,"exitPointerLock",{value:undefined,configurable:true});Object.defineProperty(Element.prototype,"requestPointerLock",{value:undefined,configurable:true});'});
  for(const [app,handle]of [['engine-test','__ENGINE_TEST'],['engine-benchmark','__ARENA_BENCHMARK']]){
    await cmd('Page.navigate',{url:new URL(`${app}/?tools=1`,base).href});await wait(`window.${handle}?.ready`);
    assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);
  }
  await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier});checks.push('Engine inspection tools open without Pointer Lock APIs');
  for(const [app,binary]of [['engine-test','engine.wasm'],['engine-benchmark','engine.wasm'],['arena-fold','fold.wasm']]){
    const response=await fetch(new URL(`${app}/${binary}?check=${Date.now()}`,base));assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/application\/wasm/);
  }
  assert.deepEqual(errors,[]);await sleep(100);
  const report={passed:true,url:base.href,commit,checks};await writeFile('.local/pages-browser-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
