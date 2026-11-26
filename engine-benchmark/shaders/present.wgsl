@group(0) @binding(0) var scene:texture_2d<f32>;
@group(0) @binding(1) var lut:texture_3d<f32>;
struct Out {@builtin(position) position:vec4f,@location(0) uv:vec2f};
@vertex fn vertexMain(@builtin(vertex_index) id:u32)->Out{
 let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:Out;o.position=vec4f(p[id],0,1);o.uv=vec2f(p[id].x*.5+.5,.5-p[id].y*.5);return o;
}
@fragment fn fragmentMain(v:Out)->@location(0) vec4f{
 let size=vec2i(textureDimensions(scene));let pixel=clamp(vec2i(v.uv*vec2f(size)),vec2i(0),size-vec2i(1));
 let color=textureLoad(scene,pixel,0).rgb;
 let bayer=array<f32,4>(0,2,3,1);let dither=(bayer[u32(pixel.x&1)+u32(pixel.y&1)*2]-.5)*.004;
 let index=vec3i(clamp(color+dither,vec3f(0),vec3f(.999))*32);
 return vec4f(textureLoad(lut,index,0).rgb,1);
}

@fragment fn atlasFragment(input:Out)->@location(0) vec4f{
 let dims=textureDimensions(scene);let p=clamp(vec2i(input.uv*vec2f(dims)),vec2i(0),vec2i(dims)-1);
 let c=textureLoad(scene,p,0);return vec4f(select(vec3f(.035),c.rgb,c.a>.5),1);
}
