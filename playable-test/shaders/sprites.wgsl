struct Sprite { positionSize:vec4f,color:vec4f,endKind:vec4f,params:vec4f }
@group(1) @binding(0) var<storage,read> sprites:array<Sprite>;
@group(1) @binding(1) var atlas:texture_2d_array<f32>;
@group(1) @binding(2) var spriteSampler:sampler;
struct V { @builtin(position) clip:vec4f,@location(0) uv:vec2f,@location(1) color:vec4f,@location(2) @interpolate(flat) layer:u32 }
@vertex fn sprite(@builtin(vertex_index) vertex:u32,@builtin(instance_index) instance:u32)->V{
 let s=sprites[instance];let c=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1))[vertex];var p:vec3f;
 if s.endKind.w>.5 {let axis=s.endKind.xyz-s.positionSize.xyz;let side=normalize(cross(axis,frame.eyeTime.xyz-(s.endKind.xyz+s.positionSize.xyz)*.5)+vec3f(.00001));p=mix(s.positionSize.xyz,s.endKind.xyz,(c.x+1)*.5)+side*c.y*s.positionSize.w;}
 else {let angle=s.params.y;let r=vec2f(c.x*cos(angle)-c.y*sin(angle),c.x*sin(angle)+c.y*cos(angle));p=s.positionSize.xyz+(frame.right.xyz*r.x+frame.up.xyz*r.y)*s.positionSize.w;}
 var o:V;o.clip=frame.vp*vec4f(p,1);o.uv=vec2f(c.x*.5+.5,.5-c.y*.5);o.color=s.color;o.layer=u32(s.params.x);return o;
}
struct O{@location(0) world:vec4f,@location(1) actor:vec4f}
@fragment fn spriteColor(i:V)->O{let texel=textureSample(atlas,spriteSampler,i.uv,i32(i.layer));let alpha=select(texel.a*i.color.a,floor(texel.a*i.color.a*4.0)/4.0,frame.palette.y>.5);if alpha<.003{discard;}var o:O;o.world=vec4f(0);o.actor=vec4f(texel.rgb*i.color.rgb*alpha,alpha);return o;}
