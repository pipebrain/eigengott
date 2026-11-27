import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBrowser} from '../../dos-maze/tools/browser.mjs';
await withBrowser(async({origin,cmd,evaluate,errors})=>{
 await cmd('Page.navigate',{url:origin+'/playable-test/'});
 const result=await evaluate(`(async()=>{
 const {SpatialAudio}=await import('/playable-test/spatial-audio.js');
 const scene={version:1,nodes:[{id:0,kind:'room',min:[-32,-32,0],max:[32,32,6],center:[0,0,1.6],polygons:[[[[-32,-32],[32,-32],[32,32],[-32,32]]]]}],edges:[]};
 const camera={eye:[0,0,1.6],forward:[0,1,0],up:[0,0,1]};
 async function render(p,echo=false,reverb=false){const ctx=new OfflineAudioContext(2,48000,48000),spatial=new SpatialAudio(ctx,ctx.destination,{echo,reverb,echoMix:.7,reverbMix:.4}),b=ctx.createBuffer(1,240,48000);for(let i=0;i<240;i++)b.getChannelData(0)[i]=.5*Math.sin(i*1.713);spatial.scene(scene);spatial.update(camera,true);const v=spatial.play(b,p),snapshot=spatial.snapshot(),rate=v.source.playbackRate.value,detune=v.source.detune.value;await new Promise(r=>setTimeout(r,250));const audio=await ctx.startRendering(),energy=(start,end)=>[0,1].map(c=>{const data=audio.getChannelData(c);let sum=0;for(let i=start;i<end;i++)sum+=data[i]*data[i];return sum;});const out={snapshot,rate,detune,early:energy(0,2000),late:energy(2000,48000)};spatial.stop();out.stopped=spatial.snapshot();return out;}
 const left=await render([-4,0,1.6]),right=await render([4,0,1.6]),near=await render([0,4,1.6]),far=await render([0,24,1.6]),echo=await render([0,4,1.6],true,false),wet=await render([0,4,1.6],false,true);
 const ctx=new OfflineAudioContext(2,48000,48000),s=new SpatialAudio(ctx,ctx.destination),b=ctx.createBuffer(1,48000,48000);s.scene(scene);s.update(camera,true);for(let i=0;i<30;i++)s.play(b,[0,2,1.6]);const capped=s.snapshot();s.stop();return{left,right,near,far,echo,wet,capped,stopped:s.snapshot()};})()`);
 const sum=a=>a.reduce((s,v)=>s+v,0);
 assert.ok(result.left.early[0]>result.left.early[1]*1.3);assert.ok(result.right.early[1]>result.right.early[0]*1.3);
 assert.ok(sum(result.near.early)>sum(result.far.early)*4);assert.ok(sum(result.echo.late)>sum(result.near.late)+1e-7);assert.ok(sum(result.wet.late)>sum(result.near.late)+1e-7);
 assert.equal(result.capped.voices,16);assert.equal(result.capped.echoVoices,4);assert.equal(result.capped.reflectionTaps,16);assert.equal(result.capped.reverbDelayLines,4);assert.equal(result.capped.dropped,14);assert.equal(result.stopped.voices,0);assert.equal(result.stopped.reverbDelayLines,0);
 for(const name of ['left','right','near','far','echo','wet']){assert.equal(result[name].rate,1);assert.equal(result[name].detune,0);assert.equal(result[name].stopped.voices,0);}assert.deepEqual(errors,[]);
 const report={passed:true,checks:['Rendered stereo HRTF energy follows source side','Far source is quieter than near source','Four-wall echoes and shared reverb generate measured late energy','16 sources, four echo voices/16 taps and four reverb delays remain bounded; stop disconnects all','Original playback rate and detune retained'],result};await mkdir('.local/playable',{recursive:true});await writeFile('.local/playable/acoustics-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:report.checks,energy:Object.fromEntries(['left','right','near','far','echo','wet'].map(k=>[k,{early:result[k].early,late:result[k].late}]))},null,2));
});
