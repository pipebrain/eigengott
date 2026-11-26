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
struct Out{@builtin(position) position:vec4f,@location(0) uv:vec2f,@location(1) @interpolate(flat) id:u32,@location(2) @interpolate(flat) rect:vec4f,@location(3) @interpolate(flat) analytic:u32,@location(4) @interpolate(flat) lineInfo:vec4f};
@vertex fn vertexMain(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->Out{
  let stroke=strokes[instance];let id=u32(stroke.info.x);let glyph=glyphs[id];let corner=CORNERS[vertex];
  let d=normalize(stroke.ends.zw-stroke.ends.xy);let n=vec2f(-d.y,d.x);
  let analytic=frame.color.z>0;
  let extra=select(0.0,max(1/frame.viewport.z,1/abs(frame.viewport.w)),analytic);
  let p=mix(stroke.ends.xy,stroke.ends.zw,corner.x*.5+.5)+(n*corner.y+d*corner.x)*(frame.style.x*.5+extra);
  let local=p-glyph.bounds.xy;let c=glyph.transform.x;let s=glyph.transform.y;
  var o:Out;o.position=vec4f(p.x/frame.viewport.x*2-1,1-p.y/frame.viewport.y*2,0,1);
  o.uv=vec2f(local.x*c+local.y*s,-local.x*s+local.y*c)/glyph.bounds.zw+vec2f(.5);o.id=id;o.rect=vec4f(min(stroke.ends.xy,stroke.ends.zw)-vec2f(frame.style.x*.5),max(stroke.ends.xy,stroke.ends.zw)+vec2f(frame.style.x*.5));o.lineInfo=vec4f(n,dot(stroke.ends.xy,n),frame.style.x*.5);o.analytic=select(0u,1u,analytic);return o;
}
fn boxCDF(value:f32,a:f32,b:f32)->f32{
  if(value<=-a-b){return 0;}if(value>=a+b){return 1;}
  if(a<.000001){return clamp((value+b)/(2*b),0,1);}if(b<.000001){return clamp((value+a)/(2*a),0,1);}
  let z=value+a+b;let p=max(z-2*a,0.0);let q=max(z-2*b,0.0);let r=max(z-2*a-2*b,0.0);
  return clamp((z*z-p*p-q*q+r*r)/(8*a*b),0,1);
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
  let glyph=glyphs[v.id];let uv=clamp(v.uv,vec2f(0),vec2f(1));
  let rg=textureSampleLevel(atlas,atlasSampler,uv,i32(glyph.transform.z),0).rg;
  let distance=(rg.x*65280+rg.y*255)/65535*512-256+length((v.uv-uv)*512);
  let gradient=max(length(vec2f(dpdx(distance),dpdy(distance))),.001)*frame.viewport.z;
  var fill=(1-smoothstep(-.5,.5,distance/gradient))*glyph.effects.y;
  if(v.analytic==1u){
    let scale=vec2f(frame.viewport.z,abs(frame.viewport.w));let pixel=1/scale;let center=v.position.xy/scale;
    let normal=v.lineInfo.xy;let signed=dot(center,normal)-v.lineInfo.z;let half=v.lineInfo.w;let a=abs(normal.x)*pixel.x*.5;let b=abs(normal.y)*pixel.y*.5;
    var coverage=boxCDF(half-signed,a,b)-boxCDF(-half-signed,a,b);
    if(frame.viewport.w<0){coverage=select(0.0,1.0,abs(signed)<half);}fill*=coverage;
  }
  if(frame.color.y>.5&&textureLoad(owners,vec2i(v.position.xy),0).r!=65536u+v.id){discard;}
  return vec4f(0,fill,0,fill);
}
