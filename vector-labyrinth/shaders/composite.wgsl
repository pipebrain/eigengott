struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var strokes:texture_2d<f32>;
@group(0) @binding(2) var glyphMask:texture_2d<f32>;
@group(0) @binding(3) var linearSampler:sampler;
struct Out{@builtin(position) position:vec4f,@location(0) uv:vec2f};
@vertex fn vertexMain(@builtin(vertex_index) id:u32)->Out{
  let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:Out;
  o.position=vec4f(p[id],0,1);o.uv=vec2f(p[id].x*.5+.5,.5-p[id].y*.5);return o;
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
  var ink=textureSample(strokes,linearSampler,v.uv).rgb;
  var mask=textureSample(glyphMask,linearSampler,v.uv).rgb;
  if(frame.color.z>0){ink=textureLoad(strokes,vec2i(v.position.xy),0).rgb;mask=textureLoad(glyphMask,vec2i(v.position.xy),0).rgb;}
  let maze=ink.r*frame.style.z*(1-mask.g*frame.style.w);
  let text=select(max(ink.g*mask.r,ink.b*mask.b),ink.g,frame.color.w>.5)*frame.style.w;
  let coverage=text+maze*(1-text);
  let background=vec3f(frame.phase.z,frame.phase.w,frame.color.x);
  return vec4f(mix(background,vec3f(1),coverage),1);
}
