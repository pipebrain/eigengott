// Read-only application audit. Writes only test captures and this report.
// UI experiments run in a disposable Chrome profile; application files are hashed.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'evidence','reference-audit');await mkdir(out,{recursive:true});
const appFiles=['index.html','style.css','main.js','masks.js','scene.js','src/motion.c','motion.wasm','shaders/scene.wgsl'];
async function hashes(){return Object.fromEntries(await Promise.all(appFiles.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));}
const before=await hashes();
const referencePath=process.env.REFERENCE_IMAGE||'/Users/poo/Downloads/EIGENGOTT-Title-Concept.jpg';
const referenceData='data:image/jpeg;base64,'+(await readFile(referencePath)).toString('base64');
const profile=await mkdtemp(join(tmpdir(),'eigengott-reference-audit-'));
const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
  '--headless=new','--enable-unsafe-webgpu','--use-angle=metal','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',
],{stdio:['ignore','ignore','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
  const endpoint=await new Promise((resolve,reject)=>{
    let log='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),20000);
    chrome.on('error',reject);chrome.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
  });
  socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let seq=0;const pending=new Map();
  socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params)=>send(method,params,sessionId);
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  await cmd('Page.enable');await cmd('Runtime.enable');
  // Match the reference's 2752:1536 aspect ratio, at half resolution.
  await cmd('Emulation.setDeviceMetricsOverride',{width:1376,height:768,deviceScaleFactor:1,mobile:false});
  await cmd('Page.navigate',{url:'http://127.0.0.1:8080/?time=0&paused'});
  for(let i=0;i<160;i++){if(await evaluate('!!window.__EIGENGOTT?.ready'))break;await sleep(100);}
  assert.equal(await evaluate('window.__EIGENGOTT?.ready'),true);

  // Same native browser image decoder and resampling for JPEG and PNG.
  const measure=async dataURL=>evaluate(`(async()=>{
    const image=new Image();image.src=${JSON.stringify(dataURL)};await image.decode();
    const width=1376,height=768,c=new OffscreenCanvas(width,height),ctx=c.getContext('2d');
    ctx.drawImage(image,0,0,width,height);const rgba=ctx.getImageData(0,0,width,height).data;
    const gray=new Float32Array(width*height);let white=0,black=0,middle=0,mean=0;
    for(let i=0;i<gray.length;i++){const v=(rgba[i*4]+rgba[i*4+1]+rgba[i*4+2])/3;gray[i]=v;mean+=v;if(v>128)white++;if(v<32)black++;if(v>=32&&v<=223)middle++;}
    const edgeStats=excludeTitle=>{
      let total=0,axis5=0,axis10=0,count=0;
      for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
        if(excludeTitle&&x>width*.2&&x<width*.8&&y>height*.28&&y<height*.72)continue;
        const i=y*width+x;
        const gx=gray[i-width+1]+2*gray[i+1]+gray[i+width+1]-gray[i-width-1]-2*gray[i-1]-gray[i+width-1];
        const gy=gray[i+width-1]+2*gray[i+width]+gray[i+width+1]-gray[i-width-1]-2*gray[i-width]-gray[i-width+1];
        const magnitude=Math.hypot(gx,gy);if(magnitude<160)continue;
        const angle=Math.atan2(Math.abs(gy),Math.abs(gx))*180/Math.PI,offAxis=Math.min(angle,90-angle);
        total+=magnitude;count++;if(offAxis<=5)axis5+=magnitude;if(offAxis<=10)axis10+=magnitude;
      }
      return {strongEdgePixels:count,axisAlignedWithin5Degrees:axis5/total,axisAlignedWithin10Degrees:axis10/total};
    };
    return {sourceSize:[image.naturalWidth,image.naturalHeight],measurementSize:[width,height],whitePixelFraction:white/gray.length,blackPixelFraction:black/gray.length,middleGrayFraction:middle/gray.length,meanBrightness:mean/gray.length/255,edges:edgeStats(false),backgroundEdges:edgeStats(true)};
  })()`);
  const reference=await measure(referenceData),cases=[];
  const setControls=async controls=>evaluate(`(()=>{for(const [key,value] of Object.entries(${JSON.stringify(controls)})){const input=document.getElementById(key);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new Event('input'));}})()`);
  const configurations=[
    ['default',{}],
    ['axis-aligned',{drift:0,twist:0,shear:0,repulsion:0}],
    ['line-balance-low',{drift:0,twist:0,shear:0,repulsion:0,lineWidth:.15}],
    ['line-balance-high',{drift:0,twist:0,shear:0,repulsion:0,lineWidth:.85}],
    ['ink-balance-match',{drift:0,twist:0,shear:0,repulsion:0,lineWidth:.65}],
    ['thin-dense',{drift:0,twist:0,shear:0,repulsion:0,slices:320,envDensity:8,lineWidth:.15}],
    ['outline',{drift:0,twist:0,shear:0,repulsion:0,outline:true}],
    ['narrow-lens',{drift:0,twist:0,shear:0,repulsion:0,fov:35,cameraZ:10.4}],
  ];
  for(const [name,controls] of configurations){
    await evaluate('document.querySelector("#reset").click();document.querySelector("#pause").click();');
    await setControls(controls);await sleep(350);
    const state=await evaluate('window.__EIGENGOTT');assert.deepEqual(state.errors,[]);
    const {data}=await cmd('Page.captureScreenshot',{format:'png'});
    await writeFile(join(out,name+'.png'),Buffer.from(data,'base64'));
    cases.push({name,controls,state,metrics:await measure('data:image/png;base64,'+data)});
  }
  const after=await hashes();assert.deepEqual(after,before,'Application code and WASM must remain byte-identical');
  const report={applicationFilesUnchanged:true,applicationHashes:before,referencePath,reference,referenceTitleApproximate:{box:[640,525,2105,1018],fractionOfImage:[1465/2752,493/1536],method:'Manually estimated visible title envelope; not an OCR measurement.'},cases,limitations:['Image statistics describe visible differences, not perceptual equivalence.','The title-envelope estimate is approximate.','UI experiments are diagnostic examples, not an exhaustive parameter optimization.','A single reference image does not uniquely identify its original 3D construction or camera.']};
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  const pct=x=>(100*x).toFixed(1)+'%';
  const rows=[['Reference',reference],...cases.map(c=>[c.name,c.metrics])].map(([name,m])=>`<tr><td>${name}</td><td>${pct(m.whitePixelFraction)}</td><td>${pct(m.blackPixelFraction)}</td><td>${pct(m.backgroundEdges.axisAlignedWithin5Degrees)}</td></tr>`).join('');
  const cards=[`<figure><img src="${referenceData}"><figcaption>Reference</figcaption></figure>`,...cases.map(c=>`<figure><img src="${c.name}.png"><figcaption>${c.name}: ${JSON.stringify(c.controls)}</figcaption></figure>`)].join('');
  await writeFile(join(out,'report.html'),`<!doctype html><meta charset="utf-8"><title>EIGENGOTT reference audit</title><style>body{background:#181818;color:#eee;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{width:100%;display:block}figcaption{font:13px monospace;line-height:1.6;margin-top:10px}table{border-collapse:collapse;margin:24px 0}td,th{text-align:left;padding:10px 20px;border:1px solid #555}p{max-width:950px;line-height:1.6}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>Reference comparison — application unchanged</h1><p>All captures use the reference's aspect ratio. Variations change only existing UI controls in a disposable Chrome profile. Production file hashes were verified unchanged. Edge measurements use Sobel gradients, weighted by magnitude; the central title area is excluded for the background orientation statistic. The ±5° statistic is sensitive to rasterization and is descriptive, not a visual acceptance score.</p><table><tr><th>Case</th><th>White pixels</th><th>Black pixels</th><th>Background edges near horizontal/vertical</th></tr>${rows}</table><main>${cards}</main>`);
  console.log(JSON.stringify({applicationFilesUnchanged:true,reference,cases:cases.map(c=>({name:c.name,metrics:c.metrics})),report:join(out,'report.html')},null,2));
}finally{
  socket?.close();chrome.kill('SIGTERM');await sleep(500);await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:300});
}
