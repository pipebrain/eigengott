struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> lines:array<vec4f>;
@group(0) @binding(2) var<storage,read> lineOwners:array<u32>;
@group(0) @binding(3) var owners:texture_2d<u32>;
const CORNERS=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
struct Out{@builtin(position) position:vec4f,@location(0) @interpolate(flat) channel:u32,@location(1) @interpolate(flat) owner:u32};
fn lineVertex(vertex:u32,p1:vec2f,p2:vec2f,channel:u32)->Out{
  let corner=CORNERS[vertex];let direction=normalize(p2-p1);let normal=vec2f(-direction.y,direction.x);
  let point=mix(p1,p2,corner.x*.5+.5)+(normal*corner.y+direction*corner.x)*frame.style.x*.5;
  var out:Out;out.position=vec4f(point.x/frame.viewport.x*2-1,1-point.y/frame.viewport.y*2,0,1);out.channel=channel;out.owner=0u;return out;
}
@vertex fn mazeVertex(@builtin(vertex_index) vertex:u32,@builtin(instance_index) id:u32)->Out{
  let line=lines[id];var out=lineVertex(vertex,line.xy,line.zw,0u);out.owner=lineOwners[id];return out;
}
@vertex fn textVertical(@builtin(vertex_index) vertex:u32,@builtin(instance_index) id:u32)->Out{
  let x=f32(id)*(frame.style.x+frame.style.y)+frame.phase.x;
  return lineVertex(vertex,vec2f(x,-10),vec2f(x,frame.viewport.y+10),1u);
}
@vertex fn textHorizontal(@builtin(vertex_index) vertex:u32,@builtin(instance_index) id:u32)->Out{
  let y=f32(id)*(frame.style.x+frame.style.y)+frame.phase.y;
  return lineVertex(vertex,vec2f(-10,y),vec2f(frame.viewport.x+10,y),2u);
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
  if(frame.color.y>.5&&v.channel==0u&&textureLoad(owners,vec2i(v.position.xy),0).r!=v.owner){discard;}
  return vec4f(select(0.0,1.0,v.channel==0u),select(0.0,1.0,v.channel==1u),select(0.0,1.0,v.channel==2u),1);
}
