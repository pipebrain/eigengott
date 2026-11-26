import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),out=join(root,'evidence');await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'eigengott-vector-check-')),download=join(profile,'downloads');await mkdir(download);
const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless=new','--enable-unsafe-webgpu','--use-angle=metal','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',
],{stdio:['ignore','ignore','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
function pixels(png){
  const parts=[];let width,height,type;
  for(let p=8;p<png.length;){const n=png.readUInt32BE(p),kind=png.toString('ascii',p+4,p+8),data=png.subarray(p+8,p+8+n);if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);type=data[9];assert.equal(data[8],8);}if(kind==='IDAT')parts.push(data);p+=n+12;}
  assert.ok(type===2||type===6);const bpp=type===6?4:3,stride=width*bpp,raw=inflateSync(Buffer.concat(parts));
  const result=new Uint8Array(width*height*3);let previous=new Uint8Array(stride),cursor=0;
  const paeth=(a,b,c)=>{const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[cursor++],row=new Uint8Array(stride);for(let x=0;x<stride;x++){const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0;row[x]=(raw[cursor++]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}for(let x=0;x<width;x++)result.set(row.subarray(x*bpp,x*bpp+3),(y*width+x)*3);previous=row;}
  return {width,height,data:result};
}
try{
  const url=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),20000);chrome.on('error',reject);chrome.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0;const pending=new Map(),runtimeErrors=[];
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params)=>send(method,params,sessionId);
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;const error=await evaluate('!document.querySelector("#status")?.hidden?document.querySelector("#status")?.innerText:null');if(error&&!error.includes('Drawing the labyrinth'))throw new Error(error);await sleep(100);}throw new Error('Timed out: '+expression+' '+JSON.stringify(runtimeErrors)+' '+JSON.stringify(await evaluate('window.__VECTOR_STUDY')));};
  const set=async(key,value)=>{await evaluate(`(()=>{const input=document.getElementById(${JSON.stringify(key)});if(input.type==='checkbox')input.checked=${JSON.stringify(value)};else input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input'));})()`);await sleep(100);};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const paused=async value=>{if(await evaluate('window.__VECTOR_STUDY.paused')!==value)await click('#pause');};
  const reload=async()=>{await cmd('Page.reload');await sleep(200);await waitFor('window.__VECTOR_STUDY?.ready');};
  const upload=async(selector,path)=>{const {root:dom}=await cmd('DOM.getDocument',{depth:0}),{nodeId}=await cmd('DOM.querySelector',{nodeId:dom.nodeId,selector});await cmd('DOM.setFileInputFiles',{nodeId,files:[path]});};
  const key=async k=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k==='h'?'KeyH':k===' '?'Space':'KeyR'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k==='h'?'KeyH':k===' '?'Space':'KeyR'});};
  const screenshot=async name=>{const {data}=await cmd('Page.captureScreenshot',{format:'png'});const png=Buffer.from(data,'base64');if(name)await writeFile(join(out,name+'.png'),png);return png;};
  await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:'http://127.0.0.1:8080/vector-labyrinth/?paused&state=0&flicker=off'});
  await waitFor('window.__VECTOR_STUDY?.ready');await sleep(200);
  const reports=[];
  function measure(image,settings,ratio,excludeTitle){
    const pitch=settings.wallWidth+settings.pathGap,wall=settings.wallWidth,gap=settings.pathGap,ox=settings.gridOriginX,oy=settings.gridOriginY,w=image.width,h=image.height;
    const values=[];let runs=0,maxCenterError=0,maxWidthError=0,maxGapError=0;
    const title=excludeTitle?[w*.20,h*.30,w*.82,h*.70]:null;
    function inspect(vertical,coordinate){
      const length=vertical?w:h,step=vertical?ratio[0]:ratio[1],origin=vertical?ox:oy,line=[];
      for(let i=0;i<length;i++){
        const x=vertical?i:coordinate,y=vertical?coordinate:i;
        const excluded=title&&x>=title[0]&&x<=title[2]&&y>=title[1]&&y<=title[3];
        line.push(excluded?-1:image.data[(y*w+x)*3]/255);
      }
      let previous=null;
      for(let i=0;i<length;){
        if(line[i]<=.001){if(line[i]<0)previous=null;i++;continue;}
        const start=i;while(i<length&&line[i]>.001)i++;const end=i-1;
        if(start<2||end>=length-2||end===start||line[start-1]<0||line[i]<0){previous=null;continue;}
        const left=(start+1-line[start])/step,right=(end+line[end])/step,width=right-left,center=(left+right)/2;
        // Rows through cell interiors avoid T-junction cap pixels. Reject only
        // glyph-mask borders and runs whose perpendicular sample crosses a wall.
        const centerError=Math.abs((center-origin)-Math.round((center-origin)/pitch)*pitch);
        assert.ok(width<=wall+.03,`Unexpected thick wall: ${width} versus ${wall}`);
        assert.ok(centerError<.012,`Rendered line left the grid: ${centerError}`);assert.ok(Math.abs(width-wall)<.012,`Rendered wall width changed: ${width} versus ${wall}`);
        maxCenterError=Math.max(maxCenterError,centerError);maxWidthError=Math.max(maxWidthError,Math.abs(width-wall));runs++;
        if(previous&&Math.abs(center-previous.center-pitch)<.025){const actualGap=left-previous.right;maxGapError=Math.max(maxGapError,Math.abs(actualGap-gap));assert.ok(Math.abs(actualGap-gap)<.012,`Rendered gap changed: ${actualGap} versus ${gap}`);values.push(actualGap);}
        previous={center,right};
      }
    }
    for(let row=2;row<Math.floor(h/ratio[1]/pitch)-2;row+=2)inspect(true,Math.floor((oy+(row+.5)*pitch)*ratio[1]));
    for(let col=2;col<Math.floor(w/ratio[0]/pitch)-2;col+=2)inspect(false,Math.floor((ox+(col+.5)*pitch)*ratio[0]));
    assert.ok(values.length>100,'Enough parallel-wall gaps measured');
    return {parallelGapsChecked:values.length,wallRunsChecked:runs,minGap:Math.min(...values),maxGap:Math.max(...values),maxGapError,maxWidthError,maxCenterError};
  }
  for(const config of [{width:1376,height:768,dpr:1,wallWidth:2.8,pathGap:3.2,gridOriginX:0,gridOriginY:0},{width:960,height:720,dpr:2,wallWidth:2.8,pathGap:3.2,gridOriginX:0,gridOriginY:0},{width:1023,height:767,dpr:1.5,wallWidth:2.8,pathGap:3.2,gridOriginX:1.5,gridOriginY:-.5},{width:1000,height:740,dpr:1.25,wallWidth:3.3,pathGap:4.1,gridOriginX:2.2,gridOriginY:-1.3}]){
    await cmd('Emulation.setDeviceMetricsOverride',{width:config.width,height:config.height,deviceScaleFactor:config.dpr,mobile:false});
    for(const key of ['wallWidth','pathGap','gridOriginX','gridOriginY'])await set(key,config[key]);await set('dprCap',config.dpr);await set('textVisible',false);
    for(const state of [0,1]){
      await set('manualState',state);await sleep(100);const snap=await evaluate('window.__VECTOR_STUDY'),image=pixels(await screenshot(`grid-spacing-${config.dpr}-${state}`)),ratio=[config.dpr,config.dpr];
      reports.push({...config,state,actualOrigin:[snap.settings.gridOriginX,snap.settings.gridOriginY],...measure(image,snap.settings,ratio,false)});
    }
  }
  await set('wallWidth',2.8);await set('pathGap',3.2);await set('gridOriginX',0);await set('gridOriginY',0);await set('textVisible',true);await set('manualState',1);
  await set('collisionHold',.2);await paused(false);await sleep(450);await paused(true);const snapshot=await evaluate('window.__VECTOR_STUDY'),image=pixels(await screenshot('grid-collision-spacing'));
  reports.push({state:'after collisions',...measure(image,snapshot.settings,[image.width/1000,image.height/740],true)});
  assert.ok(snapshot.collisionDecisionCount>0);assert.deepEqual(snapshot.errors,[]);assert.deepEqual(runtimeErrors,[]);
  // Measure the production title renderer too, including rotated hatch grids.
  await set('mazeVisible',false);await set('title','H');await set('font','sans');await set('titleScale',2);await set('titleX',50);await set('titleY',50);await set('allowDiagonal',true);
  await waitFor('window.__VECTOR_STUDY.font==="sans"&&window.__VECTOR_STUDY.characterCount===1');
  const titleReports=[];
  for(const flow of [0,1,2,3]){
    await set('titleHatch',String(flow));const snap=await evaluate('window.__VECTOR_STUDY'),pic=pixels(await screenshot('grid-title-'+flow));
    const mask=await evaluate('(async()=>{const {buildGlyphCache}=await import("./glyphs.js");return Array.from(buildGlyphCache("H","sans").layers[0]);})()');
    const g=snap.glyphTransforms,pitch=snap.wallWidth+snap.pathGap,dpr=1.25,angle=[Math.PI/2,0,Math.PI/4,-Math.PI/4][flow],normal=[-Math.sin(angle),Math.cos(angle)],alongX=flow!==1,factor=Math.abs(alongX?normal[0]:normal[1]);let checked=0,maxWidthError=0,maxCenterError=0;
    function inside(x,y){const px=x-g[0],py=y-g[1],u=(px*g[4]+py*g[5])/g[2]+.5,v=(-px*g[5]+py*g[4])/g[3]+.5;if(u<0||u>=1||v<0||v>=1)return false;const at=(Math.floor(v*512)*512+Math.floor(u*512))*2,raw=(mask[at]*256+mask[at+1])/65535*512-256;return raw*Math.min(g[2],g[3])/512<-(snap.wallWidth+2);}
    for(let fixed=10;fixed<(alongX?pic.height:pic.width)-10;fixed+=11){
      const length=alongX?pic.width:pic.height;
      for(let at=0;at<length;){const value=i=>pic.data[((alongX?fixed:i)*pic.width+(alongX?i:fixed))*3]/255;if(value(at)<=.001){at++;continue;}const begin=at;let sum=0,moment=0;while(at<length&&value(at)>.001){sum+=value(at);moment+=(at+.5)*value(at);at++;}if(at-begin<2||sum<.1)continue;
        const center=moment/sum/dpr,x=alongX?center:(fixed+.5)/dpr,y=alongX?(fixed+.5)/dpr:center;if(!inside(x,y))continue;
        const width=sum/dpr*factor,error=Math.abs(width-snap.wallWidth),distance=normal[0]*x+normal[1]*y,phase=normal[0]*snap.phase[0]+normal[1]*snap.phase[1],centerError=Math.abs(distance-phase-Math.round((distance-phase)/pitch)*pitch);
        assert.ok(error<.025,`Title ${flow} width changed: ${width}`);assert.ok(centerError<.055,`Title ${flow} left its grid: ${centerError}`);checked++;maxWidthError=Math.max(maxWidthError,error);maxCenterError=Math.max(maxCenterError,centerError);
      }
    }
    assert.ok(checked>100,'Enough fully masked title strokes measured');titleReports.push({flow,strokesChecked:checked,maxWidthError,maxCenterError});
  }
  const report={passed:true,toleranceCSSPixels:.012,totalParallelGaps:reports.reduce((n,r)=>n+r.parallelGapsChecked,0),maxGapError:Math.max(...reports.map(r=>r.maxGapError)),titleReports,reports};await writeFile(join(out,'grid-pixel-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{socket?.close();chrome.kill('SIGTERM');await sleep(500);await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:300});}
