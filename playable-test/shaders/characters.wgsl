// Imported vertex animation uses shared frame storage and rigid MD3 tag poses.
struct Object { model:mat4x4f, color:vec4f, frames:vec4u, params:vec4f }
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
 let texel=textureSample(diffuse,materialSampler,i.uv);if texel.a<.4{discard;}
 let key=max(0.0,dot(normalize(i.n),normalize(vec3f(-.4,-.65,1))));let fill=max(0.0,dot(normalize(i.n),normalize(frame.eyeTime.xyz-i.p)));var color=texel.rgb*(.30+.48*key+.22*fill)*object.color.rgb;
 if object.frames.w!=0u{color=texel.rgb*object.color.rgb;}
 if frame.palette.x>.5{color=vec3f(dot(color,vec3f(.299,.587,.114)));}if frame.hurt.w>.5&&object.params.z>.5{let heat=vec3f(1.0,.30,.035);color=mix(color,heat,.72);}
 var o:CharacterOutput;o.world=vec4f(0);o.actor=vec4f(color,1);return o;
}
