// Shared by void feedback, loot background and world-space forcefield surfaces.
// Branching comes from the accepted DOS maze, not independent random stripes.
fn labyrinth(tex:texture_2d<f32>,coords:vec2f,chaos:f32,time:f32)->f32{
 let dims=vec2f(textureDimensions(tex));let region=floor(coords/128.0);let h=fract(sin(dot(region,vec2f(71.7,113.9)))*41737.3);let pulse=sin(time*.33+h*6.28318);let offset=round(vec2f(select(0.0,1.0,h>.5),select(1.0,0.0,h>.5))*pulse*chaos*5.0)*17.0;
 let p=vec2i((coords+offset)%dims+dims)%vec2i(dims);return textureLoad(tex,p,0).r;
}
fn feedbackCoordinates(uv:vec2f,dt:f32,stretch:f32,time:f32,chaos:f32)->vec2f{
 let region=floor(uv*vec2f(12,8));let h=fract(sin(dot(region,vec2f(127.1,311.7)))*43758.5453);let axis=select(vec2f(1,0),vec2f(0,1),h>.5);
 return uv-(uv-vec2f(.5))*stretch*dt*.16+axis*select(-1.0,1.0,h>.25)*stretch*dt*.012*(.5+chaos);
}
