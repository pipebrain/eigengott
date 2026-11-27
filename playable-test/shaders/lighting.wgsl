struct DynamicLight { positionRadius:vec4f, colorIntensity:vec4f, shadowsA:vec4u, shadowsB:vec4u }
struct DynamicLights { header:vec4f, entries:array<DynamicLight> }
struct ShadowBox { minimum:vec4f, maximum:vec4f }
@group(0) @binding(3) var<storage,read> dynamic:DynamicLights;
@group(0) @binding(4) var<storage,read> casters:array<ShadowBox>;
fn blocked(p:vec3f,delta:vec3f,id:u32)->bool{
 if id==0u{return false;}let b=casters[id-1u];if all(p>b.minimum.xyz)&&all(p<b.maximum.xyz){return false;}
 let safe=select(select(vec3f(-.00001),vec3f(.00001),delta>=vec3f(0)),delta,abs(delta)>vec3f(.00001));
 let a=(b.minimum.xyz-p)/safe;let c=(b.maximum.xyz-p)/safe;let lo=min(a,c);let hi=max(a,c);
 let enter=max(.001,max(lo.x,max(lo.y,lo.z)));let leave=min(.999,min(hi.x,min(hi.y,hi.z)));return enter<leave;
}
fn dynamicLighting(p:vec3f,n:vec3f)->vec3f{
 var value=vec3f(0);let origin=p+normalize(n)*.035;
 if frame.forward.w>0.0&&n.z>0.0{var skyBlocked=false;for(var b=0u;b<min(128u,u32(dynamic.header.y));b++){if blocked(origin,vec3f(0,0,600),b+1u){skyBlocked=true;break;}}if !skyBlocked{value=vec3f(frame.forward.w)*max(0.0,normalize(n).z);}}
 for(var j=0u;j<min(128u,u32(dynamic.header.x));j++){
  let l=dynamic.entries[j];let delta=l.positionRadius.xyz-origin;let squared=dot(delta,delta);if squared>=l.positionRadius.w*l.positionRadius.w{continue;}
  let d=sqrt(max(.000001,squared));let diffuse=max(0.0,dot(normalize(n),delta/d));if diffuse<=0.0{continue;}
  var shadow=false;for(var k=0u;k<4u;k++){shadow=shadow||blocked(origin,delta,l.shadowsA[k])||blocked(origin,delta,l.shadowsB[k]);}if shadow{continue;}
  let falloff=pow(max(0.0,1.0-d/max(.01,l.positionRadius.w)),2.0);value+=l.colorIntensity.rgb*l.colorIntensity.w*falloff*diffuse;
 }return min(value,vec3f(4));
}
