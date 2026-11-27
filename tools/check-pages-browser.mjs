import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {withBrowser,sleep} from '../dos-maze/tools/browser.mjs';
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
  const startup=async expression=>{for(let n=0;n<600;n++){if(await evaluate(expression))return;await sleep(100);}throw new Error('Network startup timed out: '+expression+' '+JSON.stringify(errors));};
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
  await cmd('Page.navigate',{url:new URL('arena-fold-2/?test&tools=1',base).href});await wait('window.__wave?.snapshot().ready');
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);assert.equal(await evaluate('window.__wave.snapshot().build.commit'),commit);
  assert.equal(await evaluate('document.querySelector("[data-deployment-build]").dataset.deploymentBuild'),commit);
  await evaluate('window.__wave.configure({slotDuration:.25,delay:.08,tail:.1,jitter:0});window.__wave.trigger()');await wait('window.__wave.snapshot().wave.completed===1');
  assert.equal(await evaluate('window.__wave.snapshot().wave.clear&&window.__wave.snapshot().wave.sealed&&!window.__wave.snapshot().wave.bodies'),true);
  checks.push('Candidate 2: deployed identity, tools URL, corruption wave and global body cleanup');
  await cmd('Page.navigate',{url:new URL('arena-sweep/?test&tools=1',base).href});await wait('window.__sweep?.snapshot().ready&&!window.__sweep.snapshot().preparing');
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);assert.equal(await evaluate('window.__sweep.snapshot().build.commit'),commit);
  assert.equal(await evaluate('document.querySelector("[data-deployment-build]").dataset.deploymentBuild'),commit);
  await evaluate('window.__sweep.configure({outSeconds:.5,backSeconds:.5,turnSeconds:.1});window.__sweep.trigger()');await wait('window.__sweep.snapshot().sweep.completed===1');
  assert.equal(await evaluate('(()=>{const s=window.__sweep.snapshot().sweep;return !s.lootOpen&&s.fields===0&&s.remainingBodies===0&&s.enemies.length>0&&s.enemies.every(e=>e.released&&e.release===s.release);})()'),true);
  checks.push('Procedural sweep: deployed identity, tools URL, worker preparation and shared field release');
  await cmd('Page.navigate',{url:new URL('encounter-test/?test&tools=1',base).href});await startup('window.__encounter?.snapshot().ready&&!window.__encounter.snapshot().preparing');
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);assert.equal(await evaluate('window.__encounter.snapshot().build.commit'),commit);
  assert.equal(await evaluate('document.querySelector("[data-deployment-build]").dataset.deploymentBuild'),commit);
  await evaluate('window.__encounter.configure({outSeconds:.5,backSeconds:.5,turnSeconds:.1});window.__encounter.targetFixture();window.__encounter.test.game.bots[0].health=1;window.__encounter.selectWeapon(2);window.__encounter.actions(1);window.__encounter.play(true);window.__encounter.actions(1)');
  await wait('window.__encounter.snapshot().sweep.completed===1');await evaluate('window.__encounter.actions(0);window.__encounter.play(false)');
  assert.equal(await evaluate('(()=>{const s=window.__encounter.snapshot();return s.settings.physicalModels&&s.game.encounter===2&&s.game.alive===3&&s.game.bodies===0&&s.sweep.fields===0&&s.media.characters===18&&s.media.weapons===13;})()'),true);
  checks.push('Interactive encounter: imported roster, physical envelopes, automatic combat / Recomposition and deployed identity');
  await cmd('Page.navigate',{url:new URL('playable-test/?test&tools=1',base).href});await startup('window.__playable?.snapshot().ready&&!window.__playable.snapshot().preparing');
  assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);assert.equal(await evaluate('window.__playable.snapshot().build.commit'),commit);
  assert.equal(await evaluate('document.querySelector("[data-deployment-build]").dataset.deploymentBuild'),commit);
  await evaluate('window.__playable.configure({outSeconds:.5,backSeconds:.5,turnSeconds:.1,lootSlow:1});window.__playable.clearEncounter()');
  await wait('window.__playable.snapshot().sweep.completed===1');
  assert.equal(await evaluate('(()=>{const s=window.__playable.snapshot();return s.game.run.remaining===10&&s.game.encounter===2&&s.game.inventory.length===1&&s.game.loot.items.length===0&&s.sweep.fields===0&&s.audio.processing==="none";})()'),true);
  checks.push('Playable run: finite ledger, one-gun loot / Release, shared maze and original-speed audio configuration');
  const {identifier}=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(document,"exitPointerLock",{value:undefined,configurable:true});Object.defineProperty(Element.prototype,"requestPointerLock",{value:undefined,configurable:true});'});
  for(const [app,handle]of [['engine-test','__ENGINE_TEST'],['engine-benchmark','__ARENA_BENCHMARK']]){
    await cmd('Page.navigate',{url:new URL(`${app}/?tools=1`,base).href});await wait(`window.${handle}?.ready`);
    assert.equal(await evaluate('document.querySelector("#controls").hidden'),false);
  }
  await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier});checks.push('Engine inspection tools open without Pointer Lock APIs');
  for(const [app,binary]of [['engine-test','engine.wasm'],['engine-benchmark','engine.wasm'],['arena-fold','fold.wasm'],['arena-fold-2','wave.wasm'],['arena-sweep','engine.wasm'],['encounter-test','engine.wasm'],['playable-test','engine.wasm']]){
    const response=await fetch(new URL(`${app}/${binary}?check=${Date.now()}`,base));assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/application\/wasm/);
  }
  assert.deepEqual(errors,[]);await sleep(100);
  const report={passed:true,url:base.href,commit,checks};await writeFile('.local/pages-browser-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
