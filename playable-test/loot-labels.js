import {titleAtlas} from './title-font.js';
export function layoutLootLabels(views,width,height,glyphs){
 const labels=[],pad=8,clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 for(const a of views){
  const text=a.label.toUpperCase().replace(/[^A-Z0-9 ]/g,' '),measure=h=>[...text].reduce((s,c)=>s+(c===' '?h*.2:(glyphs.get(c)?.aspect||.32)*h+2),0);
  let fontHeight=Math.max(18,Math.min(28,height*.04));if(measure(fontHeight)>width-pad*2)fontHeight*= (width-pad*2)/measure(fontHeight);
  const w=measure(fontHeight),h=fontHeight,phase=a.labelPhase||0,cx=(a.x+a.w/2)*width,cy=(a.y+a.h/2)*height;
  const px=clamp(cx-w/2+Math.sin(phase)*32,pad,width-w-pad),py=clamp(cy-a.h*height/2-h-12+Math.cos(phase*.83)*26,pad,height-h-pad);
  const xs=[px,pad,width-w-pad],ys=[py,pad,height-h-pad];for(const b of labels){xs.push(b.x-w-pad,b.x+b.width+pad);ys.push(b.y-h-pad,b.y+b.height+pad);}
  let best=null,cost=Infinity;for(const xx of xs)for(const yy of ys){const x=Math.round(clamp(xx,pad,width-w-pad)),y=Math.round(clamp(yy,pad,height-h-pad));if(labels.some(b=>x<b.x+b.width+pad&&x+w+pad>b.x&&y<b.y+b.height+pad&&y+h+pad>b.y))continue;const d=(x-px)**2+(y-py)**2;if(d<cost){cost=d;best={x,y};}}
  if(!best)throw new Error('No screen space for loot labels');labels.push({id:a.id,text,x:best.x,y:best.y,width:w,height:h});
 }return labels;
}
// Corners and leaders are integer, axis-aligned rectangles exactly one output pixel thick.
export function labelGeometry(views,width,height,glyphs){
 const v=[],segments=[],labels=layoutLootLabels(views,width,height,glyphs);const quad=(x,y,w,h,u=-1,t=-1,uw=0,vh=0)=>{for(const [a,b]of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]])v.push(x+a*w,y+b*h,u<0?-1:u+a*uw,t+b*vh);};
 const line=(x,y,x2,y2)=>{x=Math.round(x);y=Math.round(y);x2=Math.round(x2);y2=Math.round(y2);if(x===x2){quad(x,y<y2?y:y2,1,Math.max(1,Math.abs(y2-y)));}else{y2=y;quad(Math.min(x,x2),y,Math.max(1,Math.abs(x2-x)),1);}segments.push([x,y,x2,y2]);};
 for(const [i,a] of views.entries()){const x=Math.round(a.x*width),y=Math.round(a.y*height),w=Math.round(a.w*width),h=Math.round(a.h*height),k=Math.min(15,w*.1,h*.1);for(const [xx,yy,dx,dy]of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){line(xx,yy,xx+dx*k,yy);line(xx,yy,xx,yy+dy*k);}
  const l=labels[i],{text,x:tx,y:ty,height:fontHeight}=l,ex=Math.round(x+w*.55),ey=ty+fontHeight/2>y+h/2?y+h:y,ly=Math.round(ty+fontHeight/2),lx=Math.round(Math.max(tx,Math.min(tx+l.width,ex)));line(ex,ey,ex,ly);line(ex,ly,lx,ly);l.leader=[[ex,ey,ex,ly],[ex,ly,lx,ly]];
  let at=tx;for(const c of text){if(c===' '){at+=fontHeight*.2;continue;}const g=glyphs.get(c);if(!g)continue;const gw=fontHeight*g.aspect;quad(at,ty,gw,fontHeight,g.u,g.v,g.w,g.h);at+=gw+2;}
 }return {vertices:new Float32Array(v),segments,labels};
}
export async function createLootLabels(device,format){
 const {canvas,glyphs}=titleAtlas(),texture=device.createTexture({label:'Title glyph masks',size:[512,1024],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT});device.queue.copyExternalImageToTexture({source:canvas},{texture},[512,1024]);
 const module=device.createShaderModule({code:`@group(0) @binding(0) var<uniform> size:vec4f;@group(0) @binding(1) var mask:texture_2d<f32>;@group(0) @binding(2) var samp:sampler;struct V{@builtin(position) p:vec4f,@location(0) uv:vec2f};@vertex fn v(@location(0) p:vec2f,@location(1) uv:vec2f)->V{var o:V;o.p=vec4f(p/size.xy*vec2f(2,-2)+vec2f(-1,1),0,1);o.uv=uv;return o;}@fragment fn f(i:V)->@location(0) vec4f{let alpha=textureSample(mask,samp,max(vec2f(0),i.uv)).a;let a=select(alpha,1.0,i.uv.x<0.0);if a<.1{discard;}return vec4f(vec3f(a),a);}`});
 const pipeline=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'v',buffers:[{arrayStride:16,attributes:[{shaderLocation:0,offset:0,format:'float32x2'},{shaderLocation:1,offset:8,format:'float32x2'}]}]},fragment:{module,entryPoint:'f',targets:[{format,blend:{color:{srcFactor:'one',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},depthStencil:{format:'depth24plus',depthWriteEnabled:false,depthCompare:'always'}}),buffer=device.createBuffer({size:262144,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST}),size=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:size}},{binding:1,resource:texture.createView()},{binding:2,resource:device.createSampler({minFilter:'linear',magFilter:'linear'})}]});let geometry={segments:[],labels:[]};
 return {draw(pass,views,w,h){geometry=labelGeometry(views,w,h,glyphs);if(geometry.vertices.byteLength>buffer.size)throw new Error('Loot label capacity exceeded');if(!geometry.vertices.length)return;device.queue.writeBuffer(buffer,0,geometry.vertices);device.queue.writeBuffer(size,0,new Float32Array([w,h,0,0]));pass.setViewport(0,0,w,h,0,1);pass.setScissorRect(0,0,w,h);pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.setVertexBuffer(0,buffer);pass.draw(geometry.vertices.length/4);},snapshot:()=>({segments:geometry.segments,labels:geometry.labels,lineWidth:1,font:'title-gothic',gpuBytes:512*1024*4+262144+16}),destroy(){buffer.destroy();size.destroy();texture.destroy();}};
}
