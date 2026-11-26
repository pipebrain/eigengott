struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var strokes:texture_2d<f32>;
@group(0) @binding(2) var clearance:texture_2d<f32>;
@group(0) @binding(3) var linearSampler:sampler;
struct Out{@builtin(position) position:vec4f,@location(0) uv:vec2f};
@vertex fn vertexMain(@builtin(vertex_index) id:u32)->Out{
  let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:Out;
  o.position=vec4f(p[id],0,1);o.uv=vec2f(p[id].x*.5+.5,.5-p[id].y*.5);return o;
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
  let ink=textureSample(strokes,linearSampler,v.uv).rg;
  let mask=textureSample(clearance,linearSampler,v.uv).r;
  let maze=ink.r*frame.style.z*(1-mask);let text=ink.g;
  let coverage=text+maze*(1-text);
  return vec4f(vec3f(coverage),1);
}
