struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
struct Glyph{bounds:vec4f,transform:vec4f,effects:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> glyphs:array<Glyph>;
@group(0) @binding(2) var atlas:texture_2d_array<f32>;
@group(0) @binding(3) var atlasSampler:sampler;
const CORNERS=array<vec2f,6>(vec2f(-.5,-.5),vec2f(.5,-.5),vec2f(.5,.5),vec2f(-.5,-.5),vec2f(.5,.5),vec2f(-.5,.5));
struct Out{@builtin(position) position:vec4f,@location(0) uv:vec2f,@location(1) @interpolate(flat) id:u32};
@vertex fn vertexMain(@builtin(vertex_index) vertex:u32,@builtin(instance_index) id:u32)->Out{
  let glyph=glyphs[id];let corner=CORNERS[vertex];
  let expanded=glyph.bounds.zw+vec2f(glyph.effects.x*2);
  let local=corner*expanded;
  let c=glyph.transform.x;let s=glyph.transform.y;
  let screen=glyph.bounds.xy+vec2f(local.x*c-local.y*s,local.x*s+local.y*c);
  var out:Out;out.position=vec4f(screen.x/frame.viewport.x*2-1,1-screen.y/frame.viewport.y*2,0,1);
  out.uv=corner*expanded/glyph.bounds.zw+vec2f(.5);out.id=id;return out;
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
  let glyph=glyphs[v.id];let uv=clamp(v.uv,vec2f(0),vec2f(1));
  let rg=textureSampleLevel(atlas,atlasSampler,uv,i32(glyph.transform.z),0).rg;
  let raw=(rg.x*65280+rg.y*255)/65535*512-256;
  let distance=raw+length((v.uv-uv)*512);
  let gradient=max(length(vec2f(dpdx(distance),dpdy(distance))),.001)*frame.viewport.z;
  let cssDistance=distance/gradient;
  let fill=(1-smoothstep(-.5,.5,cssDistance))*glyph.effects.y;
  let expanded=(1-smoothstep(glyph.effects.x-.5,glyph.effects.x+.5,cssDistance))*glyph.effects.y;
  return vec4f(select(fill,0.0,glyph.transform.w>.5),expanded,select(0.0,fill,glyph.transform.w>.5),fill);
}
