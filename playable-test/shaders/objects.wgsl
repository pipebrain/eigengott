@group(0) @binding(2) var maze:texture_2d<f32>;
@group(0) @binding(1) var<storage,read> groups:array<vec4u>;
struct Input { @location(0) p:vec3f,@location(1) n:vec3f,@location(2) color:vec4f,@location(3) flags:u32 }
struct Surface { @builtin(position) clip:vec4f,@location(0) p:vec3f,@location(1) n:vec3f,@location(2) color:vec4f,@location(3) @interpolate(flat) flags:u32 }
@vertex fn vertex(i:Input)->Surface{var o:Surface;o.clip=frame.vp*vec4f(i.p,1);o.p=i.p;o.n=i.n;o.color=i.color;o.flags=i.flags;return o;}
struct Output { @location(0) world:vec4f,@location(1) actor:vec4f }
fn lit(i:Surface)->vec3f{let color=i.color.rgb*(dynamicLighting(i.p,i.n));return select(color,vec3f(dot(color,vec3f(.299,.587,.114))),frame.palette.x>.5);}
@fragment fn prop(i:Surface)->Output{let state=groups[i.flags&65535u];if state.x==0u||state.y!=(i.flags>>31){discard;}var o:Output;o.world=vec4f(lit(i),1);o.actor=vec4f(0);return o;}
@fragment fn actor(i:Surface)->Output{var o:Output;o.world=vec4f(0);o.actor=vec4f(lit(i),1);return o;}
@fragment fn field(i:Surface)->Output{
 let kind=i.flags>>24;let key=i.flags&16777215u;let hit=select(0.0,frame.effects.y,u32(frame.effects.x)==key&&kind==1u);let show=frame.effects.z>.5;
 if kind==1u&&hit<=0.0&&!show{discard;}
 let coords=vec2f(i.p.x+i.p.y,i.p.z);let noise=hash(floor(coords*70.0)+floor(frame.eyeTime.w*24.0));let line=step(.80,fract(coords.y*31.0+noise*.2));let mazeLine=labyrinth(maze,coords*72.0,frame.play.y,frame.eyeTime.w);let alpha=min(.65,frame.effects.w*(select(.10,.45,kind==1u)+hit*.7+select(0.0,.2,show))*(.2+mazeLine*.8)*select(.25,1.0,noise>.35));
 var o:Output;o.world=vec4f(0);o.actor=vec4f(vec3f(.7,.82,.71)*alpha,alpha);return o;
}
