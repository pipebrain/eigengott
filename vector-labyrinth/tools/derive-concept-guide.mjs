// Build a small direction-field guide, not an image texture or traced backdrop.
// Unknown/black areas are filled so the composition remains continuous linework.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const source=process.env.REFERENCE_IMAGE||'/Users/poo/Downloads/EINGENGOTT-gothic.jpeg';
const data='data:image/jpeg;base64,'+(await readFile(source)).toString('base64');
const profile=await mkdtemp(join(tmpdir(),'eigengott-guide-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let socket;
try{
  const url=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Chrome timeout')),15000);chrome.stderr.on('data',c=>{log+=c;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let id=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
    const img=new Image();img.src=${JSON.stringify(data)};await img.decode();
    const w=1376,h=768,c=new OffscreenCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);
    const rgba=ctx.getImageData(0,0,w,h).data,gray=new Float32Array(w*h);
    for(let i=0;i<gray.length;i++)gray[i]=rgba[i*4];
    const gw=344,gh=192,field=new Int16Array(gw*gh).fill(-1),confidence=new Float32Array(gw*gh),queue=[];
    for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
      let ex=0,ey=0;const cx=x*4+2,cy=y*4+2;
      for(let yy=Math.max(1,cy-4);yy<=Math.min(h-2,cy+4);yy++)for(let xx=Math.max(1,cx-4);xx<=Math.min(w-2,cx+4);xx++){
        const at=yy*w+xx;
        ex+=Math.abs(gray[at+1]-gray[at-1]);ey+=Math.abs(gray[at+w]-gray[at-w]);
      }
      const i=y*gw+x;confidence[i]=ex+ey;
      if(ex+ey>220){field[i]=ex>=ey?0:1;queue.push(i);}
    }
    // Nearest known orientation fills the source's negative-space pockets.
    for(let head=0;head<queue.length;head++){
      const i=queue[head],x=i%gw,y=Math.floor(i/gw);
      for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy,j=ny*gw+nx;if(nx>=0&&ny>=0&&nx<gw&&ny<gh&&field[j]<0){field[j]=field[i];queue.push(j);}}
    }
    // The title has its own editable mask. Remove baked-in lettering from
    // the guide and provide a horizontal field through its design envelope.
    for(let y=Math.floor(252/4);y<Math.ceil(518/4);y++)for(let x=Math.floor(309/4);x<Math.ceil(1084/4);x++)field[y*gw+x]=1;
    let previous=field;
    for(let pass=0;pass<2;pass++){
      const next=previous.slice();
      for(let y=1;y<gh-1;y++)for(let x=1;x<gw-1;x++){
        let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=previous[(y+dy)*gw+x+dx];
        if(sum>=7)next[y*gw+x]=1;else if(sum<=2)next[y*gw+x]=0;
      }previous=next;
    }
    const runs=[];let value=previous[0],count=0;for(const v of previous){if(v===value)count++;else{runs.push(count,value);value=v;count=1;}}runs.push(count,value);
    return {width:gw,height:gh,designWidth:w,designHeight:h,runs};
  })()`},sessionId);
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
  const guide={format:'eigengott-wall-direction-guide',version:1,source:'Gothic concept composition; direction-only, negative space filled, lettering removed',...result.result.value};
  await writeFile(new URL('../concept-guide.json',import.meta.url),JSON.stringify(guide)+'\n');console.log(JSON.stringify({width:guide.width,height:guide.height,runs:guide.runs.length/2}));
}finally{socket?.close();chrome.kill('SIGTERM');await new Promise(r=>setTimeout(r,300));await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});}
