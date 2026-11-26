@group(0) @binding(1) var world:texture_2d<f32>;
@group(0) @binding(2) var previous:texture_2d<f32>;
fn fetchHistory(uv:vec2f)->vec4f{
 if any(uv<vec2f(0))||any(uv>=vec2f(1)){return vec4f(0);}
 return textureLoad(previous,vec2i(uv*frame.render.xy),0);
}
@fragment fn feedback(i:Fullscreen)->@location(0) vec4f{
 let pixel=vec2i(i.position.xy);let solid=textureLoad(world,pixel,0);
 if solid.a>.5{return solid;}
 if frame.feedback.x<.5{return vec4f(0);}
 let a=anchor(i.uv);let coords=planeCoords(a.point,a.normal);let cells=floor(coords/2.0);
 let turn=select(vec2f(1,0),vec2f(0,1),hash(cells)>frame.style.w);
 let sign=select(-1.0,1.0,hash(cells+17.0)>.5);
 var uv=i.uv;
 if frame.feedback.w>.5 {
  let shifted=a.point+tangent(turn*sign*frame.feedback.z*frame.view.z,a.normal);
  let projected=project(shifted);uv=projected.xy;if projected.z<=0.0{return vec4f(0);}
 }else{
  // Deliberate screen-space afterimage mode, independent of swapchain contents.
  let radial=i.uv-vec2f(.5);uv=i.uv-radial*frame.feedback.z*frame.view.z*.16;
  uv+=turn*sign*frame.feedback.z*frame.view.z*.012;
 }
 let old=fetchHistory(uv);let decay=exp(-.69314718*frame.view.z/max(frame.feedback.y,.02));
 return vec4f(old.rgb*decay,old.a*decay);
}
