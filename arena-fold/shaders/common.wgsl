struct Frame {
 vp:mat4x4f, previousVP:mat4x4f,
 eyeTime:vec4f, right:vec4f, up:vec4f, forward:vec4f,
 view:vec4f, fold:vec4f, feedback:vec4f, style:vec4f,
 render:vec4f, palette:vec4f,
}
@group(0) @binding(0) var<uniform> frame:Frame;
struct Fullscreen { @builtin(position) position:vec4f, @location(0) uv:vec2f }
@vertex fn fullscreen(@builtin(vertex_index) id:u32)->Fullscreen{
 let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3))[id];
 var o:Fullscreen;o.position=vec4f(p,0,1);o.uv=vec2f(p.x*.5+.5,.5-p.y*.5);return o;
}
fn hash(p:vec2f)->f32{return fract(sin(dot(p,vec2f(127.1,311.7))+frame.palette.w*.719)*43758.5453);}
struct Anchor { point:vec3f, normal:vec3f }
fn anchor(uv:vec2f)->Anchor{
 let d=normalize(frame.forward.xyz+frame.right.xyz*((uv.x*2-1)*frame.view.x*frame.view.y)+frame.up.xyz*((1-uv.y*2)*frame.view.y));
 let inv=1.0/select(vec3f(.00001),d,abs(d)>vec3f(.00001));
 let a=(vec3f(-8,-10,0)-frame.eyeTime.xyz)*inv;
 let b=(vec3f(8,10,6)-frame.eyeTime.xyz)*inv;
 let lo=min(a,b);let hi=max(a,b);let enter=max(lo.x,max(lo.y,lo.z));let leave=min(hi.x,min(hi.y,hi.z));
 var result:Anchor;let t=select(enter,leave,enter<0.0);result.point=frame.eyeTime.xyz+d*max(0.0,t);
 let gap=abs(abs(result.point-vec3f(0,0,3))-vec3f(8,10,3));
 result.normal=select(select(vec3f(0,0,1),vec3f(0,1,0),gap.y<gap.z),vec3f(1,0,0),gap.x<min(gap.y,gap.z));return result;
}
fn planeCoords(p:vec3f,n:vec3f)->vec2f{return select(select(p.xy,p.xz,n.y>.5),p.yz,n.x>.5);}
fn tangent(v:vec2f,n:vec3f)->vec3f{return select(select(vec3f(v,0),vec3f(v.x,0,v.y),n.y>.5),vec3f(0,v),n.x>.5);}
fn project(p:vec3f)->vec3f{let q=frame.previousVP*vec4f(p,1);return vec3f(q.x/q.w*.5+.5,.5-q.y/q.w*.5,q.w);}
