@group(0) @binding(1) var<storage,read> groups:array<vec4u>;
@group(1) @binding(0) var palette:texture_2d<f32>;
@group(1) @binding(1) var skies:texture_2d_array<f32>;
struct Input { @location(0) p:vec3f,@location(1) normal:u32,@location(2) material:u32,@location(3) flags:u32,@location(4) uv:vec2f }
struct Surface { @builtin(position) clip:vec4f,@location(0) p:vec3f,@location(1) n:vec3f,@location(2) uv:vec2f,@location(3) @interpolate(flat) material:u32,@location(4) ao:f32,@location(5) @interpolate(flat) flags:u32,@location(6) @interpolate(flat) group:u32 }
@vertex fn vertex(i:Input)->Surface{var o:Surface;o.p=i.p+unpack4x8snorm(i.material).xyz*.5;o.clip=frame.vp*vec4f(o.p,1);o.n=unpack4x8snorm(i.normal).xyz;o.ao=f32(i.normal>>24)/255.0;o.material=i.material>>24;o.flags=i.flags;o.uv=i.uv;let cell=max(1u,i.flags>>8)-1u;let n=u32(frame.arena.x);let span=u32(frame.arena.y);o.group=(cell%n)/span+((cell/n)/span)*u32(frame.arena.z);return o;}
struct Output { @location(0) world:vec4f,@location(1) actor:vec4f }
@fragment fn fragment(i:Surface)->Output{
 let body=(i.flags&4u)!=0u;let state=groups[min(i.group,arrayLength(&groups)-1)];if !body&&state.x==0u{discard;}if !body&&(i.flags&8u)!=0u&&frame.fold.z>.5{let uv=i.clip.xy/frame.render.xy;let dims=vec2f(textureDimensions(skies));let color=textureLoad(skies,min(vec2i(uv*dims),vec2i(dims)-1),i32((i.flags>>4)&3u),0);var sky:Output;sky.world=color;sky.actor=vec4f(0);return sky;}if !body&&frame.view.w>.5&&i.n.z<-.8{discard;}
 let uv=select(select(i.p.xy,i.p.xz,abs(i.n.y)>.5),i.p.yz,abs(i.n.x)>.5);
 let texel=floor(uv*16.0);let grain=fract(sin(dot(texel,vec2f(12.9898,78.233)))*43758.5453);let tile=fract(uv*.5);let seam=select(1.0,.91,min(tile.x,tile.y)<.014);
 let base=textureLoad(palette,vec2i(i32(i.material),0),0).rgb*(.94+grain*.08)*seam;let illumination=dynamicLighting(i.p,i.n);var color=base*illumination;if (i.flags&1u)!=0u&&frame.right.w>.5{color=base;}
 if !body {let tint=array<vec3f,6>(vec3f(.95,1,.95),vec3f(1,.95,.84),vec3f(.98,.98,.94),vec3f(1,.98,.94),vec3f(.98,1,.94),vec3f(.95,.98,.94));color*=tint[state.z%6u];}
 if (frame.sweep.x==2.0||frame.sweep.x==4.0)&&frame.sweep.w>0.0{let band=exp(-abs(length(i.p.xy-frame.fold.xy)-frame.sweep.y)*1.2);color+=vec3f(.3,.35,.32)*band*frame.sweep.w;}
 if frame.palette.x>.5{color=vec3f(dot(color,vec3f(.299,.587,.114)));}
 var o:Output;o.world=vec4f(color,1);o.actor=vec4f(color,1);return o;
}
