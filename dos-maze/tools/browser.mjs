// Development tools only. The shipped app has no browser automation dependency.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function withBrowser(run,{unlimited=false}={}){
  const base=fileURLToPath(new URL('../../',import.meta.url));
  const server=createServer(async(req,res)=>{
    try{
      let path=resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
      if(!path.startsWith(base))throw new Error('Invalid path');
      if(!extname(path))path=join(path,'index.html');
      const data=await readFile(path),mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.wgsl':'text/plain','.wasm':'application/wasm','.css':'text/css','.gz':'application/octet-stream'};
      res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,profile=await mkdtemp(join(tmpdir(),'eigengott-dos-check-'));
  const chrome=spawn(process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[
    '--headless=new','--enable-unsafe-webgpu','--use-angle=metal','--no-first-run','--no-default-browser-check',
    '--remote-debugging-port=0',`--user-data-dir=${profile}`,...(unlimited?['--disable-frame-rate-limit','--disable-gpu-vsync']:[]),'about:blank',
  ],{stdio:['ignore','ignore','pipe']});
  let socket;
  try{
    const endpoint=await new Promise((resolve,reject)=>{
      let log='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),20000);
      chrome.on('error',error=>{clearTimeout(timer);reject(error);});
      chrome.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    });
    socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let serial=0;const pending=new Map(),errors=[],requests=[];
    socket.onmessage=event=>{
      const message=JSON.parse(event.data),p=pending.get(message.id);
      if(p){pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(new Error(JSON.stringify(message.error))):p.resolve(message.result);}
      if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
      if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);
    };
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
      const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${method} timed out`));},20000);
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const cmd=(method,params)=>send(method,params,sessionId);
    await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');
    const evaluate=async expression=>{
      const value=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(value.exceptionDetails)throw new Error(value.exceptionDetails.exception?.description||value.exceptionDetails.text);
      return value.result.value;
    };
    const wait=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await sleep(100);}throw new Error('Timed out waiting for '+expression+' '+JSON.stringify(errors));};
    await run({origin,cmd,evaluate,wait,errors,requests});
  }finally{
    socket?.close();chrome.kill('SIGTERM');server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    await sleep(300);await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:300});
  }
}
