// Offline authoring utility. Converts the supplied image into editable line
// centerlines and glyph-mask rectangles; no image is used by the live renderer.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const source=process.env.REFERENCE_IMAGE||'/Users/poo/Downloads/EINGENGOTT-gothic.jpeg';
const image='data:image/jpeg;base64,'+(await readFile(source)).toString('base64');
const profile=await mkdtemp(join(tmpdir(),'eigengott-trace-'));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let socket;
function trace(image){return (async()=>{
  const img=new Image();img.src=image;await img.decode();
  const w=1376,h=768,c=new OffscreenCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);
  const rgba=ctx.getImageData(0,0,w,h).data,white=new Uint8Array(w*h);
  for(let i=0;i<white.length;i++)white[i]=rgba[i*4]>127?1:0;
  const boxes=[[319,263,394,507],[409,263,436,507],[453,263,536,507],[548,263,627,507],[637,263,735,507],[744,263,823,507],[833,263,915,507],[924,263,1003,507],[1003,263,1076,507]];
  const glyphs=boxes.map((box,i)=>({char:'EIGENGOTT'[i],box,strokes:[],rects:[]}));
  // RLE each scanline, then merge neighboring scans with matching endpoints.
  function extract(vertical){
    const groups=[],previous=new Map(),a=vertical?w:h,b=vertical?h:w;
    for(let scan=0;scan<a;scan++){
      const current=new Map();
      for(let at=0;at<b;){
        if(!white[vertical?at*w+scan:scan*w+at]){at++;continue;}
        const start=at;while(at<b&&white[vertical?at*w+scan:scan*w+at])at++;
        if(at-start<8)continue;
        let match;
        for(let da=-1;da<=1&&!match;da++)for(let db=-1;db<=1&&!match;db++){
          const key=(start+da)+':'+(at+db),old=previous.get(key);
          if(old&&old.endScan===scan-1&&scan-old.scan<5)match=old;
        }
        if(match){match.endScan=scan;match.start=Math.min(match.start,start);match.end=Math.max(match.end,at);}
        else{match={scan,endScan:scan,start,end:at};groups.push(match);}
        current.set(start+':'+at,match);
      }
      previous.clear();for(const [k,v]of current)previous.set(k,v);
    }
    return groups.map(g=>{
      const center=(g.scan+g.endScan+1)/2;
      // Square-cap stroke endpoints use the same 2.1px width as the renderer.
      return vertical?[center,g.start+1.05,center,g.end-1.05]:[g.start+1.05,center,g.end-1.05,center];
    });
  }
  const segments=[];
  for(const line of extract(true)){
    const [x,y1,,y2]=line;
    const glyph=glyphs.find(g=>x>=g.box[0]&&x<g.box[2]&&y2>g.box[1]&&y1<g.box[3]);
    if(glyph){
      const [left,top,,bottom]=glyph.box;
      glyph.strokes.push([x-left,Math.max(y1,top+.5)-top,x-left,Math.min(y2,bottom-.5)-top]);
      if(y1<top)segments.push(x,y1,x,top-1.05);
      if(y2>bottom)segments.push(x,bottom+1.05,x,y2);
    }else segments.push(...line);
  }
  for(const line of extract(false))segments.push(...line);
  // Close only the narrow stripe gaps in each glyph; retain its large counters.
  for(const g of glyphs){
    const [left,top,right,bottom]=g.box,gw=right-left,gh=bottom-top;
    const filled=new Uint8Array(gw*gh);
    for(let y=0;y<gh;y++){
      const intervals=[];
      for(const [x,y1,,y2]of g.strokes)if(y>=y1-1.05&&y<=y2+1.05)intervals.push([Math.max(0,Math.floor(x-1.05)),Math.min(gw,Math.ceil(x+1.05))]);
      intervals.sort((a,b)=>a[0]-b[0]);let start=-1,end=0;
      for(const [a,b]of intervals){if(start<0){start=a;end=b;}else if(a-end<=5){end=Math.max(end,b);}else{filled.fill(1,y*gw+start,y*gw+end);start=a;end=b;}}
      if(start>=0)filled.fill(1,y*gw+start,y*gw+end);
    }
    const live=new Map();
    for(let y=0;y<gh;y++){
      const next=new Map();
      for(let x=0;x<gw;){if(!filled[y*gw+x]){x++;continue;}const start=x;while(x<gw&&filled[y*gw+x])x++;const key=start+':'+x,old=live.get(key);if(old){old[3]++;next.set(key,old);}else{const rect=[start,y,x-start,1];g.rects.push(rect);next.set(key,rect);}}
      live.clear();for(const [k,v]of next)live.set(k,v);
    }
  }
  const voids=[];for(let y=0;y<192;y++)for(let x=0;x<344;x++){
    let nearby=false;for(let dy=-7;dy<=7&&!nearby;dy++)for(let dx=-7;dx<=7;dx++){
      const xx=x*4+2+dx,yy=y*4+2+dy;if(xx>=0&&yy>=0&&xx<w&&yy<h&&white[yy*w+xx]){nearby=true;break;}
    }voids.push(nearby?0:1);
  }
  const voidRuns=[];let old=voids[0],count=0;for(const v of voids){if(v===old)count++;else{voidRuns.push(count,old);count=1;old=v;}}voidRuns.push(count,old);
  return {format:'eigengott-vector-master',version:1,width:w,height:h,segments,glyphs,voidRuns};
})();}
try{
  const url=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(new Error('Chrome timeout')),15000);chrome.stderr.on('data',c=>{log+=c;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
  socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let id=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(${trace.toString()})(${JSON.stringify(image)})`},sessionId);
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
  const master=result.result.value;
  await writeFile(new URL('../reference-master.json',import.meta.url),JSON.stringify(master)+'\n');
  console.log(JSON.stringify({backgroundStrokes:master.segments.length/4,glyphs:master.glyphs.length,glyphStrokes:master.glyphs.reduce((n,g)=>n+g.strokes.length,0)}));
}finally{socket?.close();chrome.kill('SIGTERM');await new Promise(r=>setTimeout(r,300));await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});}
