struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> lines:array<vec4f>;
@group(0) @binding(2) var owners:texture_2d<u32>;
const CORNERS=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
@vertex fn vertexMain(@builtin(vertex_index) vertex:u32,@builtin(instance_index) id:u32)->@builtin(position) vec4f{
  let line=lines[id];let corner=CORNERS[vertex];let direction=normalize(line.zw-line.xy);let normal=vec2f(-direction.y,direction.x);
  let point=mix(line.xy,line.zw,corner.x*.5+.5)+(normal*corner.y+direction*corner.x)*frame.style.x*.5;
  return vec4f(point.x/frame.viewport.x*2-1,1-point.y/frame.viewport.y*2,0,1);
}
@fragment fn fragmentMain(@builtin(position) position:vec4f)->@location(0) vec4f{
  if(textureLoad(owners,vec2i(position.xy),0).r!=0u){discard;}
  return vec4f(1,0,0,1);
}
