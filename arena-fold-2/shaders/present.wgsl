@group(0) @binding(1) var world:texture_2d<f32>;
@group(0) @binding(2) var history:texture_2d<f32>;
@group(0) @binding(3) var body:texture_2d<f32>;
fn hatch(uv:vec2f)->f32{
 let a=anchor(uv);let coords=planeCoords(a.point,a.normal);let cells=floor(coords/2.0);
 let vertical=hash(cells)>frame.style.w;
 var value=select(coords.x,coords.y,vertical)*2.0;
 var period=1.0;
 let dx=planeCoords(dpdx(a.point),a.normal);let dy=planeCoords(dpdy(a.point),a.normal);
 var derivative=select(length(vec2f(dx.x,dy.x)),length(vec2f(dx.y,dy.y)),vertical)*2.0;
 if frame.palette.z>.5{
  // Screen grid preserves exact pitch and width in final output pixels.
  let p=uv*frame.render.zw;value=select(p.x,p.y,vertical)-.5;period=frame.style.y;
  if frame.palette.z>1.5 {value=(p.x+p.y)*.70710678;}
  derivative=1.0;
 }
 // Different branch orientations must not contaminate the gradient at seams.
 let distance=abs(fract(value/period+.5)-.5)*period/max(derivative,.00001);
 return 1.0-smoothstep(max(.0,frame.style.z*.5-.5),frame.style.z*.5+.5,distance);
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
 if actor.a>.5&&frame.fold.w!=1.0&&frame.fold.w!=2.0 {color=actor.rgb;}
 return vec4f(color,1);
}
