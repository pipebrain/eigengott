import {buildScene} from './scene.js';
import {createMasks,MASK_WIDTH,MASK_HEIGHT} from './masks.js';

const canvas=document.querySelector('#scene'),controls=document.querySelector('#controls'),status=document.querySelector('#status');
const defaults={text:'EIGENGOTT',font:'block',palette:'bw',outline:false,slices:192,envDensity:6,depth:1.35,lineWidth:.45,separation:.85,drift:.7,speed:.7,repulsion:.65,twist:1,shear:1,hold:false,cameraX:0,cameraY:0,cameraZ:0,yaw:0,pitch:0,fov:68};
const cameraKeys=['cameraX','cameraY','cameraZ','yaw','pitch','fov'];
const storageKey='eigengott-slices-v2';
let settings={...defaults},onSetting=()=>{},fontGeneration=0,customFont=null;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
try {
  const stored=JSON.parse(localStorage.getItem(storageKey)||'{}');
  for(const key of Object.keys(defaults)) {
    if(cameraKeys.includes(key)) continue; // Every fresh visit starts at the fixed front view.
    const input=document.getElementById(key),value=stored[key];
    if(input.type==='range' && Number.isFinite(value)) {
      const step=+input.step;
      settings[key]=clamp(Math.round((value-(+input.min))/step)*step+(+input.min),+input.min,+input.max);
    } else if(input.type==='checkbox' && typeof value==='boolean') settings[key]=value;
    else if(key==='text' && typeof value==='string') settings.text=Array.from(value).slice(0,24).join('');
    else if(key==='font' && ['block','mono','sans'].includes(value)) settings.font=value;
    else if(key==='palette' && ['bw','muted'].includes(value)) settings.palette=value;
  }
} catch { /* Persistence is optional. */ }
function save() {
  try {
    const value={...settings,font:settings.font==='custom'?'block':settings.font};
    for(const key of cameraKeys) delete value[key];
    localStorage.setItem(storageKey,JSON.stringify(value));
  } catch { /* Storage may be disabled. */ }
}
function syncControls() {
  for(const key of Object.keys(defaults)) {
    const input=document.getElementById(key);
    if(input.type==='checkbox') input.checked=settings[key];
    else input.value=settings[key];
    const out=document.getElementById(`${key}-value`);
    if(out) out.value=key==='slices'?settings[key]:key==='envDensity'?`${settings[key]}×`:key==='fov'?`${settings[key]}°`:settings[key].toFixed(2);
  }
}
syncControls();
for(const key of Object.keys(defaults)) document.getElementById(key).addEventListener('input',event=>{
  const input=event.target;
  settings[key]=input.type==='range'?+input.value:input.type==='checkbox'?input.checked:input.value;
  if(key==='text') settings.text=Array.from(settings.text).slice(0,24).join('');
  syncControls();save();onSetting(key);
});
const resetCamera=()=>{for(const key of cameraKeys) settings[key]=defaults[key];syncControls();};
document.querySelector('#camera-reset').onclick=resetCamera;
function toggleControls(){controls.hidden=!controls.hidden;canvas.style.cursor=controls.hidden?'default':'grab';}
document.querySelector('#close').onclick=()=>{controls.hidden=true;canvas.style.cursor='default';};
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){controls.hidden=true;canvas.style.cursor='default';return;}
  const tag=event.target.tagName;
  if(event.repeat||/SELECT|TEXTAREA/.test(tag)||(tag==='INPUT'&&!['range','checkbox'].includes(event.target.type)))return;
  const key=event.key.toLowerCase();
  if(key==='h'||key==='`'){toggleControls();event.preventDefault();}
  if(key==='r'&&!controls.hidden)resetCamera();
  if(key==='f'){
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    else canvas.requestFullscreen?.().catch(()=>{});
  }
});
canvas.addEventListener('touchstart',e=>{if(e.touches.length===3){e.preventDefault();toggleControls();}},{passive:false});
let dragging=null;
canvas.addEventListener('pointerdown',e=>{
  if(controls.hidden||e.button!==0)return;
  dragging={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
});
canvas.addEventListener('pointermove',e=>{
  if(controls.hidden){dragging=null;return;}
  if(!dragging)return;
  const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;dragging={x:e.clientX,y:e.clientY};
  if(e.shiftKey){settings.yaw=clamp(settings.yaw-dx*.12,-40,40);settings.pitch=clamp(settings.pitch+dy*.12,-35,35);}
  else{const speed=.018*(1+settings.cameraZ*.04);settings.cameraX=clamp(settings.cameraX-dx*speed,-20,20);settings.cameraY=clamp(settings.cameraY+dy*speed,-15,15);}
  syncControls();
});
canvas.addEventListener('pointerup',()=>{dragging=null;canvas.style.cursor=controls.hidden?'default':'grab';});
canvas.addEventListener('pointercancel',()=>{dragging=null;});
canvas.addEventListener('wheel',e=>{if(controls.hidden)return;e.preventDefault();settings.cameraZ=clamp(settings.cameraZ+e.deltaY*.012,-5,30);syncControls();},{passive:false});

function multiply(a,b){
  const o=new Float32Array(16);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)o[col*4+row]+=a[k*4+row]*b[col*4+k];
  return o;
}
function perspective(fov,aspect,near,far){
  const f=1/Math.tan(fov/2),o=new Float32Array(16);
  o[0]=f/aspect;o[5]=f;o[10]=far/(near-far);o[11]=-1;o[14]=far*near/(near-far);return o;
}
function cameraFrame(aspect){
  const yaw=settings.yaw*Math.PI/180,pitch=settings.pitch*Math.PI/180;
  const right=[Math.cos(yaw),0,-Math.sin(yaw)];
  const up=[Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)];
  const back=[Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  const home=Math.max(10,17.5/.79/aspect)*.5/Math.tan(defaults.fov*Math.PI/360);
  const eye=[settings.cameraX,settings.cameraY,Math.max(1.2,home+settings.cameraZ)];
  const dot=v=>v.reduce((s,x,i)=>s+x*eye[i],0);
  const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-dot(right),-dot(up),-dot(back),1]);
  return {eye,right,up,back,matrix:multiply(perspective(settings.fov*Math.PI/180,aspect,.08,2600),view)};
}
async function fetchOK(path){const r=await fetch(path);if(!r.ok)throw new Error(`Could not load ${path} (${r.status}).`);return r;}
function fail(message){status.replaceChildren();const p=document.createElement('p');p.textContent=message;status.append(p);status.hidden=false;}

async function init(){
  if(!navigator.gpu)throw new Error('This study needs WebGPU. Open this localhost page in a current browser with WebGPU and hardware acceleration enabled.');
  const [adapter,wasmResponse,shaderResponse]=await Promise.all([
    navigator.gpu.requestAdapter({powerPreference:'high-performance'}),fetchOK('motion.wasm'),fetchOK('shaders/scene.wgsl'),
  ]);
  if(!adapter)throw new Error('A WebGPU adapter is unavailable. Enable hardware acceleration and reopen this page.');
  const device=await adapter.requestDevice(),errors=[];
  let running=true;
  device.addEventListener('uncapturederror',event=>{running=false;errors.push(event.error.message);console.error(event.error);fail(`WebGPU: ${event.error.message}`);});
  device.lost.then(info=>{running=false;if(info.reason!=='destroyed')fail('The graphics device disconnected. Reload to rebuild the scene.');});
  const wasm=await WebAssembly.instantiate(await wasmResponse.arrayBuffer(),{env:{sin:Math.sin,cos:Math.cos}}),sim=wasm.instance.exports;
  const context=canvas.getContext('webgpu');
  if(!context)throw new Error('The browser could not create a WebGPU canvas.');
  const format=navigator.gpu.getPreferredCanvasFormat();context.configure({device,format,alphaMode:'opaque'});
  const module=device.createShaderModule({label:'Instanced flat slices / unlit',code:await shaderResponse.text()});
  const info=await module.getCompilationInfo(),failures=info.messages.filter(x=>x.type==='error');
  if(failures.length)throw new Error(failures.map(x=>`Shader line ${x.lineNum}: ${x.message}`).join('\n'));
  const layout=device.createBindGroupLayout({entries:[
    {binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}},
    {binding:1,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:'read-only-storage'}},
    {binding:2,visibility:GPUShaderStage.FRAGMENT,texture:{viewDimension:'2d-array'}},
    {binding:3,visibility:GPUShaderStage.FRAGMENT,sampler:{type:'filtering'}},
  ]});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
  const makePipeline=entryPoint=>device.createRenderPipelineAsync({label:entryPoint,layout:pipelineLayout,
    vertex:{module,entryPoint},fragment:{module,entryPoint:'fragmentMain',targets:[{format}]},
    primitive:{topology:'triangle-list',cullMode:'none'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'},
    multisample:{count:4,alphaToCoverageEnabled:true},
  });
  const pipeline=await makePipeline('sliceVertex');
  const stackBuffer=device.createBuffer({label:'WASM stack descriptors',size:96*64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const uniformBuffer=device.createBuffer({label:'Camera and slice controls',size:176,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  const uniforms=new Float32Array(44);
  const sampler=device.createSampler({minFilter:'linear',magFilter:'linear',addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge'});
  let maskTexture,group,geometry,stackData,maskBuilds=0,rebuildTimer;
  const params=new URLSearchParams(location.search);
  let time=clamp(Number(params.get('time'))||0,0,26),paused=params.has('paused');
  const snapshot={ready:false,renderer:'WebGPU',motion:'WebAssembly',lighting:false,shadows:false,renderPasses:1,drawCalls:1,errors,geometry:null,text:settings.text,font:settings.font,palette:settings.palette,maskBuilds:0};
  Object.defineProperty(window,'__EIGENGOTT',{value:snapshot,writable:false});
  function rebuild(){
    clearTimeout(rebuildTimer);
    const masks=createMasks(settings.text,settings.font);
    const next=device.createTexture({label:'Live character masks / filled + contour',size:[MASK_WIDTH,MASK_HEIGHT,Math.max(1,masks.layers.length)],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
    masks.layers.forEach((data,layer)=>device.queue.writeTexture({texture:next,origin:[0,0,layer]},data,{bytesPerRow:MASK_WIDTH*4,rowsPerImage:MASK_HEIGHT},[MASK_WIDTH,MASK_HEIGHT,1]));
    const nextGroup=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:uniformBuffer}},{binding:1,resource:{buffer:stackBuffer}},{binding:2,resource:next.createView({dimension:'2d-array'})},{binding:3,resource:sampler}]});
    geometry=buildScene(sim,masks.glyphs);
    stackData=new Float32Array(sim.memory.buffer,sim.get_buffer(),geometry.count*16);
    sim.update(0,settings.separation,settings.drift,settings.hold?1:0,settings.repulsion);
    if(time>0)for(let t=Math.max(0,time-1.5);t<=time;t+=1/60)sim.update(t,settings.separation,settings.drift,settings.hold?1:0,settings.repulsion);
    const previous=maskTexture;maskTexture=next;group=nextGroup;previous?.destroy();
    maskBuilds++;Object.assign(snapshot,{geometry,text:settings.text,font:settings.font,maskBuilds});
    canvas.setAttribute('aria-label',`${settings.text||'Untitled'}. Animated stacks of flat character slices.`);
  }
  rebuild();
  onSetting=key=>{if(key==='text'||key==='font'){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>{try{rebuild();}catch(e){errors.push(e.message);fail(e.message);}},100);}};
  document.querySelector('#font-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    const generation=++fontGeneration,label=document.querySelector('#font-status');
    label.textContent='Loading font…';
    try {
      const face=new FontFace('EIGENGOTTCustom',await file.arrayBuffer(),{weight:'900'});await face.load();
      if(generation!==fontGeneration)return;
      if(customFont)document.fonts.delete(customFont);customFont=face;document.fonts.add(face);
      document.querySelector('#font option[value=custom]').disabled=false;
      settings.font='custom';syncControls();save();rebuild();
      label.textContent=`${file.name} · loaded for this session`;
    }catch(error){if(generation===fontGeneration)label.textContent='This font could not be loaded. Choose a supported TTF, OTF, WOFF or WOFF2 file.';}
  });
  const syncPause=()=>{document.querySelector('#pause').textContent=paused?'Resume':'Pause';};syncPause();
  document.querySelector('#pause').onclick=()=>{paused=!paused;syncPause();};
  document.querySelector('#reform').onclick=()=>{time=0;sim.reassemble();};
  document.querySelector('#reset').onclick=()=>{
    settings={...defaults};time=0;paused=false;syncControls();syncPause();save();rebuild();
  };
  let targets=[],msaaView,depthView;
  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    let w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    const scale=Math.min(1,Math.min(device.limits.maxTextureDimension2D,3000)/Math.max(w,h));w=Math.max(1,Math.floor(w*scale));h=Math.max(1,Math.floor(h*scale));
    if(w===canvas.width&&h===canvas.height&&targets.length)return;
    canvas.width=w;canvas.height=h;targets.forEach(t=>t.destroy());
    const color=device.createTexture({label:'Antialiased flat slices',size:[w,h],format,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT});
    const depth=device.createTexture({label:'Occlusion only / no shadows',size:[w,h],format:'depth24plus',sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT});
    targets=[color,depth];msaaView=color.createView();depthView=depth.createView();
  }
  let last=performance.now(),fpsLast=last,frames=0,fps=0;
  function render(now){
    if(!running)return;
    try {
      const dt=Math.min((now-last)/1000,.05);last=now;
      if(!paused&&!document.hidden)time+=dt*settings.speed;
      resize();
      sim.update(time,settings.separation,settings.drift,settings.hold?1:0,settings.repulsion);
      const camera=cameraFrame(canvas.width/canvas.height);
      uniforms.set(camera.matrix,0);uniforms.set([...camera.right,0],16);uniforms.set([...camera.up,0],20);uniforms.set([...camera.back,0],24);
      uniforms.set([time,settings.palette==='muted'?1:0,settings.depth,settings.slices],28);
      uniforms.set([geometry.environmentCount,geometry.characterCount,settings.outline?1:0,1],32);
      uniforms.set([settings.lineWidth,settings.twist,settings.shear,settings.envDensity],36);
      uniforms.set([...camera.eye,1],40);
      device.queue.writeBuffer(uniformBuffer,0,uniforms);device.queue.writeBuffer(stackBuffer,0,stackData);
      const encoder=device.createCommandEncoder({label:'Single unlit slice pass'});
      const pass=encoder.beginRenderPass({colorAttachments:[{view:msaaView,resolveTarget:context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'discard',clearValue:{r:0,g:0,b:0,a:1}}],depthStencilAttachment:{view:depthView,depthLoadOp:'clear',depthStoreOp:'discard',depthClearValue:1}});
      pass.setBindGroup(0,group);
      const flatLayers=(geometry.environmentCount*settings.envDensity+geometry.characterCount)*settings.slices;
      pass.setPipeline(pipeline);pass.draw(6,flatLayers);pass.end();
      device.queue.submit([encoder.finish()]);
      frames++;
      if(now-fpsLast>1000){fps=Math.round(frames*1000/(now-fpsLast));frames=0;fpsLast=now;document.querySelector('#telemetry').textContent=`${fps} fps · ${flatLayers.toLocaleString()} flat layers · unlit`;}
      Object.assign(snapshot,{ready:true,time,paused,separation:sim.get_separation(),camera:camera.eye,cameraRight:camera.right,cameraUp:camera.up,cameraBack:camera.back,palette:settings.palette,slices:settings.slices,flatLayers,fps,maskBuilds});
      status.hidden=true;requestAnimationFrame(render);
    }catch(error){running=false;errors.push(error.message);console.error(error);fail(error.message);}
  }
  document.addEventListener('visibilitychange',()=>{last=performance.now();});
  requestAnimationFrame(render);
}
init().catch(error=>{console.error(error);fail(error.message);});
