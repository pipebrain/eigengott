import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from '../dos-maze/tools/browser.mjs';
await mkdir('.local/game',{recursive:true});
await withBrowser(async({origin,cmd,evaluate:ev,wait,errors})=>{
 const base=process.env.GAME_URL||origin+'/_site/',app='window.__EIGENGOTT_GAME.app',snap=()=>ev(app+'.snapshot()'),click=async selector=>{
  const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  for(const type of ['mousePressed','mouseReleased'])await cmd('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...p});
 };
 await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});await cmd('Page.navigate',{url:base+'?test'});await wait('window.__EIGENGOTT_GAME?.app?.ready');await cmd('Page.bringToFront');for(const type of ['keyDown','keyUp'])await cmd('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32});
 await ev(`${app}.configure({godMode:true,freezeAI:true,randomWorkload:false,botCountRandom:false,botCount:3,lootCount:5,outSeconds:1,backSeconds:2,turnSeconds:10});`);assert.equal((await ev(`${app}.load({profile:0})`)).accepted,true);assert.equal(await ev(`${app}.inventory(true)`),true);
 await ev(`${app}.clearEncounter()`);await wait(`${app}.snapshot().sweep.phase==='outbound'`);const start=await snap();await sleep(250);const collapse=await snap();assert.ok(collapse.frames>start.frames);assert.ok(collapse.sweep.hidden>start.sweep.hidden);assert.equal(await ev('document.querySelector("#gate").hidden'),true);
 await wait(`${app}.snapshot().sweep.phase==='turn'`);await wait(`${app}.snapshot().render.previews.labels.labels.length===5`);
 const stable=await ev(`(()=>{const a=${app},d=a.snapshot(),p=d.game.player.p;return {z:p[2],floor:a.test.game.floorAt(p[0],p[1],d.game.player.gear.radius),landing:d.sweep.landing[2]};})()`);await sleep(600);const later=await snap();assert.ok(later.game.player.p[2]>=Math.max(stable.floor,stable.landing)-.02);assert.ok(later.game.player.p[2]>=stable.z-.02);assert.equal(later.paused,false);assert.equal(await ev(app+'.playing'),true);
 const layouts=[];for(const [width,height]of [[1376,768],[390,844]]){
  await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);const d=await snap(),labels=d.render.previews.labels.labels;assert.equal(labels.length,5);
  for(const a of labels){assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=width&&a.y+a.height<=height);assert.equal(a.leader.length,2);for(const s of a.leader)assert.ok(s[0]===s[2]||s[1]===s[3]);}
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert.ok(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y));}
  const shot=await cmd('Page.captureScreenshot',{format:'png'});await writeFile(`.local/game/loot-${width}.png`,Buffer.from(shot.data,'base64'));layouts.push({width,height,labels});
 }
 await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});await sleep(150);
 // Exercise a native item click rather than calling the exchange API.
 const item=(await snap()).game.loot.items.find(i=>i.kind==='armor')||(await snap()).game.loot.items[0];await click('[data-item="'+item.id+'"]');await wait(`${app}.snapshot().sweep.phase==='inbound'`);const returning=await snap();assert.equal(returning.game.loot.chosen,true);assert.equal(returning.game.loot.visible,false);assert.equal(await ev('document.querySelector("#gate").hidden'),true);assert.equal(await ev(app+'.playing'),true);assert.equal(returning.paused,false);assert.ok(returning.game.player.p[2]>=returning.sweep.landing[2]-.02);
 const firstHidden=returning.sweep.hidden,firstFrame=returning.frames;await wait(`${app}.snapshot().sweep.phase==='inbound'&&${app}.snapshot().sweep.hidden<${firstHidden}`);const building=await snap();assert.ok(building.frames>firstFrame);assert.ok(building.sweep.hidden<firstHidden);assert.equal(await ev('document.querySelector("#gate").hidden'),true);const rebuildShot=await cmd('Page.captureScreenshot',{format:'png'});await writeFile('.local/game/rebuild-visible.png',Buffer.from(rebuildShot.data,'base64'));
 await wait(`${app}.snapshot().sweep.completed===1`);let d=await snap();assert.equal(d.error,null);assert.equal(d.sweep.hidden,0);assert.equal(d.sweep.void,false);assert.equal(await ev(app+'.test.sim.engine_player_clear()'),1);
 // Timeout must follow the same visible rebuild path without browser mouse
 // capture permission being granted by an item-click gesture.
 await ev(`${app}.configure({turnSeconds:.5});${app}.clearEncounter()`);await wait(`${app}.snapshot().sweep.phase==='turn'`);await wait(`${app}.snapshot().sweep.phase==='inbound'`);assert.equal(await ev('document.querySelector("#gate").hidden'),true);assert.equal(await ev(app+'.playing'),true);await wait(`${app}.snapshot().sweep.completed===2`);assert.equal((await snap()).error,null);assert.deepEqual(errors,[]);
 const report={passed:true,checks:['Collapse keeps drawing while actual sector groups are removed','The free void never lowers the player beneath the next landing floor','Five floating stock models and title-font labels remain readable on desktop and portrait; every leader has at most two orthogonal segments','Native armor selection starts an unobstructed live rebuild; geometry becomes visible progressively before combat','No-choice timeout also rebuilds without a mouse-capture or pause gate'],stable,layouts};await writeFile('.local/game/recomposition-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:report.checks},null,2));
});
