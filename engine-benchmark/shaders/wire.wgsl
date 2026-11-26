struct Frame {vp:mat4x4f,eyeTime:vec4f,options:vec4f};
@group(0) @binding(0) var<uniform> frame:Frame;
@vertex fn vertexMain(@location(0) point:vec3f)->@builtin(position) vec4f{return frame.vp*vec4f(point,1);}
@fragment fn fragmentMain()->@location(0) vec4f{return vec4f(.12,.8,.6,1);}
