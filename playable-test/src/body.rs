//! Continuous SAT for a conservative character-specific axis-aligned envelope.
//! Capsule and box body traces are independent of movement parameter profiles.
use crate::{math::*,world::*,physics,overlay,spatial};
fn axes(tri:[V3;3])->[V3;13]{let e=[tri[1]-tri[0],tri[2]-tri[1],tri[0]-tri[2]];let basis=[v(1.0,0.0,0.0),v(0.0,1.0,0.0),v(0.0,0.0,1.0)];let mut out=[v(0.0,0.0,0.0);13];out[..3].copy_from_slice(&basis);out[3]=e[0].cross(e[1]);for i in 0..3{for j in 0..3{out[4+i*3+j]=e[i].cross(basis[j]);}}out}
fn interval(tri:[V3;3],axis:V3)->(f32,f32){let a=tri[0].dot(axis);let b=tri[1].dot(axis);let c=tri[2].dot(axis);(a.min(b.min(c)),a.max(b.max(c)))}
fn radius(half:V3,axis:V3)->f32{half.x*axis.x.abs()+half.y*axis.y.abs()+half.z*axis.z.abs()}
fn overlap(center:V3,half:V3,tri:CollisionTri)->bool{for axis in axes(tri.p){let len=axis.len();if len<1e-8{continue}let(lo,hi)=interval(tri.p,axis);let at=center.dot(axis);let r=radius(half,axis)+tri.pad*len;if at+r<=lo+0.00015*len||at-r>=hi-0.00015*len{return false}}true}
fn cast(center:V3,half:V3,delta:V3,tri:CollisionTri)->Option<(f32,V3)>{let plane=(center-tri.p[0]).dot(tri.normal)-radius(half,tri.normal)-tri.pad;if plane>=-0.0003&&delta.dot(tri.normal)>=-1e-8{return None}
 let mut near=0.0f32;let mut far=1.0f32;let mut normal=tri.normal;
 for axis in axes(tri.p){let len=axis.len();if len<1e-8{continue}let(lo,hi)=interval(tri.p,axis);let at=center.dot(axis);let r=radius(half,axis)+(tri.pad+0.002)*len;let speed=delta.dot(axis);
 if speed.abs()<1e-9{if at+r<lo||at-r>hi{return None}}
 else{let a=(lo-r-at)/speed;let b=(hi+r-at)/speed;let entry=a.min(b);if entry>near{near=entry;normal=axis/len*if speed>0.0{-1.0}else{1.0};}far=far.min(a.max(b));if near>far{return None}}
 }if near<1.0&&far>=0.0&&delta.dot(normal)< -1e-9{Some((near.max(0.0),normal))}else{None}}
pub fn clear(a:&Arena,feet:V3,r:f32,h:f32)->bool{let center=feet+v(0.0,0.0,h*0.5);let half=v(r,r,h*0.5);if !physics::inside(a,center){return false}let mut okay=true;let pad=v(0.13,0.13,0.13);spatial::query(a,center-half-pad,center+half+pad,|i|{if overlap(center,half,a.collision[i]){okay=false;return false}true});okay&&overlay::clear_box(center,half)}
pub fn sweep(a:&Arena,feet:V3,r:f32,h:f32,delta:V3)->Option<(f32,V3)>{let center=feet+v(0.0,0.0,h*0.5);let half=v(r,r,h*0.5);let pad=half+v(0.13,0.13,0.13);let mut best=1.0;let mut normal=v(0.0,0.0,0.0);spatial::query(a,center.min(center+delta)-pad,center.max(center+delta)+pad,|i|{if let Some((t,n))=cast(center,half,delta,a.collision[i]){if t<best{best=t;normal=n;}}true});if let Some((t,n,key))=overlay::sweep_box(center,half,delta){if t<best{best=t;normal=n;overlay::contact(key);}}if best<1.0{Some((best,normal))}else{None}}
