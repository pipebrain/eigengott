struct DynamicLight { positionRadius:vec4f, colorIntensity:vec4f }
struct DynamicLights { header:vec4f, entries:array<DynamicLight> }
@group(0) @binding(3) var<storage,read> dynamic:DynamicLights;
fn dynamicLighting(p:vec3f,n:vec3f)->vec3f{
 var value=vec3f(0);for(var j=0u;j<min(32u,u32(dynamic.header.x));j++){
  let l=dynamic.entries[j];let delta=l.positionRadius.xyz-p;let d=length(delta);let falloff=pow(max(0.0,1.0-d/max(.01,l.positionRadius.w)),2.0);
  value+=l.colorIntensity.rgb*l.colorIntensity.w*falloff*max(0.0,dot(normalize(n),delta/max(.001,d)));
 }return min(value,vec3f(4));
}
