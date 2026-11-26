struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
struct Glyph{bounds:vec4f,transform:vec4f,effects:vec4f};
struct Stroke{ends:vec4f,info:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> glyphs:array<Glyph>;
@group(0) @binding(2) var atlas:texture_2d_array<f32>;
@group(0) @binding(3) var atlasSampler:sampler;
@group(0) @binding(4) var<storage,read> strokes:array<Stroke>;
@group(0) @binding(5) var owners:texture_2d<u32>;
const CORNERS=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));
struct Out{@builtin(position) position:vec4f,@location(0) uv:vec2f,@location(1) @interpolate(flat) id:u32};
@vertex fn vertexMain(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->Out{
  let stroke=strokes[instance];let id=u32(stroke.info.x);let glyph=glyphs[id];let corner=CORNERS[vertex];
  let a=stroke.ends.xy+glyph.bounds.xy;let b=stroke.ends.zw+glyph.bounds.xy;
  let d=normalize(b-a);let n=vec2f(-d.y,d.x);
  let p=mix(a,b,corner.x*.5+.5)+(n*corner.y+d*corner.x)*frame.style.x*.5;
  var out:Out;out.position=vec4f(p.x/frame.viewport.x*2-1,1-p.y/frame.viewport.y*2,0,1);
  out.uv=(p-glyph.bounds.xy)/glyph.bounds.zw+vec2f(.5);out.id=id;return out;
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
  let glyph=glyphs[v.id];let uv=clamp(v.uv,vec2f(0),vec2f(1));
  let rg=textureSampleLevel(atlas,atlasSampler,uv,i32(glyph.transform.z),0).rg;
  let distance=(rg.x*65280+rg.y*255)/65535*512-256+length((v.uv-uv)*512);
  let gradient=max(length(vec2f(dpdx(distance),dpdy(distance))),.001)*frame.viewport.z;
  let fill=(1-smoothstep(-.5,.5,distance/gradient))*glyph.effects.y;
  if(textureLoad(owners,vec2i(v.position.xy),0).r!=65536u+v.id){discard;}
  return vec4f(0,fill,0,fill);
}
