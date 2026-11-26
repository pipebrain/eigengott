struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
struct Glyph{bounds:vec4f,transform:vec4f,effects:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> glyphs:array<Glyph>;
@group(0) @binding(2) var atlas:texture_2d_array<f32>;
@group(0) @binding(3) var atlasSampler:sampler;
@group(0) @binding(4) var<storage,read> order:array<u32>;
const CORNERS=array<vec2f,6>(vec2f(-.5,-.5),vec2f(.5,-.5),vec2f(.5,.5),vec2f(-.5,-.5),vec2f(.5,.5),vec2f(-.5,.5));
struct Out{@builtin(position) position:vec4f,@location(0) uv:vec2f,@location(1) @interpolate(flat) id:u32};
@vertex fn vertexMain(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->Out{
  let id=order[instance];let glyph=glyphs[id];let corner=CORNERS[vertex];
  let expanded=glyph.bounds.zw+vec2f(glyph.effects.x*2);let local=corner*expanded;
  var out:Out;let screen=glyph.bounds.xy+local;
  out.position=vec4f(screen.x/frame.viewport.x*2-1,1-screen.y/frame.viewport.y*2,0,1);
  out.uv=corner*expanded/glyph.bounds.zw+vec2f(.5);out.id=id;return out;
}
struct Masks{@location(0) clearance:f32,@location(1) owner:u32};
@fragment fn fragmentMain(v:Out)->Masks{
  let glyph=glyphs[v.id];let uv=clamp(v.uv,vec2f(0),vec2f(1));
  let rg=textureSampleLevel(atlas,atlasSampler,uv,i32(glyph.transform.z),0).rg;
  let distance=(rg.x*65280+rg.y*255)/65535*512-256+length((v.uv-uv)*512);
  let gradient=max(length(vec2f(dpdx(distance),dpdy(distance))),.001)*frame.viewport.z;
  let cssDistance=distance/gradient;
  let expanded=(1-smoothstep(glyph.effects.x-.5,glyph.effects.x+.5,cssDistance))*glyph.effects.y;
  if(cssDistance>glyph.effects.x+.5){discard;}
  var out:Masks;out.clearance=expanded;out.owner=65536u+v.id;return out;
}
