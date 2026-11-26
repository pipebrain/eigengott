@group(0) @binding(1) var world:texture_2d<f32>;
@group(0) @binding(2) var history:texture_2d<f32>;
@group(0) @binding(3) var body:texture_2d<f32>;
fn hatch(uv:vec2f)->f32{
 let pixels=uv*frame.render.zw;let vertical=hash(floor(uv*vec2f(18,12)))>frame.style.w;var value=select(pixels.x,pixels.y,vertical)-.5;if frame.palette.z>1.5{value=(pixels.x+pixels.y)*.70710678;}
 let distance=abs(fract(value/frame.style.y+.5)-.5)*frame.style.y;return 1.0-smoothstep(max(0.0,frame.style.z*.5-.5),frame.style.z*.5+.5,distance);
}
@fragment fn present(i:Fullscreen)->@location(0) vec4f{
 let pixel=min(vec2i(i.uv*frame.render.xy),vec2i(frame.render.xy)-1);
 let solid=textureLoad(world,pixel,0);let past=textureLoad(history,pixel,0);let actor=textureLoad(body,pixel,0);
 // Derivatives execute uniformly, before the coverage branches.
 let lines=hatch(i.uv);var color=past.rgb;
 if solid.a<.5 && frame.style.x<.5 {
  let intensity=clamp(dot(past.rgb,vec3f(.299,.587,.114))*2.7,0.0,1.0);
  color=mix(vec3f(.68,.71,.61),vec3f(1),frame.palette.y)*lines*intensity;
 }
 if frame.fold.w==1.0 {color=select(vec3f(.9,.2,.08),vec3f(.1,.3,.12),solid.a>.5);}
 if frame.fold.w==2.0 {color=past.rgb;}
 if frame.fold.w==3.0 {color=solid.rgb;}
 if frame.fold.w!=1.0&&frame.fold.w!=2.0 {color=actor.rgb+color*(1.0-actor.a);}
 return vec4f(color,1);
}
