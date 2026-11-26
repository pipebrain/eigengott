// Compare local stroke direction against the reference, excluding the title.
// This measures composition alignment, not pixel-perfect artistic equivalence.
import {spawn} from 'node:child_process';import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),reference='data:image/jpeg;base64,'+(await readFile('/Users/poo/Downloads/EINGENGOTT-gothic.jpeg')).toString('base64');
const images=[reference,...await Promise.all(['original-study-stable','stable'].map(async name=>'data:image/png;base64,'+(await readFile(new URL(`evidence/${name}.png`,root))).toString('base64')))];
const profile=await mkdtemp(join(tmpdir(),'eigengott-compose-')),chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let socket;
try{
  const url=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Chrome timeout')),15000);chrome.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});let id=0;const pending=new Map();socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
    const width=1376,height=768,all=[];
    for(const url of ${JSON.stringify(images)}){
      const img=new Image();img.src=url;await img.decode();const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,width,height);
      const rgba=ctx.getImageData(0,0,width,height).data,luma=new Float32Array(width*height);for(let i=0;i<luma.length;i++)luma[i]=rgba[i*4];
      const cells=[];
      for(let y=8;y<height-8;y+=8)for(let x=8;x<width-8;x+=8){
        let ex=0,ey=0;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const p=(y+dy)*width+x+dx;ex+=Math.abs(luma[p+1]-luma[p-1]);ey+=Math.abs(luma[p+width]-luma[p-width]);}
        cells.push({x,y,ex,ey});
      }all.push(cells);
    }
    let count=0,oldMatch=0,newMatch=0;
    all[0].forEach((r,i)=>{if(r.x>300&&r.x<1090&&r.y>245&&r.y<525)return;if(r.ex+r.ey<1000||Math.max(r.ex,r.ey)<Math.min(r.ex,r.ey)*1.6)return;count++;const expected=r.ex>r.ey;if((all[1][i].ex>all[1][i].ey)===expected)oldMatch++;if((all[2][i].ex>all[2][i].ey)===expected)newMatch++;});
    return {samples:count,originalDirectionAgreement:oldMatch/count,conceptDirectionAgreement:newMatch/count};
  })()`},sessionId);
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));const report={...result.result.value,method:'Dominant horizontal/vertical stroke direction in 9px neighborhoods, at 8px sample intervals; title region and ambiguous/empty reference samples excluded.'};
  assert.ok(report.conceptDirectionAgreement>report.originalDirectionAgreement+.1,'Concept composition should align better than the old defaults');
  await writeFile(new URL('evidence/composition-verification.json',root),JSON.stringify(report,null,2)+'\n');
  await writeFile(new URL('evidence/concept-comparison.html',root),`<!doctype html><meta charset="utf-8"><title>EIGENGOTT concept comparison</title><style>body{margin:28px;background:#181818;color:#eee;font:16px system-ui}figure{max-width:1376px;margin:28px 0}img{width:100%;display:block}figcaption{margin-top:10px}p{max-width:1000px;line-height:1.6}</style><h1>Concept composition comparison</h1><p>The new default uses a direction-field guide interpreted as vector walls. The reference's large black pockets are filled, preserving the later continuous-field direction. This is an approximation, not a traced image backdrop. Local background direction agreement: original ${(100*report.originalDirectionAgreement).toFixed(1)}%, concept ${(100*report.conceptDirectionAgreement).toFixed(1)}%.</p><figure><img src="${reference}"><figcaption>Gothic concept reference</figcaption></figure><figure><img src="original-study-stable.png"><figcaption>Original study defaults · preserved exactly</figcaption></figure><figure><img src="stable.png"><figcaption>New concept-art default · stable pose</figcaption></figure>`);
  console.log(JSON.stringify(report,null,2));
}finally{socket?.close();chrome.kill('SIGTERM');await new Promise(r=>setTimeout(r,300));await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});}
