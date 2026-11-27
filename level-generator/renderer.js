// Minimal blockout adapter around the v0.1.3 packed vertices, frame and lighting.
export async function createRenderer(canvas){
 if(!navigator.gpu)throw new Error('WebGPU is required. Open this prototype in a WebGPU-capable browser.');
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice(),context=canvas.getContext('webgpu'),format=navigator.gpu.getPreferredCanvasFormat(),errors=[];
 device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.lost.then(info=>{if(!disposed)errors.push('GPU device lost: '+info.message);});
 context.configure({device,format,alphaMode:'opaque'});let disposed=false,active=null,depth=null,output=[0,0],frames=0;
 const buffer=(name,size,usage)=>device.createBuffer({label:name,size:Math.max(4,size),usage:usage|GPUBufferUsage.COPY_DST});
 const frame=buffer('v0.1.3 frame ABI',384,GPUBufferUsage.UNIFORM),lights=buffer('v0.1.3 point lights',8208,GPUBufferUsage.STORAGE),shadows=buffer('empty shadow casters',4096,GPUBufferUsage.STORAGE);
 const sources=await Promise.all(['./engine/shaders/common.wgsl','./engine/shaders/lighting.wgsl'].map(async p=>(await fetch(p)).text()));
 const module=device.createShaderModule({code:sources.join('\n')+`
 struct VertexIn { @location(0) position:vec3f, @location(1) normal:u32, @location(2) material:u32 }
 struct Surface { @builtin(position) clip:vec4f, @location(0) position:vec3f, @location(1) normal:vec3f, @location(2) @interpolate(flat) material:u32 }
 @vertex fn vertex(v:VertexIn)->Surface {var o:Surface;o.position=v.position;o.material=v.material;o.normal=unpack4x8snorm(v.normal).xyz;o.clip=frame.vp*vec4f(o.position,1);return o;}
 @fragment fn fragment(v:Surface)->@location(0) vec4f {
  if(frame.view.w>.5&&v.normal.z<-.8){discard;}
  if(v.material==1u){return vec4f(1,0,0,1);}if(v.material==2u){return vec4f(0,1,0,1);}
  let grey=select(select(.80,.70,v.normal.z>.8),.88,v.normal.z<-.8);
  let lit=vec3f(grey)*dynamicLighting(v.position,v.normal);
  let mapped=pow(lit/(lit+vec3f(.65)),vec3f(.65));return vec4f(mapped,1);
 }`});
 const info=await module.getCompilationInfo(),bad=info.messages.filter(m=>m.type==='error');if(bad.length)throw new Error(bad.map(m=>m.message).join('\n'));
 const pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'uint32'},{shaderLocation:2,offset:20,format:'uint32'}]}]},fragment:{module,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
 const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:frame}},{binding:3,resource:{buffer:lights}},{binding:4,resource:{buffer:shadows}}]});
 const uniform=new Float32Array(96),lightData=new Float32Array(2052);
 function resize(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));if(output[0]===w&&output[1]===h)return;canvas.width=w;canvas.height=h;depth?.destroy();depth=device.createTexture({size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});output=[w,h];}
 async function stage(sim,emitters,structure){const v=new Uint8Array(sim.memory.buffer,sim.arena_buffer_ptr(0,0),sim.arena_buffer_bytes(0,0)).slice(),i=new Uint8Array(sim.memory.buffer,sim.arena_buffer_ptr(1,0),sim.arena_buffer_bytes(1,0)),vb=buffer('blockout shell',v.byteLength,GPUBufferUsage.VERTEX),ib=buffer('blockout indices',i.byteLength,GPUBufferUsage.INDEX);const words=new Uint32Array(v.buffer);for(let n=0;n<v.length/32;n++)words[n*8+5]=structure?.materials?.[Math.floor(n/3)]||0;const doors=buffer('structural moving door leaves',128*36*32,GPUBufferUsage.VERTEX);device.queue.writeBuffer(vb,0,v);device.queue.writeBuffer(ib,0,i);await device.queue.onSubmittedWorkDone();return{vb,ib,doors,count:i.length/4,emitters,bytes:v.length+i.length,destroy(){vb.destroy();ib.destroy();doors.destroy();}};}
 function activate(next){active?.destroy();active=next;}
 function render(sim,{cutaway=false,lighting=true,time=0,doorBoxes=[]}={}){if(disposed||!active)return;resize();sim.engine_view(...output);const a=new Float32Array(sim.memory.buffer,sim.frame_ptr(),24);uniform.fill(0);uniform.set(a.subarray(0,16));uniform.set(a.subarray(16,20),32);uniform[35]=time;uniform[51]=+cutaway;uniform[47]=0;uniform[69]=0;device.queue.writeBuffer(frame,0,uniform);lightData.fill(0);if(lighting){lightData[0]=Math.min(active.emitters.length,128);for(let i=0;i<lightData[0];i++){const l=active.emitters[i],k=4+i*16;lightData.set([...l.position,l.radius,...(l.color||[1,1,1]),l.intensity],k);}}device.queue.writeBuffer(lights,0,lightData);
  const encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:.015,g:.018,b:.022,a:1}}],depthStencilAttachment:{view:depth.createView(),depthLoadOp:'clear',depthClearValue:1,depthStoreOp:'store'}});pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.setVertexBuffer(0,active.vb);pass.setIndexBuffer(active.ib,'uint32');pass.drawIndexed(active.count);const doorData=boxVertices(doorBoxes);if(doorData.byteLength){device.queue.writeBuffer(active.doors,0,doorData);pass.setVertexBuffer(0,active.doors);pass.draw(doorData.byteLength/32);}pass.end();device.queue.submit([encoder.finish()]);frames++;
 }
 return{stage,activate,render,snapshot:()=>({frames,output,triangles:active?.count/3||0,gpuBytes:active?.bytes||0,lightCount:active?.emitters.length||0,errors:[...errors],source:'v0.1.3 packed geometry/frame/dynamic-lighting adapter',material:'neutral structural grey; solid red lava and green radiation; no details'}),destroy(){disposed=true;active?.destroy();depth?.destroy();frame.destroy();lights.destroy();shadows.destroy();context.unconfigure();device.destroy();}};
}

function boxVertices(boxes){const data=new ArrayBuffer(boxes.length*36*32),f=new Float32Array(data),u=new Uint32Array(data);let n=0;for(const {centre:c,half:h}of boxes)for(let axis=0;axis<3;axis++)for(const sign of[-1,1]){const j=(axis+1)%3,k=(axis+2)%3,quad=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const p=c.slice();p[axis]+=sign*h[axis];p[j]+=a*h[j];p[k]+=b*h[k];return p;}),order=sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],normal=(sign>0?127:129)<<(axis*8);for(const i of order){f.set(quad[i],n*8);u[n*8+3]=normal>>>0;n++;}}return new Uint8Array(data);}
