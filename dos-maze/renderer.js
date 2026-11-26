import {PROFILE} from './profile.js';
const base=new URL('./',import.meta.url);
const maxBlend={color:{operation:'max',srcFactor:'one',dstFactor:'one'},alpha:{operation:'max',srcFactor:'one',dstFactor:'one'}};
export async function createRenderer(canvas,{onError,onLost,signal}={}){
  if(!navigator.gpu)throw new Error('WebGPU is unavailable. Use a supported browser with hardware acceleration on localhost or HTTPS.');
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw new Error('No WebGPU adapter is available. Enable hardware acceleration and reload.');
  signal?.throwIfAborted();
  const device=await adapter.requestDevice(),context=canvas.getContext('webgpu');
  const buffers=[],textures=[];let targets=[],disposed=false;
  const destroy=()=>{if(disposed)return;disposed=true;targets.forEach(t=>t.destroy());textures.forEach(t=>t.destroy());buffers.forEach(b=>b.destroy());context?.unconfigure();device.destroy();};
  device.addEventListener('uncapturederror',event=>{if(!disposed)onError?.(event.error.message);});
  device.lost.then(info=>{if(!disposed&&info.reason!=='destroyed')onLost?.(info.message||'Graphics device disconnected.');});
  try{
    signal?.throwIfAborted();if(!context)throw new Error('Could not create the WebGPU canvas.');
    const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
    const modules=await Promise.all(['maze','glyphs','title','composite'].map(async name=>{
      const response=await fetch(new URL(`shaders/${name}.wgsl`,base),{signal});if(!response.ok)throw new Error(`Could not load the ${name} shader (${response.status}).`);
      const module=device.createShaderModule({label:`DOS-maze ${name}`,code:await response.text()});
      const info=await module.getCompilationInfo(),errors=info.messages.filter(m=>m.type==='error');
      if(errors.length)throw new Error(errors.map(m=>`${name}:${m.lineNum} ${m.message}`).join('\n'));return module;
    }));
    const buffer=(label,size,usage)=>{const value=device.createBuffer({label,size,usage:usage|GPUBufferUsage.COPY_DST});buffers.push(value);return value;};
    const uniforms=buffer('DOS frame',64,GPUBufferUsage.UNIFORM),lines=buffer('Maze vectors',80000*16,GPUBufferUsage.STORAGE);
    const glyphs=buffer('Nine glyph transforms',9*48,GPUBufferUsage.STORAGE),strokes=buffer('Cached title vectors',1024*32,GPUBufferUsage.STORAGE),order=buffer('Letter priority',9*4,GPUBufferUsage.STORAGE);
    const sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
    const uniform={binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}};
    const storage=(binding,visibility=GPUShaderStage.VERTEX)=>({binding,visibility,buffer:{type:'read-only-storage'}});
    const atlasBinding={binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:'2d-array'}};
    const samplerBinding={binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}};
    const mazeLayout=device.createBindGroupLayout({entries:[uniform,storage(1),{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'uint'}}]});
    const glyphLayout=device.createBindGroupLayout({entries:[uniform,storage(1,GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT),atlasBinding,samplerBinding,storage(4)]});
    const titleLayout=device.createBindGroupLayout({entries:[uniform,storage(1,GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT),atlasBinding,samplerBinding,storage(4),{binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'uint'}}]});
    const compositeLayout=device.createBindGroupLayout({entries:[{...uniform,visibility:GPUShaderStage.FRAGMENT},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{}},samplerBinding]});
    const pipeline=(label,module,layout,targets,sampleCount=1)=>device.createRenderPipelineAsync({label,layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),vertex:{module,entryPoint:'vertexMain'},fragment:{module,entryPoint:'fragmentMain',targets},multisample:{count:sampleCount}});
    const [glyphPipeline,compositePipeline,...wallPipelines]=await Promise.all([
      pipeline('Combined glyph clearance and ownership',modules[1],glyphLayout,[{format:'r8unorm',blend:maxBlend},{format:'r32uint'}]),
      pipeline('Black and white final composition',modules[3],compositeLayout,[{format}]),
      ...[1,4].flatMap(samples=>[pipeline(`Maze / ${samples} samples`,modules[0],mazeLayout,[{format:'rgba8unorm',blend:maxBlend}],samples),pipeline(`Title / ${samples} samples`,modules[2],titleLayout,[{format:'rgba8unorm',blend:maxBlend}],samples)]),
    ]);
    signal?.throwIfAborted();
    const pipelines={1:wallPipelines.slice(0,2),4:wallPipelines.slice(2,4)};
    const atlas=device.createTexture({label:'Exact reference distance fields',size:[512,512,9],format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});textures.push(atlas);
    const atlasView=atlas.createView({dimension:'2d-array'});
    const common=[{binding:0,resource:{buffer:uniforms}},{binding:1,resource:{buffer:glyphs}},{binding:2,resource:atlasView},{binding:3,resource:sampler}];
    const glyphGroup=device.createBindGroup({layout:glyphLayout,entries:[...common,{binding:4,resource:{buffer:order}}]});
    let mazeGroup,titleGroup,compositeGroup,maskView,ownerView,strokeView,msaaView,width=0,height=0,dpr=1,samples=4,segmentCount=0,titleCount=0,lastSalt=-1,completed=0,submissions=0,maxQueued=0,drawCalls=0;
    const fences=[];
    const frame=new Float32Array(16);
    function resize(cssWidth,cssHeight,quality){
      let ratio=Math.min(devicePixelRatio||1,quality.dprCap);
      ratio=Math.min(ratio,Math.min(device.limits.maxTextureDimension2D,4096)/Math.max(cssWidth,cssHeight));
      const w=Math.max(1,Math.round(cssWidth*ratio)),h=Math.max(1,Math.round(cssHeight*ratio)),nextSamples=quality.antialias?4:1;
      if(width===cssWidth&&height===cssHeight&&canvas.width===w&&canvas.height===h&&samples===nextSamples&&targets.length)return false;
      width=cssWidth;height=cssHeight;dpr=w/width;samples=nextSamples;canvas.width=w;canvas.height=h;targets.forEach(t=>t.destroy());targets=[];
      const texture=(label,format,sampleCount=1)=>{const t=device.createTexture({label,size:[w,h],format,sampleCount,usage:GPUTextureUsage.RENDER_ATTACHMENT|(sampleCount===1?GPUTextureUsage.TEXTURE_BINDING:0)});targets.push(t);return t.createView();};
      maskView=texture('Glyph clearance','r8unorm');ownerView=texture('Letter priority','r32uint');strokeView=texture('White vector coverage','rgba8unorm');msaaView=samples===4?texture('Antialiased coverage','rgba8unorm',4):null;
      mazeGroup=device.createBindGroup({layout:mazeLayout,entries:[{binding:0,resource:{buffer:uniforms}},{binding:1,resource:{buffer:lines}},{binding:2,resource:ownerView}]});
      titleGroup=device.createBindGroup({layout:titleLayout,entries:[...common,{binding:4,resource:{buffer:strokes}},{binding:5,resource:ownerView}]});
      compositeGroup=device.createBindGroup({layout:compositeLayout,entries:[{binding:0,resource:{buffer:uniforms}},{binding:1,resource:strokeView},{binding:2,resource:maskView},{binding:3,resource:sampler}]});return true;
    }
    function setAtlasLayer(index,data){device.queue.writeTexture({texture:atlas,origin:[0,0,index]},data,{bytesPerRow:1024,rowsPerImage:512},[512,512,1]);}
    function uploadMaze(data){segmentCount=data.length/4;if(data.byteLength)device.queue.writeBuffer(lines,0,data);}
    function uploadTitle(data){if(data.byteLength>1024*32)throw new Error('Title stroke capacity exceeded.');titleCount=data.length/8;device.queue.writeBuffer(strokes,0,data);}
    function render(layout,animation,quality,queueLimit=2){
      drawCalls=3+(animation.opacity>0&&segmentCount>0?1:0);
      frame.set([width,height,dpr,canvas.height/height*(quality.antialias?1:-1),PROFILE.wallWidth,PROFILE.pathGap,animation.opacity,1,0,0,0,0,0,1,0,1]);
      device.queue.writeBuffer(uniforms,0,frame);device.queue.writeBuffer(glyphs,0,layout);
      if(lastSalt!==animation.salt){lastSalt=animation.salt;device.queue.writeBuffer(order,0,animation.order);}
      const encoder=device.createCommandEncoder(),clear={r:0,g:0,b:0,a:0};
      const masks=encoder.beginRenderPass({label:'Letter masks and hierarchy',colorAttachments:[{view:maskView,clearValue:clear,loadOp:'clear',storeOp:'store'},{view:ownerView,clearValue:clear,loadOp:'clear',storeOp:'store'}]});
      masks.setPipeline(glyphPipeline);masks.setBindGroup(0,glyphGroup);masks.draw(6,9);masks.end();
      const vectors=encoder.beginRenderPass({label:'White maze and title',colorAttachments:[{view:msaaView||strokeView,...(msaaView?{resolveTarget:strokeView}:{}),clearValue:clear,loadOp:'clear',storeOp:msaaView?'discard':'store'}]});
      if(animation.opacity>0&&segmentCount){vectors.setPipeline(pipelines[samples][0]);vectors.setBindGroup(0,mazeGroup);vectors.draw(6,segmentCount);}
      vectors.setPipeline(pipelines[samples][1]);vectors.setBindGroup(0,titleGroup);vectors.draw(6,titleCount);vectors.end();
      const final=encoder.beginRenderPass({label:'Final black and white',colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
      final.setPipeline(compositePipeline);final.setBindGroup(0,compositeGroup);final.draw(3);final.end();device.queue.submit([encoder.finish()]);
      // Bound the backlog by the render cadence. Batch fences at very high
      // refresh rates so completion IPC does not become the bottleneck.
      submissions++;const outstanding=submissions-completed;maxQueued=Math.max(maxQueued,outstanding);
      if(submissions%Math.max(1,Math.floor(queueLimit/2))===0||(outstanding>=queueLimit&&!fences.length)){
        const serial=submissions,promise=device.queue.onSubmittedWorkDone().catch(()=>{}).then(()=>{
          completed=Math.max(completed,serial);while(fences.length&&fences[0].serial<=completed)fences.shift();
        });fences.push({serial,promise});
      }
      if(outstanding>=queueLimit)return fences[0]?.promise;
    }
    return {resize,setAtlasLayer,uploadMaze,uploadTitle,render,destroy,
      get diagnostics(){return {renderSize:[canvas.width,canvas.height],pixelRatio:dpr,samples,passes:3,pipelines:6,draws:drawCalls,maxQueuedFrames:maxQueued,gpuBufferBytes:buffers.reduce((sum,b)=>sum+b.size,0),targetCount:targets.length,targetBytes:canvas.width*canvas.height*(9+(samples===4?16:0))};},
      // Allows controlled device-loss testing, without browser-specific hooks.
      loseDeviceForTest(){device.destroy();onLost?.('Simulated graphics-device loss.');},
    };
  }catch(error){destroy();throw error;}
}
