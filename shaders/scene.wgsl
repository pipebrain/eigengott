struct Frame {
  viewProjection:mat4x4f,
  right:vec4f,up:vec4f,back:vec4f,
  config:vec4f, // time, muted palette, depth stretch, slices per stack
  counts:vec4f, // environment stacks, characters, outline mask, slice flow
  art:vec4f, // white layer thickness, twist, shear, environment density
  camera:vec4f,
};
struct Stack {position:vec4f,shape:vec4f,motion:vec4f,identity:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> stacks:array<Stack>;
@group(0) @binding(2) var masks:texture_2d_array<f32>;
@group(0) @binding(3) var maskSampler:sampler;
struct VertexOut {
  @builtin(position) position:vec4f,
  @location(0) uv:vec2f,
  @location(1) @interpolate(flat) stack:u32,
  @location(2) @interpolate(flat) layer:u32,
};
const CORNERS=array<vec2f,6>(vec2f(-.5,-.5),vec2f(.5,-.5),vec2f(.5,.5),vec2f(-.5,-.5),vec2f(.5,.5),vec2f(-.5,.5));
fn place(local:vec2f,id:u32,layer:u32,slices:u32,uv:vec2f)->VertexOut {
  let s=stacks[id];
  let flow=sin(frame.config.x*.32+s.motion.w*11.0)*.22*frame.counts.w;
  let balance=select(0.0,(frame.art.x-.5)*2.0,(layer%2u)==1u);
  let u=clamp((f32(layer)+balance+select(flow,0.0,layer==0u))/max(f32(slices)-1,1),0.0,1.0);
  // Logarithmic distance distributes sheets densely at the front while
  // extending their edges toward the same far-away vanishing point.
  let depth=(exp(u*log(1+s.shape.z*.25))-1)/.25*frame.config.z;
  let angle=s.position.w+u*s.motion.z*frame.art.y;
  let c=cos(angle);let sn=sin(angle);
  let xy=vec2f(local.x*c-local.y*sn,local.x*sn+local.y*c)+s.motion.xy*u*frame.art.z;
  let frontBehindCamera=max(35.0,dot(frame.camera.xyz-s.position.xyz,frame.back.xyz)+10.0);
  let openFront=select(frontBehindCamera,0.0,s.shape.w==1.0);
  let world=s.position.xyz+frame.right.xyz*xy.x+frame.up.xyz*xy.y+frame.back.xyz*(openFront-depth);
  var out:VertexOut;
  out.position=frame.viewProjection*vec4f(world,1);out.uv=uv;out.stack=id;out.layer=layer;
  return out;
}
@vertex fn sliceVertex(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->VertexOut {
  let slices=u32(frame.config.w);
  let envSlices=slices*u32(frame.art.w);
  let envInstances=u32(frame.counts.x)*envSlices;
  var id:u32;var layer:u32;var count:u32;
  if(instance<envInstances){id=instance/envSlices;layer=instance%envSlices;count=envSlices;}
  else{let offset=instance-envInstances;id=u32(frame.counts.x)+offset/slices;layer=offset%slices;count=slices;}
  let corner=CORNERS[vertex];
  return place(corner*stacks[id].shape.xy,id,layer,count,vec2f(corner.x+.5,.5-corner.y));
}
@fragment fn fragmentMain(v:VertexOut)->@location(0) vec4f {
  let s=stacks[v.stack];
  var coverage=1.0;
  if(s.shape.w==1.0){
    let mask=textureSampleLevel(masks,maskSampler,v.uv,i32(s.identity.x),0.0);
    coverage=mix(mask.r,mask.g,frame.counts.z);
    if(coverage<.03){discard;}
  }
  // Opaque black sheets occlude white sheets behind them. The separation is
  // physical perspective, not painted stripes or a screen-space filter.
  let white=select(0.0,1.0,(v.layer%2u)==0u);
  var color=vec3f(white);
  if(frame.config.y>.5){
    let seed=s.motion.w;
    let olive=vec3f(.68,.71,.59);let brown=vec3f(.72,.65,.54);let violet=vec3f(.65,.63,.68);
    let tint=mix(mix(olive,brown,fract(seed*5.0)),violet,step(.7,seed)*.6);
    color=tint*white;
  }
  return vec4f(color,coverage);
}
