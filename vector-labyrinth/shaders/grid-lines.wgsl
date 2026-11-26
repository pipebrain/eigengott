// Exact axis-aligned wall rectangles. Coverage is integrated over each device
// pixel, rather than allowing MSAA sample phase to change apparent bar width.
struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> lines:array<vec4f>;
const CORNERS=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(1,1),vec2f(0,0),vec2f(1,1),vec2f(0,1));
struct Out{@builtin(position) position:vec4f,@location(0) @interpolate(flat) rect:vec4f};
@vertex fn vertexMain(@builtin(vertex_index) vertex:u32,@builtin(instance_index) id:u32)->Out{
  let line=lines[id];let half=vec2f(frame.style.x*.5);let lo=min(line.xy,line.zw)-half;let hi=max(line.xy,line.zw)+half;
  let pixel=1/vec2f(frame.viewport.z,abs(frame.viewport.w));let point=mix(lo-pixel,hi+pixel,CORNERS[vertex]);
  var out:Out;out.position=vec4f(point.x/frame.viewport.x*2-1,1-point.y/frame.viewport.y*2,0,1);out.rect=vec4f(lo,hi);return out;
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
  let scale=vec2f(frame.viewport.z,abs(frame.viewport.w));let pixel=1/scale;let center=v.position.xy/scale;
  let overlap=clamp(min(center+pixel*.5,v.rect.zw)-max(center-pixel*.5,v.rect.xy),vec2f(0),pixel)/pixel;
  var coverage=overlap.x*overlap.y;
  if(frame.viewport.w<0){coverage=select(0.0,1.0,all(center>=v.rect.xy)&&all(center<v.rect.zw));}
  return vec4f(coverage,0,0,1);
}
