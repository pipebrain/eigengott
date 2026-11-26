struct Frame {vp:mat4x4f,eyeTime:vec4f,options:vec4f};
struct Light {position:vec4f,color:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@group(0) @binding(1) var palette:texture_2d<f32>;
@group(1) @binding(0) var lightmap:texture_2d<f32>;
@group(1) @binding(1) var pointSampler:sampler;
@group(1) @binding(2) var<storage,read> lights:array<Light>;
struct Input {@location(0) flat:vec3f,@location(1) normalAO:u32,@location(2) reliefMaterial:u32,@location(3) flags:u32,@location(4) lm:vec2f};
struct Output {@builtin(position) clip:vec4f,@location(0) world:vec3f,@location(1) normal:vec3f,@location(2) lm:vec2f,@location(3) @interpolate(flat) material:u32,@location(4) ao:f32,@location(5) @interpolate(flat) flags:u32};
@vertex fn vertexMain(input:Input)->Output{
 var out:Output;out.world=input.flat+unpack4x8snorm(input.reliefMaterial).xyz*.5*frame.options.y;
 out.clip=frame.vp*vec4f(out.world,1);out.normal=unpack4x8snorm(input.normalAO).xyz;out.ao=f32(input.normalAO>>24u)/255;
 out.lm=input.lm;out.material=input.reliefMaterial>>24u;out.flags=input.flags;return out;
}
@fragment fn fragmentMain(input:Output)->@location(0) vec4f{
 if((input.flags&2u)!=0u&&frame.options.y<.001){discard;}
 let normal=normalize(input.normal);let base=textureLoad(palette,vec2i(i32(input.material),0),0).rgb;
 var illumination=vec3f(.8);
 if(frame.options.z>.5){
  if(input.lm.x<0){
   illumination=vec3f(.18,.16,.135);
   for(var i=0u;i<min(u32(frame.options.w),arrayLength(&lights));i++){
    let delta=lights[i].position.xyz-input.world;let distance2=dot(delta,delta);
    let diffuse=max(0.0,dot(normal,normalize(delta)));
    illumination+=lights[i].color.rgb*lights[i].color.a*diffuse/(1+distance2*.22);
   }
  }else{illumination=textureSampleLevel(lightmap,pointSampler,input.lm,0).rgb;}
 }
 var color=base*illumination*input.ao;
 if((input.flags&1u)!=0u){color=base;}
 if(frame.options.x>.5){color=(abs(normal)*.35+vec3f(.20,.25,.23))*input.ao;}
 let distance=length(frame.eyeTime.xyz-input.world);let fog=1-exp(-distance*distance*.0015);
 color=mix(color,vec3f(.012,.009,.013),fog);return vec4f(clamp(color,vec3f(0),vec3f(1)),1);
}
