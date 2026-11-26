import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser} from '../../dos-maze/tools/browser.mjs';
const checks=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors,requests})=>{
 const base=new URL(process.env.ENCOUNTER_URL||origin+'/encounter-test/');
 await cmd('Page.navigate',{url:new URL('?test',base).href});await wait('window.__encounter?.snapshot().ready&&!window.__encounter.snapshot().preparing');
 await evaluate('window.__encounter.configure({freezeAI:true,godMode:true});window.staleCharacter=window.__encounter.character("arachna");window.replacement=window.__encounter.load({seed:95})');
 await wait('!window.__encounter.snapshot().preparing&&!window.__encounter.snapshot().avatarLoading');
 assert.equal((await evaluate('window.replacement')).accepted,true);assert.equal(await evaluate('window.staleCharacter'),false);
 assert.equal(await evaluate('window.__encounter.snapshot().game.player.model'),'sarge');assert.equal(await evaluate('window.__encounter.snapshot().settings.seed'),95);
 assert.equal(await evaluate('window.__encounter.snapshot().error'),null);checks.push('In-flight avatar selection cannot mutate a newer validated arena');
 const {identifier}=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"gpu",{value:undefined,configurable:true});'});
 const n=requests.length;await cmd('Page.navigate',{url:new URL('?test',base).href});await wait('document.querySelector("#message")?.textContent.includes("WebGPU is unavailable")');
 assert.equal(await evaluate('document.querySelector("#retry").hidden'),false);
 assert.equal(requests.slice(n).some(r=>String(r.url||r).includes('/assets/')),false);
 await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier});checks.push('Missing WebGPU presents a recoverable error before downloading media');
 assert.deepEqual(errors,[]);const report={passed:true,url:base.href,checks};await mkdir('.local/encounter',{recursive:true});await writeFile('.local/encounter/lifecycle.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
});
