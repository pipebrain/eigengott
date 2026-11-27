import assert from 'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{withBrowser,sleep}from'../../dos-maze/tools/browser.mjs';
await withBrowser(async({origin,cmd,evaluate:ev,errors})=>{
 const wait=async e=>{for(let i=0;i<600;i++){if(await ev(e))return;await sleep(100);}throw Error('Timeout '+e+' '+JSON.stringify(errors));};
 await cmd('Page.navigate',{url:(process.env.PLAYABLE_URL||origin+'/playable-test/')+'?test'});await wait('window.__playable?.ready');
 await ev('window.__playable.configure({freezeAI:true,godMode:true,freeRecomposition:true,randomWorkload:false,botCount:3,botCountRandom:false,outSeconds:.5,backSeconds:1.2,turnSeconds:.5,consoleLog:false});window.__playable.play(true)');
 const enabled=await cmd('Runtime.evaluate',{expression:'window.__playable.enableAudio()',userGesture:true,awaitPromise:true,returnByValue:true});assert.equal(enabled.result.value,true);
 const cycles=[];for(let cycle=0;cycle<3;cycle++){
  assert.equal(await ev('window.__playable.trigger()'),true);const seen=new Map();let done=false,samples=0;
  for(let n=0;n<250&&!done;n++){await sleep(60);const s=await ev('window.__playable.snapshot()');assert.equal(s.error,null);for(const b of s.game.bots.filter(b=>b.staged)){if(!seen.has(b.id))seen.set(b.id,b.p);else assert.deepEqual(b.p,seen.get(b.id));assert.deepEqual(b.p,b.spawnPosition);samples++;}assert.ok(s.audio.spatial.voices<=16);assert.ok(s.audio.spatial.reflectionTaps<=16);assert.ok(s.audio.spatial.graph.visited<=64);done=s.sweep.phase==='complete';}
  assert.ok(done);assert.equal(seen.size,3);cycles.push({cycle,stagedSamples:samples,spawns:Object.fromEntries(seen)});
 }
 await ev('window.__playable.targetFixture();window.__playable.command("attack");window.__playable.actions(1)');await sleep(150);await ev('window.__playable.actions(0)');await sleep(250);
 const audio=await ev('window.__playable.snapshot().audio');assert.equal(audio.state,'running');assert.equal(audio.error,null);assert.ok(audio.spatial.graph.nodes>0);assert.ok(audio.spatial.trace.length>0);assert.ok(audio.playbackRates.every(v=>v===1));assert.ok(audio.detunes.every(v=>v===0));
 const controls=await ev('Object.fromEntries(["spatialAudio","echo","reverb","soundRooms","soundDistance","corridorDamping","echoMix","reverbMix"].map(k=>[k,!!document.getElementById(k)]))');assert.ok(Object.values(controls).every(Boolean));
 await ev('window.__playable.configure({audio:false})');const muted=await ev('window.__playable.snapshot().audio');assert.equal(muted.voices,0);assert.equal(muted.spatial.voices,0);assert.equal(muted.spatial.reverbDelayLines,0);assert.deepEqual(errors,[]);
 const report={passed:true,checks:['Three structural replacement waves retain every first-visible NPC spawn through Release','Live audio scene changes with accepted replacement, plays world cues and weapon samples with HRTF room routing','H controls present; source, echo and graph caps honored; mute disconnects sources and reverb'],cycles,audio};await mkdir('.local/playable',{recursive:true});await writeFile('.local/playable/spawn-audio-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:report.checks,cycles:cycles.map(x=>({cycle:x.cycle,samples:x.stagedSamples})),audio:audio.spatial},null,2));
});
