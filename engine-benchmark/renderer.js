const base=new URL('./',import.meta.url);
const meshLayout={arrayStride:32,attributes:[{shaderLocation:0,offset:0,format:'float32x3'},{shaderLocation:1,offset:12,format:'uint32'},{shaderLocation:2,offset:16,format:'uint32'},{shaderLocation:3,offset:20,format:'uint32'},{shaderLocation:4,offset:24,format:'float32x2'}]};
export async function createRenderer(canvas,sim,{signal,onError,onLost}={}){
  if(!navigator.gpu)throw new Error('WebGPU is unavailable. Use a supported browser with hardware acceleration over localhost or HTTPS.');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('No WebGPU adapter is available.');signal?.throwIfAborted();
  const timestamps=adapter.features.has('timestamp-query');
  const device=await adapter.requestDevice({requiredFeatures:timestamps?['timestamp-query']:[]}),context=canvas.getContext('webgpu');let disposed=false,active=null;
  const resources=[],targets=[];const stages=new Set();
  const destroy=()=>{if(disposed)return;disposed=true;active?.destroy();for(const s of stages)s.destroy();for(const r of [...targets,...resources])r.destroy();context?.unconfigure();device.destroy();};
  device.addEventListener('uncapturederror',e=>{if(!disposed)onError?.(e.error.message);});device.lost.then(info=>{if(!disposed&&info.reason!=='destroyed')onLost?.(info.message);});
  const bytes=(pointer,length)=>{if(pointer<0||length<0||pointer+length>sim.memory.buffer.byteLength)throw new Error('Invalid WASM buffer range.');return new Uint8Array(sim.memory.buffer,pointer,length);};
  try{
    signal?.throwIfAborted();if(!context)throw new Error('Could not create the WebGPU canvas.');
    const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
    const modules=await Promise.all(['world','wire','present'].map(async name=>{
      const r=await fetch(new URL(`shaders/${name}.wgsl`,base),{signal});if(!r.ok)throw new Error(`Could not load ${name} shader.`);
      const m=device.createShaderModule({label:`Engine ${name}`,code:await r.text()}),info=await m.getCompilationInfo();const errors=info.messages.filter(x=>x.type==='error');
      if(errors.length)throw new Error(errors.map(e=>`${name}:${e.lineNum} ${e.message}`).join('\n'));return m;
    }));
    const buffer=(label,size,usage)=>device.createBuffer({label,size:Math.max(4,Math.ceil(size/4)*4),usage:usage|GPUBufferUsage.COPY_DST});
    const frame=buffer('Camera and render options',96,GPUBufferUsage.UNIFORM),body=buffer('World-space player body',512*32,GPUBufferUsage.VERTEX),bodyIndices=buffer('Player indices',768*4,GPUBufferUsage.INDEX);resources.push(frame,body,bodyIndices);
    const queries=timestamps?device.createQuerySet({type:'timestamp',count:4}):null;
    const queryResolve=timestamps?device.createBuffer({size:32,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}):null;
    const queryRead=timestamps?device.createBuffer({size:32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}):null;
    if(timestamps)resources.push(queries,queryResolve,queryRead);
    let timingBusy=false,timingFrames=0,gpuSceneMs=null,gpuPresentMs=null;
    const palette=device.createTexture({label:'256-color material palette',size:[256,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
    const lut=device.createTexture({label:'Indexed-color 3D lookup',dimension:'3d',size:[32,32,32],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});resources.push(palette,lut);
    device.queue.writeTexture({texture:palette},bytes(sim.palette_ptr(),1024),{bytesPerRow:1024},[256,1]);device.queue.writeTexture({texture:lut},bytes(sim.lut_ptr(),32**3*4),{bytesPerRow:128,rowsPerImage:32},[32,32,32]);
    const globalLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}}]});
    const arenaLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}}]});
    const presentLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:'3d'}}]});
    const globalGroup=device.createBindGroup({layout:globalLayout,entries:[{binding:0,resource:{buffer:frame}},{binding:1,resource:palette.createView()}]});
    const worldPipeline=device.createRenderPipelineAsync({label:'3D arena and physical body',layout:device.createPipelineLayout({bindGroupLayouts:[globalLayout,arenaLayout]}),vertex:{module:modules[0],entryPoint:'vertexMain',buffers:[meshLayout]},fragment:{module:modules[0],entryPoint:'fragmentMain',targets:[{format:'rgba8unorm'}]},primitive:{topology:'triangle-list',frontFace:'ccw',cullMode:'back'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
    const wirePipeline=device.createRenderPipelineAsync({label:'Structural seam inspection',layout:device.createPipelineLayout({bindGroupLayouts:[globalLayout]}),vertex:{module:modules[1],entryPoint:'vertexMain',buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:'float32x3'}]}]},fragment:{module:modules[1],entryPoint:'fragmentMain',targets:[{format:'rgba8unorm'}]},primitive:{topology:'line-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'always'}});
    const presentPipeline=device.createRenderPipelineAsync({label:'Nearest upscale and indexed palette',layout:device.createPipelineLayout({bindGroupLayouts:[presentLayout]}),vertex:{module:modules[2],entryPoint:'vertexMain'},fragment:{module:modules[2],entryPoint:'fragmentMain',targets:[{format}]}});
    const atlasPipeline=device.createRenderPipelineAsync({label:'Lightmap atlas inspection',layout:device.createPipelineLayout({bindGroupLayouts:[presentLayout]}),vertex:{module:modules[2],entryPoint:'vertexMain'},fragment:{module:modules[2],entryPoint:'atlasFragment',targets:[{format}]}});
    const [world,wire,present,atlasDisplay]=await Promise.all([worldPipeline,wirePipeline,presentPipeline,atlasPipeline]);signal?.throwIfAborted();
    const nearest=device.createSampler({minFilter:'nearest',magFilter:'nearest',mipmapFilter:'nearest',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
    let colorView,depthView,presentGroup,atlasGroup,renderWidth=0,renderHeight=0,queued=0;const completions=[];
    function resize(width,height,internalHeight=360){
      const nativeScale=Math.min(devicePixelRatio||1,2,device.limits.maxTextureDimension2D/Math.max(width,height));
      const cw=Math.max(1,Math.round(width*nativeScale)),ch=Math.max(1,Math.round(height*nativeScale));
      let h=internalHeight||height;let w=Math.round(h*width/height);const cap=Math.min(1,2048/Math.max(w,h));w=Math.max(1,Math.round(w*cap));h=Math.max(1,Math.round(h*cap));
      if(canvas.width===cw&&canvas.height===ch&&renderWidth===w&&renderHeight===h&&targets.length)return false;
      canvas.width=cw;canvas.height=ch;renderWidth=w;renderHeight=h;for(const t of targets)t.destroy();targets.length=0;
      const color=device.createTexture({label:'Low-resolution scene',size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
      const depth=device.createTexture({label:'3D depth',size:[w,h],format:'depth24plus',usage:GPUTextureUsage.RENDER_ATTACHMENT});targets.push(color,depth);colorView=color.createView();depthView=depth.createView();
      presentGroup=device.createBindGroup({layout:presentLayout,entries:[{binding:0,resource:colorView},{binding:1,resource:lut.createView({dimension:'3d'})}]});sim.engine_view(w,h);return true;
    }
    async function stage(source=sim,schedule=async fn=>{while(!fn()){}},stageSignal=signal){
      if(disposed)throw new Error('Graphics device was disposed.');const objects=[];let result;let scoped=true;device.pushErrorScope('validation');
      try{
        const read=kind=>{const pointer=source.arena_buffer_ptr(kind,0),length=source.arena_buffer_bytes(kind,0);if(pointer<0||length<0||pointer+length>source.memory.buffer.byteLength)throw new Error('Invalid candidate buffer range.');return new Uint8Array(source.memory.buffer,pointer,length);};
        const atlasSize=source.atlas_size();
        const vb=read(0),ib=read(1),points=read(2),edges=read(3),light=read(5);
        if(!vb.byteLength||!ib.byteLength||vb.byteLength%32||ib.byteLength%4||light.byteLength>64*32)throw new Error('Invalid staged mesh counts.');
        const make=async(label,data,usage,min=4)=>{const b=buffer(label,Math.max(min,data.byteLength),usage);objects.push(b);let offset=0;await schedule(()=>{stageSignal?.throwIfAborted();const length=Math.min(262144,data.byteLength-offset);if(length)device.queue.writeBuffer(b,offset,data,offset,length);offset+=length;return offset>=data.byteLength;});return b;};
        const vbo=await make('Candidate arena',vb,GPUBufferUsage.VERTEX),ibo=await make('Candidate indices',ib,GPUBufferUsage.INDEX),point=await make('Structural positions',points,GPUBufferUsage.VERTEX),edge=await make('Structural edges',edges,GPUBufferUsage.INDEX),lights=await make('Preset emitters',light,GPUBufferUsage.STORAGE,32);
        const atlas=device.createTexture({label:'Coarse parent-plane lightmap',size:[atlasSize,atlasSize],format:'rgba8unorm',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING});objects.push(atlas);const texels=read(4);let row=0;await schedule(()=>{stageSignal?.throwIfAborted();const rows=Math.min(64,atlasSize-row);device.queue.writeTexture({texture:atlas,origin:[0,row]},texels.subarray(row*atlasSize*4,(row+rows)*atlasSize*4),{bytesPerRow:atlasSize*4,rowsPerImage:rows},[atlasSize,rows]);row+=rows;return row>=atlasSize;});
        const group=device.createBindGroup({layout:arenaLayout,entries:[{binding:0,resource:atlas.createView()},{binding:1,resource:nearest},{binding:2,resource:{buffer:lights}}]});
        let deleted=false;result={vbo,ibo,point,edge,group,atlasView:atlas.createView(),indexCount:ib.byteLength/4,edgeCount:edges.byteLength/4,bytes:objects.reduce((sum,o)=>sum+(o.size||atlasSize*atlasSize*4),0),destroy(){if(deleted)return;deleted=true;objects.forEach(o=>o.destroy());stages.delete(result);}};stages.add(result);
        const error=await device.popErrorScope();scoped=false;if(error)throw new Error(error.message);await device.queue.onSubmittedWorkDone();stageSignal?.throwIfAborted();if(disposed)throw new Error('Graphics device changed during staging.');return result;
      }catch(error){if(scoped)await device.popErrorScope().catch(()=>{});if(result)result.destroy();else objects.forEach(o=>o.destroy());throw error;}
    }
    function activate(mesh){const previous=active;active=mesh;stages.delete(mesh);atlasGroup=device.createBindGroup({layout:presentLayout,entries:[{binding:0,resource:mesh.atlasView},{binding:1,resource:lut.createView({dimension:'3d'})}]});previous?.destroy();}
    function render(showWire,showAtlas=false){
      if(!active)return;device.queue.writeBuffer(frame,0,bytes(sim.frame_ptr(),96));device.queue.writeBuffer(body,0,bytes(sim.body_vbo_ptr(),sim.body_vbo_bytes()));device.queue.writeBuffer(bodyIndices,0,bytes(sim.body_ibo_ptr(),sim.body_ibo_count()*4));
      const timed=timestamps&&!timingBusy&&timingFrames++%60===0;
      const encoder=device.createCommandEncoder();const pass=encoder.beginRenderPass({label:'Sealed 3D arena',...(timed?{timestampWrites:{querySet:queries,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}:{}),colorAttachments:[{view:colorView,loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}],depthStencilAttachment:{view:depthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});
      pass.setPipeline(world);pass.setBindGroup(0,globalGroup);pass.setBindGroup(1,active.group);pass.setVertexBuffer(0,active.vbo);pass.setIndexBuffer(active.ibo,'uint32');pass.drawIndexed(active.indexCount);
      pass.setVertexBuffer(0,body);pass.setIndexBuffer(bodyIndices,'uint32');pass.drawIndexed(sim.body_ibo_count());
      if(showWire){pass.setPipeline(wire);pass.setBindGroup(0,globalGroup);pass.setVertexBuffer(0,active.point);pass.setIndexBuffer(active.edge,'uint32');pass.drawIndexed(active.edgeCount);}pass.end();
      const final=encoder.beginRenderPass({label:'Indexed-color display',...(timed?{timestampWrites:{querySet:queries,beginningOfPassWriteIndex:2,endOfPassWriteIndex:3}}:{}),colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});final.setPipeline(showAtlas?atlasDisplay:present);final.setBindGroup(0,showAtlas?atlasGroup:presentGroup);final.draw(3);final.end();
      if(timed){encoder.resolveQuerySet(queries,0,4,queryResolve,0);encoder.copyBufferToBuffer(queryResolve,0,queryRead,0,32);}device.queue.submit([encoder.finish()]);
      if(timed){timingBusy=true;void queryRead.mapAsync(GPUMapMode.READ).then(()=>{
        if(disposed)return;const t=new BigUint64Array(queryRead.getMappedRange());
        // Timestamp counters may reset; discard unexpected deltas.
        if(t[1]>=t[0]&&t[3]>=t[2]){gpuSceneMs=Number(t[1]-t[0])/1e6;gpuPresentMs=Number(t[3]-t[2])/1e6;}
      }).catch(()=>{}).finally(()=>{if(queryRead.mapState==='mapped')queryRead.unmap();timingBusy=false;});}
      queued++;const completion=device.queue.onSubmittedWorkDone().catch(()=>{}).then(()=>{queued--;if(completions[0]===completion)completions.shift();});completions.push(completion);if(queued>=2)return completions[0];
    }
    return {resize,stage,activate,render,destroy,setSimulation(value){sim=value;},get diagnostics(){return{renderSize:[renderWidth,renderHeight],outputSize:[canvas.width,canvas.height],gpuMeshBytes:active?.bytes||0,targetBytes:renderWidth*renderHeight*8,passes:2,pipelines:4,stagedGpuBytes:Array.from(stages).reduce((sum,s)=>sum+s.bytes,0),gpuTimestamps:timestamps,gpuSceneMs,gpuPresentMs};},simulateLoss(){device.destroy();onLost?.('Simulated device loss.');}};
  }catch(error){destroy();throw error;}
}
