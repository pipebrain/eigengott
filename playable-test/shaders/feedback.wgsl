@group(0) @binding(1) var world:texture_2d<f32>;
@group(0) @binding(2) var previous:texture_2d<f32>;
@group(0) @binding(4) var maze:texture_2d<f32>;
@fragment fn feedback(i:Fullscreen)->@location(0) vec4f{
 let solid=textureLoad(world,vec2i(i.position.xy),0);let loot=frame.play.x>.5;
 if solid.a>.5&&!loot{return solid;}if frame.feedback.x<.5&&!loot{return vec4f(0);}
 let uv=feedbackCoordinates(i.uv,frame.view.z,frame.feedback.z,frame.eyeTime.w,frame.play.y);var old=vec3f(0);if all(uv>=vec2f(0))&&all(uv<vec2f(1)){old=textureLoad(previous,vec2i(uv*frame.render.xy),0).rgb;}
 let decay=exp(-.69314718*frame.view.z/max(.05,frame.feedback.y));let line=labyrinth(maze,i.uv*vec2f(textureDimensions(maze)),frame.play.y,frame.eyeTime.w);
 // Keep clean actors out of history. Loot temporarily admits subdued architecture.
 let fresh=mix(vec3f(1),vec3f(.76,.79,.70),.3)*line*select(.55,.22,loot);let scene=select(vec3f(0),solid.rgb*.11,loot);
 return vec4f(max(old*decay,max(fresh,scene)),1);
}
