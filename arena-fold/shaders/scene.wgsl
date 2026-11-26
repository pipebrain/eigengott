struct Input { @location(0) p:vec3f, @location(1) n:vec3f, @location(2) color:vec4f, @location(3) flags:u32 }
struct Surface { @builtin(position) position:vec4f, @location(0) p:vec3f, @location(1) n:vec3f, @location(2) color:vec4f, @location(3) @interpolate(flat) flags:u32 }
@vertex fn vertex(i:Input)->Surface{var o:Surface;o.position=frame.vp*vec4f(i.p,1);o.p=i.p;o.n=i.n;o.color=i.color;o.flags=i.flags;return o;}
struct Output { @location(0) world:vec4f, @location(1) body:vec4f }
@fragment fn fragment(i:Surface)->Output{
 let n=normalize(i.n);let coords=planeCoords(i.p,abs(n));
 let tile=floor(coords/vec2f(2.6,1.9));
 if i.flags<8u && hash(tile+vec2f(f32(i.flags)*17.0,frame.palette.w))<frame.fold.y {discard;}
 let light=.26+.45*max(dot(n,normalize(vec3f(-.4,-.65,1))),0.0)+.25*max(dot(n,normalize(frame.eyeTime.xyz-i.p)),0.0);
 let seam=abs(fract(coords*.45)-.5);let deriv=max(fwidth(coords*.45),vec2f(.0001));
 let grid=1.0-min(smoothstep(vec2f(0),deriv*.9,seam).x,smoothstep(vec2f(0),deriv*.9,seam).y);
 let distance=length(frame.eyeTime.xyz-i.p);let falloff=1.0/(1.0+distance*.017);
 var color=i.color.rgb*light*falloff*(1.0-grid*.3);
 if frame.palette.x>.5 {color=vec3f(dot(color,vec3f(.299,.587,.114)));}
 var o:Output;o.world=vec4f(color,1);o.body=vec4f(color,1);return o;
}
struct WireIn { @location(0) p:vec3f, @location(1) color:vec4f }
struct WireOut { @builtin(position) p:vec4f, @location(0) color:vec4f }
@vertex fn wireVertex(i:WireIn)->WireOut{var o:WireOut;o.p=frame.vp*vec4f(i.p,1);o.color=i.color;return o;}
@fragment fn wireFragment(i:WireOut)->Output{var o:Output;o.world=vec4f(0);o.body=i.color;return o;}
