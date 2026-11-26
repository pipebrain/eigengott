struct Frame{viewport:vec4f,style:vec4f,phase:vec4f,color:vec4f};
struct Plate{bounds:vec4f,transform:vec4f,info:vec4f};
struct Glyph{bounds:vec4f,transform:vec4f,effects:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var<storage,read> plates:array<Plate>;
@group(0) @binding(2) var<storage,read> glyphs:array<Glyph>;
@group(0) @binding(3) var atlas:texture_2d_array<f32>;
@group(0) @binding(4) var atlasSampler:sampler;
@group(0) @binding(5) var<storage,read> glyphOrder:array<u32>;
struct Quad{a:vec4f,b:vec4f};
@group(0) @binding(6) var<storage,read> quads:array<Quad>;
@group(0) @binding(7) var<storage,read> edgePriorities:array<vec4f>;
const CORNERS=array<vec2f,6>(vec2f(-.5,-.5),vec2f(.5,-.5),vec2f(.5,.5),vec2f(-.5,-.5),vec2f(.5,.5),vec2f(-.5,.5));
struct Out{@builtin(position) position:vec4f,@location(0) uv:vec2f,@location(1) @interpolate(flat) id:u32,@location(2) @interpolate(flat) index:u32};
fn screen(p:vec2f)->vec4f{return vec4f(p.x/frame.viewport.x*2-1,1-p.y/frame.viewport.y*2,0,1);}
@vertex fn plateVertex(@builtin(vertex_index) vertex:u32,@builtin(instance_index) id:u32)->Out{
  let p=plates[id];let quad=quads[id];let corner=array<u32,6>(0,1,2,0,2,3)[vertex];
  var point=array<vec2f,4>(quad.a.xy,quad.a.zw,quad.b.xy,quad.b.zw)[corner];
  if(frame.color.z>0&&p.info.z==2){point=p.bounds.xy+CORNERS[vertex]*(p.bounds.zw+vec2f(frame.color.z*2));}
  var o:Out;o.position=screen(point);o.uv=CORNERS[vertex]+vec2f(.5);o.id=u32(p.info.y);o.index=id;return o;
}
struct OwnerOut{@location(0) owner:u32,@builtin(frag_depth) depth:f32};
@fragment fn plateFragment(v:Out)->OwnerOut{
  let quad=quads[v.index];let points=array<vec2f,4>(quad.a.xy,quad.a.zw,quad.b.xy,quad.b.zw);
  var pixel=v.position.xy/vec2f(frame.viewport.z,abs(frame.viewport.w));
  if(frame.color.z>0&&plates[v.index].info.z==2){
    pixel=round((pixel-frame.phase.xy)/frame.color.z)*frame.color.z+frame.phase.xy;
    var positive=false;var negative=false;
    for(var i=0u;i<4u;i++){let d=points[(i+1u)%4u]-points[i];let p=pixel-points[i];let c=d.x*p.y-d.y*p.x;positive=positive||c>.001;negative=negative||c<-.001;}
    if(positive&&negative){discard;}
  }
  var edge=0u;var best=1e30;
  for(var i=0u;i<4u;i++){let d=points[(i+1u)%4u]-points[i];let p=pixel-points[i];let t=clamp(dot(p,d)/max(dot(d,d),.0001),0.0,1.0);let delta=p-t*d;let distance=dot(delta,delta);if(distance<best){best=distance;edge=i;}}
  var o:OwnerOut;o.owner=v.id;o.depth=1-edgePriorities[v.index][edge];return o;
}
@vertex fn glyphVertex(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->Out{
  let id=glyphOrder[instance];let g=glyphs[id];let corner=CORNERS[vertex];let expanded=g.bounds.zw+vec2f(g.effects.x*2);let local=corner*expanded;
  let c=g.transform.x;let s=g.transform.y;
  var o:Out;o.position=screen(g.bounds.xy+vec2f(c*local.x-s*local.y,s*local.x+c*local.y));o.uv=corner*expanded/g.bounds.zw+vec2f(.5);o.id=id;o.index=0u;return o;
}
@fragment fn glyphFragment(v:Out)->@location(0) u32{
  let g=glyphs[v.id];let uv=clamp(v.uv,vec2f(0),vec2f(1));
  let rg=textureSampleLevel(atlas,atlasSampler,uv,i32(g.transform.z),0).rg;
  let distance=(rg.x*65280+rg.y*255)/65535*512-256+length((v.uv-uv)*512);
  let gradient=max(length(vec2f(dpdx(distance),dpdy(distance))),.001)*frame.viewport.z;
  if(distance/gradient>g.effects.x+.5||g.effects.y<.001){discard;}
  return 65536u+v.id;
}
