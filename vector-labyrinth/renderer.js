import {ATLAS_SIZE} from './glyphs.js';
import {titleStrokes} from './hatching.js';
import {quadsFromFrames} from './collisions.js';
async function shader(device,path){
  const response=await fetch(path);if(!response.ok)throw new Error(`Could not load ${path}.`);
  const module=device.createShaderModule({label:path,code:await response.text()});
  const info=await module.getCompilationInfo(),errors=info.messages.filter(m=>m.type==='error');
  if(errors.length)throw new Error(errors.map(m=>`${path}:${m.lineNum} ${m.message}`).join('\n'));
  return module;
}
const maxBlend={color:{operation:'max',srcFactor:'one',dstFactor:'one'},alpha:{operation:'max',srcFactor:'one',dstFactor:'one'}};
export async function makeRenderer(canvas,onFatal,onStage=()=>{}){
  if(!navigator.gpu)throw new Error('This study needs a browser with WebGPU and hardware acceleration enabled. Serve it over localhost or HTTPS.');
  onStage('requesting WebGPU adapter');const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)throw new Error('No WebGPU adapter is available. Enable hardware acceleration and reload.');
  onStage('requesting WebGPU device');const device=await adapter.requestDevice(),errors=[];
  device.addEventListener('uncapturederror',event=>{errors.push(event.error.message);onFatal(event.error.message);});
  device.lost.then(info=>{if(info.reason!=='destroyed')onFatal('The graphics device disconnected. Reload to rebuild the study.');});
  const context=canvas.getContext('webgpu');if(!context)throw new Error('The browser could not create a WebGPU canvas.');
  const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
  onStage('compiling shaders');const [maskModule,lineModule,compositeModule,titleModule,ownerModule,gridModule]=await Promise.all(['mask','lines','composite','title','ownership','grid-lines'].map(name=>shader(device,`shaders/${name}.wgsl`)));
  const uniformBuffer=device.createBuffer({label:'Pixel-space stroke controls',size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const lineBuffer=device.createBuffer({label:'WASM vector wall segments',size:200000*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const glyphBuffer=device.createBuffer({label:'Independent glyph mask transforms',size:24*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const titleBuffer=device.createBuffer({label:'Per-glyph hatch vectors',size:200000*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const lineOwnersBuffer=device.createBuffer({label:'Stroke plate IDs',size:200000*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const plateBuffer=device.createBuffer({label:'Perspective and fill-plane footprints',size:640*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const quadBuffer=device.createBuffer({label:'Projected plane quads',size:640*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const edgeBuffer=device.createBuffer({label:'Collision edge visibility decisions',size:640*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const orderBuffer=device.createBuffer({label:'Per-letter hierarchy',size:24*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  const maskLayout=device.createBindGroupLayout({entries:[
    {binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
    {binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
    {binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:'2d-array'}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
  ]});
  const lineLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'uint'}}]});
  const titleLayout=device.createBindGroupLayout({entries:[
    {binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
    {binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
    {binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:'2d-array'}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
    {binding:4,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}},
    {binding:5,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'uint'}},
  ]});
  const ownerLayout=device.createBindGroupLayout({entries:[
    {binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
    {binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
    {binding:2,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
    {binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:'2d-array'}},{binding:4,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
    {binding:5,visibility:GPUShaderStage.VERTEX,buffer:{type:'read-only-storage'}},
    {binding:6,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
    {binding:7,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
  ]});
  const ownerPipelines=await Promise.all([['plateVertex','plateFragment'],['glyphVertex','glyphFragment']].map(([vertex,fragment],index)=>device.createRenderPipelineAsync({label:`Exclusive ownership / ${vertex}`,layout:device.createPipelineLayout({bindGroupLayouts:[ownerLayout]}),vertex:{module:ownerModule,entryPoint:vertex},fragment:{module:ownerModule,entryPoint:fragment,targets:[{format:'r32uint'}]},depthStencil:{format:'depth32float',depthWriteEnabled:index===0,depthCompare:index===0?'less-equal':'always'}})));
  const compositeLayout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}}]});
  onStage('creating render pipelines');const [maskPipeline,compositePipeline]=await Promise.all([
    device.createRenderPipelineAsync({label:'Glyph masks only / no visible filled caps',layout:device.createPipelineLayout({bindGroupLayouts:[maskLayout]}),vertex:{module:maskModule,entryPoint:'vertexMain'},fragment:{module:maskModule,entryPoint:'fragmentMain',targets:[{format:'rgba8unorm',blend:maxBlend}]}}),
    device.createRenderPipelineAsync({label:'Layer opacity and background',layout:device.createPipelineLayout({bindGroupLayouts:[compositeLayout]}),vertex:{module:compositeModule,entryPoint:'vertexMain'},fragment:{module:compositeModule,entryPoint:'fragmentMain',targets:[{format}]}}),
  ]);
  const linePipelines={},titlePipelines={},gridPipelines={};
  await Promise.all([1,4].map(async samples=>{
    const pipelines=await Promise.all(['mazeVertex','textVertical','textHorizontal'].map(entryPoint=>device.createRenderPipelineAsync({label:`${entryPoint} / ${samples} samples`,layout:device.createPipelineLayout({bindGroupLayouts:[lineLayout]}),vertex:{module:lineModule,entryPoint},fragment:{module:lineModule,entryPoint:'fragmentMain',targets:[{format:'rgba8unorm',blend:maxBlend}]},multisample:{count:samples}})));
    linePipelines[samples]=pipelines;
    titlePipelines[samples]=await device.createRenderPipelineAsync({label:`Per-letter hatch vectors / ${samples} samples`,layout:device.createPipelineLayout({bindGroupLayouts:[titleLayout]}),vertex:{module:titleModule,entryPoint:'vertexMain'},fragment:{module:titleModule,entryPoint:'fragmentMain',targets:[{format:'rgba8unorm',blend:maxBlend}]},multisample:{count:samples}});
    gridPipelines[samples]=await device.createRenderPipelineAsync({label:`Exact grid wall rectangles / ${samples} samples`,layout:device.createPipelineLayout({bindGroupLayouts:[lineLayout]}),vertex:{module:gridModule,entryPoint:'vertexMain'},fragment:{module:gridModule,entryPoint:'fragmentMain',targets:[{format:'rgba8unorm',blend:maxBlend}]},multisample:{count:samples}});
  }));
  let lineGroup,fontTexture,maskGroup,titleGroup,ownerGroup,targets=[],maskView,strokeView,ownerView,ownerDepthView,msaaView,compositeGroup,segmentCount=0,plateCount=0,samples=4,dpr=1,viewWidth=0,viewHeight=0,projectionWidth=0,projectionHeight=0,lastStrict=false;
  const uniforms=new Float32Array(16);
  function bindResources(){
    if(!fontTexture||!ownerView)return;
    const atlasView=fontTexture.createView({dimension:'2d-array'});
    lineGroup=device.createBindGroup({layout:lineLayout,entries:[{binding:0,resource:{buffer:uniformBuffer}},{binding:1,resource:{buffer:lineBuffer}},{binding:2,resource:{buffer:lineOwnersBuffer}},{binding:3,resource:ownerView}]});
    titleGroup=device.createBindGroup({layout:titleLayout,entries:[{binding:0,resource:{buffer:uniformBuffer}},{binding:1,resource:{buffer:glyphBuffer}},{binding:2,resource:atlasView},{binding:3,resource:sampler},{binding:4,resource:{buffer:titleBuffer}},{binding:5,resource:ownerView}]});
    ownerGroup=device.createBindGroup({layout:ownerLayout,entries:[{binding:0,resource:{buffer:uniformBuffer}},{binding:1,resource:{buffer:plateBuffer}},{binding:2,resource:{buffer:glyphBuffer}},{binding:3,resource:atlasView},{binding:4,resource:sampler},{binding:5,resource:{buffer:orderBuffer}},{binding:6,resource:{buffer:quadBuffer}},{binding:7,resource:{buffer:edgeBuffer}}]});
  }
  function setFont(cache){
    const next=device.createTexture({label:'Cached glyph signed-distance fields',size:[ATLAS_SIZE,ATLAS_SIZE,Math.max(1,cache.layers.length)],format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
    cache.layers.forEach((data,index)=>device.queue.writeTexture({texture:next,origin:[0,0,index]},data,{bytesPerRow:ATLAS_SIZE*2,rowsPerImage:ATLAS_SIZE},[ATLAS_SIZE,ATLAS_SIZE,1]));
    const nextGroup=device.createBindGroup({layout:maskLayout,entries:[{binding:0,resource:{buffer:uniformBuffer}},{binding:1,resource:{buffer:glyphBuffer}},{binding:2,resource:next.createView({dimension:'2d-array'})},{binding:3,resource:sampler}]});
    const previous=fontTexture;fontTexture=next;maskGroup=nextGroup;previous?.destroy();
    bindResources();
  }
  function resize(settings){
    const strict=settings.tectonicMotion&&settings.constantGap;
    const width=window.innerWidth,height=window.innerHeight;viewWidth=width;viewHeight=height;
    let ratio=strict?(window.devicePixelRatio||1):Math.min(window.devicePixelRatio||1,settings.dprCap);
    ratio=Math.min(ratio,(strict?device.limits.maxTextureDimension2D:Math.min(device.limits.maxTextureDimension2D,4096))/Math.max(width,height));
    let alignment=1;if(strict)for(let n=1;n<=128;n++)if(Math.abs(n*ratio-Math.round(n*ratio))<.00001){alignment=n;break;}
    const cssWidth=strict?Math.ceil(width/alignment)*alignment:width,cssHeight=strict?Math.ceil(height/alignment)*alignment:height;
    const w=Math.max(1,Math.round(cssWidth*ratio)),h=Math.max(1,Math.round(cssHeight*ratio)),nextSamples=strict?1:settings.antialias?4:1;
    // A fractional CSS viewport can otherwise rescale the backing image and
    // blur each grid column differently. Pad/crop the last device pixel instead.
    projectionWidth=cssWidth;projectionHeight=cssHeight;
    canvas.style.width=strict?`${projectionWidth}px`:'100vw';canvas.style.height=strict?`${projectionHeight}px`:'100dvh';
    if(canvas.width===w&&canvas.height===h&&samples===nextSamples&&lastStrict===strict&&targets.length)return false;
    lastStrict=strict;canvas.width=w;canvas.height=h;samples=nextSamples;dpr=w/cssWidth;targets.forEach(t=>t.destroy());
    const mask=device.createTexture({label:'Title region mask',size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    const stroke=device.createTexture({label:'White vector coverage / maze + title',size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    const owner=device.createTexture({label:'One visible plate / letter owner per pixel',size:[w,h],format:'r32uint',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});
    const ownerDepth=device.createTexture({label:'Edge visibility resolution · no lighting',size:[w,h],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT});
    const msaa=samples===4?device.createTexture({label:'Antialiased vector coverage',size:[w,h],format:'rgba8unorm',sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}):null;
    targets=[mask,stroke,owner,ownerDepth,...(msaa?[msaa]:[])];maskView=mask.createView();strokeView=stroke.createView();ownerView=owner.createView();ownerDepthView=ownerDepth.createView();msaaView=msaa?.createView();bindResources();
    compositeGroup=device.createBindGroup({layout:compositeLayout,entries:[{binding:0,resource:{buffer:uniformBuffer}},{binding:1,resource:strokeView},{binding:2,resource:maskView},{binding:3,resource:sampler}]});return true;
  }
  function uploadSegments(data,owners,plates,quads,priorities){
    segmentCount=data.length/4;plateCount=plates?.length/12||0;
    if(data.length){device.queue.writeBuffer(lineBuffer,0,data);device.queue.writeBuffer(lineOwnersBuffer,0,owners||new Uint32Array(segmentCount));}
    if(plateCount){device.queue.writeBuffer(plateBuffer,0,plates);device.queue.writeBuffer(quadBuffer,0,quads||quadsFromFrames(plates));device.queue.writeBuffer(edgeBuffer,0,priorities||Float32Array.from({length:plateCount*4},(_,i)=>(Math.floor(i/4)+1)/(plateCount+1)));}
  }
  function render(settings,layout,time,phase,mazeAlpha,textAlpha){
    const width=projectionWidth,height=projectionHeight;
    const background=[1,3,5].map(index=>parseInt(settings.background.slice(index,index+2),16)/255);
    const strictGrid=settings.tectonicMotion&&settings.constantGap;
    const modern=strictGrid||settings.preventOverlap||settings.font==='reference'||settings.titleHatch!=='letters'||settings.hatchFlickerGlobal||settings.hatchFlickerLetters||Array.from(layout.data).some((v,i)=>i%12===7&&v>1);
    // viewport.w stores vertical DPR; its sign controls analytic antialiasing.
    uniforms.set([width,height,dpr,canvas.height/height*(settings.antialias?1:-1),settings.wallWidth,settings.pathGap,mazeAlpha,textAlpha,phase[0],phase[1],background[0],background[1],background[2],settings.preventOverlap?1:0,strictGrid?settings.wallWidth+settings.pathGap:0,modern?1:0]);
    device.queue.writeBuffer(uniformBuffer,0,uniforms);
    if(layout.data.length)device.queue.writeBuffer(glyphBuffer,0,layout.data);
    const encoder=device.createCommandEncoder(),clear={r:0,g:0,b:0,a:0};let draws=0;
    if(settings.preventOverlap){
      const pass=encoder.beginRenderPass({label:'Exclusive edge and letter hierarchy',colorAttachments:[{view:ownerView,clearValue:clear,loadOp:'clear',storeOp:'store'}],depthStencilAttachment:{view:ownerDepthView,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'discard'}});
      pass.setBindGroup(0,ownerGroup);
      if(plateCount&&mazeAlpha>0&&!strictGrid){pass.setPipeline(ownerPipelines[0]);pass.draw(6,plateCount);draws++;}
      if(layout.data.length&&textAlpha>0){const order=new Uint32Array(layout.order||Array.from({length:layout.data.length/12},(_,i)=>i));device.queue.writeBuffer(orderBuffer,0,order);pass.setPipeline(ownerPipelines[1]);pass.draw(6,order.length);draws++;}pass.end();
    }
    const maskPass=encoder.beginRenderPass({label:'Glyph regions',colorAttachments:[{view:maskView,clearValue:clear,loadOp:'clear',storeOp:'store'}]});
    if(layout.data.length&&textAlpha>0){maskPass.setPipeline(maskPipeline);maskPass.setBindGroup(0,maskGroup);maskPass.draw(6,layout.data.length/12);draws++;}maskPass.end();
    const strokePass=encoder.beginRenderPass({label:'Only horizontal and vertical white vectors',colorAttachments:[{view:samples===4?msaaView:strokeView,...(samples===4?{resolveTarget:strokeView}:{}),clearValue:clear,loadOp:'clear',storeOp:samples===4?'discard':'store'}]});
    strokePass.setBindGroup(0,lineGroup);
    if(mazeAlpha>0&&segmentCount){strokePass.setPipeline(strictGrid?gridPipelines[samples]:linePipelines[samples][0]);strokePass.draw(6,segmentCount);draws++;}
    if(textAlpha>0&&layout.data.length){
      const pitch=strictGrid?Math.fround(Math.fround(settings.wallWidth)+Math.fround(settings.pathGap)):settings.wallWidth+settings.pathGap;
      if(modern){
        const strokes=titleStrokes(layout,pitch,phase,settings),count=Math.min(200000,strokes.length/8);
        if(count){device.queue.writeBuffer(titleBuffer,0,strokes.subarray(0,count*8));strokePass.setBindGroup(0,titleGroup);strokePass.setPipeline(titlePipelines[samples]);strokePass.draw(6,count);draws++;}
      }else{
      strokePass.setPipeline(linePipelines[samples][1]);strokePass.draw(6,Math.ceil(width/pitch)+4);draws++;
      strokePass.setPipeline(linePipelines[samples][2]);strokePass.draw(6,Math.ceil(height/pitch)+4);draws++;
      }
    }strokePass.end();
    const compositePass=encoder.beginRenderPass({label:'Unlit final composition',colorAttachments:[{view:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
    compositePass.setPipeline(compositePipeline);compositePass.setBindGroup(0,compositeGroup);compositePass.draw(3);compositePass.end();draws++;
    device.queue.submit([encoder.finish()]);return {draws,passes:settings.preventOverlap?4:3,pixelRatio:dpr,renderSize:[canvas.width,canvas.height]};
  }
  return {resize,setFont,uploadSegments,render,viewport:()=>[viewWidth,viewHeight],errors};
}
