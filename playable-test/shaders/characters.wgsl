// Imported vertex animation uses shared frame storage and rigid MD3 tag poses.
struct Object { model:mat4x4f, color:vec4f, frames:vec4u, params:vec4f, material:vec4f }
struct Pose { p:vec3f, n:u32 }
@group(1) @binding(0) var<storage,read> poses:array<Pose>;
@group(1) @binding(1) var<uniform> object:Object;
@group(1) @binding(2) var diffuse:texture_2d<f32>;
@group(1) @binding(3) var materialSampler:sampler;
struct CharacterSurface { @builtin(position) clip:vec4f,@location(0) p:vec3f,@location(1) n:vec3f,@location(2) uv:vec2f }
@vertex fn character(@builtin(vertex_index) id:u32,@location(0) uv:vec2f)->CharacterSurface{
 let a=poses[object.frames.x*object.frames.z+id];let b=poses[object.frames.y*object.frames.z+id];let p=mix(a.p,b.p,object.params.x);
 let n=normalize(mix(unpack4x8snorm(a.n).xyz,unpack4x8snorm(b.n).xyz,object.params.x));var o:CharacterSurface;o.p=(object.model*vec4f(p,1)).xyz;o.clip=frame.vp*vec4f(o.p,1);o.n=normalize((object.model*vec4f(n,0)).xyz);o.uv=uv;return o;
}
struct CharacterOutput { @location(0) world:vec4f,@location(1) actor:vec4f }
@fragment fn characterColor(i:CharacterSurface)->CharacterOutput{
 let a=object.material.x;let c=cos(a);let s=sin(a);let uv=mat2x2f(vec2f(c,s),vec2f(-s,c))*(i.uv-vec2f(.5))+vec2f(.5)+object.material.yz;
 let texel=textureSample(diffuse,materialSampler,uv);let mode=object.params.w;if mode<1.5&&texel.a<object.material.w{discard;}
 let dissolve=fract(sin(dot(floor(i.p*65.0),vec3f(12.9,78.2,39.4)))*43758.54);if dissolve>object.params.y{discard;}
 var color=texel.rgb*dynamicLighting(i.p,i.n)*object.color.rgb;
 if object.frames.w!=0u{color=texel.rgb*object.color.rgb;}
 if frame.palette.x>.5{color=vec3f(dot(color,vec3f(.299,.587,.114)));}if frame.hurt.w>.5&&object.params.z>.5{color=mix(color,vec3f(1,.3,.035),.72);}
 let alpha=select(1.0,texel.a*object.color.a,mode>1.5);if alpha<.003{discard;}var o:CharacterOutput;o.world=vec4f(0);o.actor=vec4f(color*alpha,alpha);return o;
}
