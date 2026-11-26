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
  const selectPreset=async value=>{await evaluate(`document.querySelector('#browser-preset').value=${JSON.stringify(value)}`);await click('#browser-load');await sleep(200);await paused(true);await set('mazeFlicker',false);await set('textFlicker',false);await click('#home');};
  await selectPreset('builtin:reference');
  await waitFor('window.__VECTOR_STUDY.font==="reference"');
  assert.equal(await evaluate('window.__VECTOR_STUDY.settings.constantGap'),false);
  async function compare(referencePNG){
  const source='data:image/jpeg;base64,'+(await readFile('/Users/poo/Downloads/EINGENGOTT-gothic.jpeg')).toString('base64');
  const actual='data:image/png;base64,'+referencePNG.toString('base64');
  return await evaluate(`(async()=>{
    const images=await Promise.all([${JSON.stringify(source)},${JSON.stringify(actual)}].map(async src=>{const i=new Image();i.src=src;await i.decode();const c=new OffscreenCanvas(1376,768),ctx=c.getContext('2d');ctx.drawImage(i,0,0);return ctx.getImageData(0,0,1376,768).data;}));
    const w=1376,h=768,flags=images.map(d=>Uint8Array.from({length:w*h},(_,i)=>d[i*4]>128?1:0));
    let agreement=0;for(let i=0;i<w*h;i++)if(flags[0][i]===flags[1][i])agreement++;
    function coverage(a,b){let count=0,matched=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(a[y*w+x]){count++;let found=false;for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1)&&!found;yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++)if(b[yy*w+xx]){found=true;break;}if(found)matched++;}return matched/count;}
    return {binaryPixelAgreement:agreement/(w*h),whitePrecisionWithin1px:coverage(flags[1],flags[0]),whiteRecallWithin1px:coverage(flags[0],flags[1])};
  })()`);
  }
  const scores=[];for(const width of [2.1,2.5,2.8,3.1,3.4,3.7]){await set('wallWidth',width);const png=await screenshot();scores.push({width,...await compare(png)});}console.log(JSON.stringify(scores,null,2));
}finally{socket?.close();chrome.kill('SIGTERM');await sleep(500);await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:300});}
