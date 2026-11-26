import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBrowser,sleep} from './browser.mjs';
import {pixels} from './pixels.mjs';
const root=new URL('../',import.meta.url),cases=[];
await withBrowser(async({origin,cmd,evaluate,wait,errors})=>{
  for(const [width,height,dpr,state,time] of [[1376,768,1,0,0],[1376,768,1,.5,7.5],[1376,768,1,1,15],[390,844,1,.6,9],[1376,768,1.5,.5,7.5],[1920,1080,2,.7,10.5]]){
    await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
    const captures=[];
    for(const app of ['vector-labyrinth','dos-maze']){
      await cmd('Page.navigate',{url:`${origin}/${app}/?paused&state=${state}&time=${time}&flicker=off`});
      await wait(app==='dos-maze'?'window.__DOS_MAZE?.ready':'window.__VECTOR_STUDY?.ready');await sleep(150);
      if(app==='vector-labyrinth')assert.equal(await evaluate('window.__VECTOR_STUDY.settings.titleGuide'),false);
      const {data}=await cmd('Page.captureScreenshot',{format:'png'}),png=Buffer.from(data,'base64');captures.push(pixels(png));
      if(width===1376&&dpr===1)await writeFile(new URL(`evidence/${app}-${state}.png`,root),png);
    }
    const [a,b]=captures;assert.equal(a.width,b.width);assert.equal(a.height,b.height);
    let sum=0,large=0,changed=0,max=0;
    for(let i=0;i<a.data.length;i++){const delta=Math.abs(a.data[i]-b.data[i]);sum+=delta;if(delta)changed++;if(delta>8)large++;max=Math.max(max,delta);}
    const result={width,height,dpr,state,time,meanAbsoluteError:sum/a.data.length,changedChannelFraction:changed/a.data.length,largeErrorFraction:large/a.data.length,maxChannelError:max};cases.push(result);console.log(result);
    assert.ok(result.meanAbsoluteError<.001,'Mean image difference exceeds the subpixel tolerance');
    assert.ok(result.largeErrorFraction<.00001,'Too many pixels differ by more than 8/255');
  }
  assert.deepEqual(errors,[]);
});
await writeFile(new URL('evidence/visual-verification.json',root),JSON.stringify({passed:true,comparison:'v1.0.0 dos-maze vs stripped runtime, default render quality',cases},null,2)+'\n');
