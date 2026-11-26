import {bytes} from './stats.js';
const source=new URL('./shaders/',import.meta.url);
export async function createRenderer(canvas,{onLost,onError}={}){
 if(!navigator.gpu)throw new Error('WebGPU is unavailable. Use a WebGPU-capable browser over HTTPS or localhost.');
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
 if(!adapter)throw new Error('No WebGPU adapter is available.');
 const timing=adapter.features.has('timestamp-query');
 const device=await adapter.requestDevice({requiredFeatures:timing?['timestamp-query']:[]});
 let destroyed=false,pending=0,frameNumber=0,size=[0,0],targets=null,index=0,clear=true;
 let previous=new Float32Array(16),previousReady=false,lastGPU=null,timingBusy=false,uploads=0,generation=0,output=[0,0];
 const uniform=new Float32Array(72),resources=[];
 const buffer=(label,size,usage)=>{const b=device.createBuffer({label,size,usage});resources.push(b);return b;};
 device.lost.then(info=>{if(!destroyed)onLost?.(info.message||'GPU device lost.');});
 device.addEventListener('uncapturederror',e=>{if(!destroyed)onError?.(e.error.message);});
 const context=canvas.getContext('webgpu');if(!context){device.destroy();throw new Error('The WebGPU canvas could not be created.');}
 const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
 try{
 const code=await Promise.all(['common','scene','feedback','present'].map(async name=>{const r=await fetch(new URL(name+'.wgsl',source));if(!r.ok)throw new Error(`Shader download failed: ${name}`);return r.text();}));
 const modules=code.slice(1).map((s,i)=>device.createShaderModule({label:['scene','feedback','present'][i],code:code[0]+'\n'+s}));
 for(const module of modules){const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(m=>`${module.label}:${m.lineNum} ${m.message}`).join('\n'));}
 const stage=GPUShaderStage,layout=device.createBindGroupLayout({entries:[{binding:0,visibility:stage.VERTEX|stage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:stage.FRAGMENT,texture:{}},{binding:2,visibility:stage.FRAGMENT,texture:{}},{binding:3,visibility:stage.FRAGMENT,texture:{}}]});
 const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
 const attrs=[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'float32x3'},{shaderLocation:2,offset:24,format:'unorm8x4'},{shaderLocation:3,offset:28,format:'uint32'}];
 const scenePipeline=body=>device.createRenderPipelineAsync({label:body?'clean body':'world',layout:pipelineLayout,vertex:{module:modules[0],entryPoint:'vertex',buffers:[{arrayStride:32,attributes:attrs}]},fragment:{module:modules[0],entryPoint:'fragment',targets:[{format:'rgba8unorm',writeMask:body?0:GPUColorWrite.ALL},{format:'rgba8unorm',writeMask:body?GPUColorWrite.ALL:0}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
 const [worldPipeline,bodyPipeline,wirePipeline,feedbackPipeline,presentPipeline]=await Promise.all([
  scenePipeline(false),scenePipeline(true),
  device.createRenderPipelineAsync({label:'clean diagnostic lines',layout:pipelineLayout,vertex:{module:modules[0],entryPoint:'wireVertex',buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'unorm8x4'}]}]},fragment:{module:modules[0],entryPoint:'wireFragment',targets:[{format:'rgba8unorm',writeMask:0},{format:'rgba8unorm'}]},primitive:{topology:'line-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'always'}}),
  device.createRenderPipelineAsync({label:'owned temporal history',layout:pipelineLayout,vertex:{module:modules[1],entryPoint:'fullscreen'},fragment:{module:modules[1],entryPoint:'feedback',targets:[{format:'rgba16float'}]}}),
  device.createRenderPipelineAsync({label:'void-only line composition',layout:pipelineLayout,vertex:{module:modules[2],entryPoint:'fullscreen'},fragment:{module:modules[2],entryPoint:'present',targets:[{format}]}}),
 ]);
 const u=buffer('frame',288,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
 const vertices=[0,1].map(i=>buffer('vertices '+i,65536,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST));
 const indices=[0,1].map(i=>buffer('indices '+i,32768,GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST));
 const wires=buffer('debug lines',65536,GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST);
 const dummy=device.createTexture({size:[1,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});resources.push(dummy);
 device.queue.writeTexture({texture:dummy},new Uint8Array(4),{},[1,1]);
 const group=(world,history,body)=>device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:u}},{binding:1,resource:world.createView()},{binding:2,resource:history.createView()},{binding:3,resource:body.createView()}]});
 const sceneGroup=group(dummy,dummy,dummy);
 const query=timing?device.createQuerySet({type:'timestamp',count:6}):null;if(query)resources.push(query);
 const resolve=timing?buffer('timing resolve',48,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null;
 const read=timing?buffer('timing read',48,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST):null;
 function destroyTargets(){if(targets)for(const t of targets.owned)t.destroy();targets=null;}
 function resize(width,height){
  width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));if(size[0]===width&&size[1]===height)return false;
  destroyTargets();size=[width,height];clear=true;previousReady=false;generation++;lastGPU=null;
  const tex=(label,format='rgba8unorm')=>device.createTexture({label,size,format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});
  const world=tex('current world coverage'),body=tex('clean body'),history=[tex('history A','rgba16float'),tex('history B','rgba16float')];
  const depth=device.createTexture({label:'fresh scene depth',size,format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});
  targets={world,body,history,depth,owned:[world,body,...history,depth],feedback:history.map(h=>group(world,h,dummy)),present:history.map(h=>group(world,h,body))};return true;
 }
 const attachment=texture=>({view:texture.createView(),clearValue:{r:0,g:0,b:0,a:0},loadOp:'clear',storeOp:'store'});
 function render(sim,s,dt,time){
  if(destroyed||!targets)return false;
  if(output[0]!==canvas.width||output[1]!==canvas.height){output=[canvas.width,canvas.height];generation++;lastGPU=null;}
  const camera=new Float32Array(sim.memory.buffer,sim.fold_buffer(5),32);
  uniform.set(camera.subarray(0,16),0);uniform.set(previousReady?previous:camera.subarray(0,16),16);
  uniform.set(camera.subarray(16),32);uniform.set([size[0]/size[1],1/1.3032254,s.feedbackFreeze?0:Math.min(.1,Math.max(0,dt)),time],48);
  uniform.set([s.phase,s.opening,0,s.inspection],52);uniform.set([+s.feedback,s.halfLife,s.stretch,+s.worldAnchor],56);
  uniform.set([s.style,s.pitch,s.lineWidth,s.branch],60);uniform.set([...size,canvas.width,canvas.height],64);
  uniform.set([+s.monoWorld,+s.monoVoid,s.grid,s.seed],68);device.queue.writeBuffer(u,0,uniform);
  for(let i=0;i<2;i++){device.queue.writeBuffer(vertices[i],0,bytes(sim,i*2));device.queue.writeBuffer(indices[i],0,bytes(sim,i*2+1));}
  const lineBytes=bytes(sim,4);if(lineBytes.length)device.queue.writeBuffer(wires,0,lineBytes);uploads=288+[0,1,2,3,4].reduce((n,k)=>n+sim.fold_bytes(k),0);
  const encoder=device.createCommandEncoder({label:'arena fold frame'}),measure=timing&&!timingBusy&&frameNumber%60===0,measuredGeneration=generation;
  const stamp=i=>measure?{querySet:query,beginningOfPassWriteIndex:i*2,endOfPassWriteIndex:i*2+1}:undefined;
  if(clear){for(const h of targets.history)encoder.beginRenderPass({colorAttachments:[attachment(h)]}).end();index=0;clear=false;}
  const scene=encoder.beginRenderPass({label:'sealed world and clean body',colorAttachments:[attachment(targets.world),attachment(targets.body)],depthStencilAttachment:{view:targets.depth.createView(),depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'},timestampWrites:stamp(0)});
  scene.setBindGroup(0,sceneGroup);scene.setPipeline(worldPipeline);scene.setVertexBuffer(0,vertices[0]);scene.setIndexBuffer(indices[0],'uint32');scene.drawIndexed(sim.fold_bytes(1)/4);
  if(s.showBody){scene.setPipeline(bodyPipeline);scene.setVertexBuffer(0,vertices[1]);scene.setIndexBuffer(indices[1],'uint32');scene.drawIndexed(sim.fold_bytes(3)/4);}
  if(lineBytes.length){scene.setPipeline(wirePipeline);scene.setVertexBuffer(0,wires);scene.draw(lineBytes.length/16);}scene.end();
  const next=1-index,feedback=encoder.beginRenderPass({label:'bounded feedback into owned texture',colorAttachments:[attachment(targets.history[next])],timestampWrites:stamp(1)});
  feedback.setPipeline(feedbackPipeline);feedback.setBindGroup(0,targets.feedback[index]);feedback.draw(3);feedback.end();
  const present=encoder.beginRenderPass({label:'crisp final-pixel hatches',colorAttachments:[attachment(context.getCurrentTexture())],timestampWrites:stamp(2)});
  present.setPipeline(presentPipeline);present.setBindGroup(0,targets.present[next]);present.draw(3);present.end();
  if(measure){encoder.resolveQuerySet(query,0,6,resolve,0);encoder.copyBufferToBuffer(resolve,0,read,0,48);timingBusy=true;}
  device.queue.submit([encoder.finish()]);index=next;previous.set(camera.subarray(0,16));previousReady=true;frameNumber++;pending++;
  device.queue.onSubmittedWorkDone().then(()=>{pending--;if(measure&&!destroyed)void read.mapAsync(GPUMapMode.READ).then(()=>{const n=new BigUint64Array(read.getMappedRange());const ms=[0,2,4].map(i=>Number(n[i+1]-n[i])/1e6);if(measuredGeneration===generation&&ms.every(x=>x>=0&&x<1000))lastGPU=ms;read.unmap();timingBusy=false;}).catch(()=>{timingBusy=false;});}).catch(()=>{pending--;});return true;
 }
 async function readHistory(){
  if(destroyed||!targets)throw new Error('Renderer is unavailable.');
  const [width,height]=size,row=Math.ceil(width*8/256)*256,b=device.createBuffer({size:row*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const half=x=>{const sign=x&32768?-1:1,exponent=(x>>10)&31,mantissa=x&1023;return sign*(exponent?Math.pow(2,exponent-15)*(1+mantissa/1024):mantissa*Math.pow(2,-24));};
  try{const e=device.createCommandEncoder();e.copyTextureToBuffer({texture:targets.history[index]},{buffer:b,bytesPerRow:row},size);device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const raw=new Uint16Array(b.getMappedRange()),data=new Float32Array(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width*4;x++)data[y*width*4+x]=half(raw[y*row/2+x]);b.unmap();return {width,height,data};}finally{b.destroy();}
 }
 function destroy(){if(destroyed)return;destroyed=true;destroyTargets();for(const r of resources)r.destroy();context.unconfigure();device.destroy();}
 return {resize,render,clear(){clear=true;previousReady=false;},destroy,readHistory,lose:()=>device.destroy(),get busy(){return pending>=2;},snapshot:()=>({resolution:[...size],output:[canvas.width,canvas.height],pendingFrames:pending,frames:frameNumber,uploadsPerFrame:uploads,renderTargetBytes:size[0]*size[1]*28,bufferBytes:288+65536*3+32768*2+(timing?96:0),timestamps:timing,gpuMs:lastGPU?{scene:lastGPU[0],feedback:lastGPU[1],present:lastGPU[2],total:lastGPU.reduce((a,b)=>a+b,0)}:null,adapter:{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,device:adapter.info?.device}})};
 }catch(error){destroyed=true;for(const r of resources)r.destroy();context.unconfigure();device.destroy();throw error;}
}
