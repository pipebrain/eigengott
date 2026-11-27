@group(0) @binding(1) var world:texture_2d<f32>;
@group(0) @binding(2) var history:texture_2d<f32>;
@group(0) @binding(4) var maze:texture_2d<f32>;
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
  let field=labyrinth(maze,i.uv*vec2f(textureDimensions(maze)),frame.play.y,frame.eyeTime.w);color=vec3f(field)*clamp(.35+dot(past.rgb,vec3f(.299,.587,.114))*1.5,0.0,1.0);
 }
 if frame.fold.w==1.0 {color=select(vec3f(.9,.2,.08),vec3f(.1,.3,.12),solid.a>.5);}
 if frame.fold.w==2.0 {color=past.rgb;}
 if frame.fold.w==3.0 {color=solid.rgb;}
 if frame.fold.w!=1.0&&frame.fold.w!=2.0 {color=actor.rgb+color*(1.0-actor.a);}

 let luminance=dot(color,vec3f(.299,.587,.114));color=mix(vec3f(luminance),color,.68)*vec3f(1.02,1,.93);
 // Retain dim emitter light instead of crushing it with 8-level floor RGB.
 color=pow(max(vec3f(0),color)/(max(vec3f(0),color)+vec3f(.65)),vec3f(.65));
 if frame.palette.y>.5{color=floor(color*32.0+.5)/32.0;}
 if frame.up.w>.5&&frame.play.x<.5{let slit=select(1.0-smoothstep(.24,.32,abs(i.uv.y-.5)),1.0-step(.28,abs(i.uv.y-.5)),frame.palette.y>.5);color*=slit;}
 if frame.play.x>.5{return vec4f(color,1);}
 let effectUV=select(i.uv,floor(i.uv*frame.render.xy/4.0)*4.0/frame.render.xy,frame.palette.y>.5);
 let edge=pow(clamp(length((effectUV-vec2f(.5))*vec2f(1.25,1.0)),0.0,1.0),2.0);
 let p=i.uv*frame.render.xy;let t=floor(frame.eyeTime.w*7.0);let grain=hash(floor(p/27.0)+t)*.55+hash(floor(p/9.0)-t)*.3+hash(floor(p/3.0)+t)*.15;let fractured=select(smoothstep(.24+grain*.12,.65,length(effectUV-vec2f(.5))),step(.30+grain*.14,length(effectUV-vec2f(.5))),frame.palette.y>.5);
 var injury=clamp(frame.play.z,0.0,1.0)*frame.feedback.w*fractured;if frame.palette.y>.5{injury=ceil(injury*5.0)/5.0;}color=mix(color,vec3f(.32,.012,.008),injury);
 let armorAlpha=frame.hurt.z*frame.armor.w*edge*.4;color=mix(color,frame.armor.rgb*.35,armorAlpha);
 let dir=normalize(vec2f(i.uv.x-.5,.5-i.uv.y)+vec2f(.00001));let hit=pow(max(0.0,dot(dir,normalize(frame.hurt.xy+vec2f(.00001)))),5.0)*edge*frame.play.w*frame.palette.w;color=mix(color,vec3f(1.0,.15,.08),clamp(hit,0.0,.8));
 return vec4f(select(color,floor(color*32.0+.5)/32.0,frame.palette.y>.5),1);
}
