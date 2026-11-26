#![allow(dead_code)]
use crate::math::*;

#[derive(Clone,Copy)]
pub struct Box3{pub center:V3,pub axes:[V3;3],pub half:V3,pub id:u32}
impl Box3{
 pub const EMPTY:Self=Self{center:v(0.0,0.0,0.0),axes:[v(1.0,0.0,0.0),v(0.0,1.0,0.0),v(0.0,0.0,1.0)],half:v(0.0,0.0,0.0),id:0};
 pub fn point(&self,local:V3)->V3{self.center+self.axes[0]*local.x+self.axes[1]*local.y+self.axes[2]*local.z}
 pub fn bounds(&self)->(V3,V3){let a=self.axes;let h=self.half;let e=v(a[0].x.abs()*h.x+a[1].x.abs()*h.y+a[2].x.abs()*h.z,a[0].y.abs()*h.x+a[1].y.abs()*h.y+a[2].y.abs()*h.z,a[0].z.abs()*h.x+a[1].z.abs()*h.y+a[2].z.abs()*h.z);(self.center-e,self.center+e)}
}
#[derive(Clone,Copy)]pub struct Capsule{pub p:V3,pub q:V3,pub r:f32}
pub fn overlap(a:V3,b:V3,c:V3,d:V3)->bool{!(b.x<c.x||a.x>d.x||b.y<c.y||a.y>d.y||b.z<c.z||a.z>d.z)}

// Exact segment/AABB distance: split at slab crossings, then minimize the
// quadratic squared distance in each interval. Transform to/from the OBB.
pub fn nearest(shape:Capsule,b:Box3)->(f32,V3){
 let p=shape.p-b.center;let delta=shape.q-shape.p;let a=[p.dot(b.axes[0]),p.dot(b.axes[1]),p.dot(b.axes[2])];
 let d=[delta.dot(b.axes[0]),delta.dot(b.axes[1]),delta.dot(b.axes[2])];let h=[b.half.x,b.half.y,b.half.z];
 let mut breaks=[0.0f32;8];breaks[1]=1.0;let mut count=2;
 for k in 0..3{if d[k].abs()>1e-9{for face in [-h[k],h[k]]{let t=(face-a[k])/d[k];if t>0.0&&t<1.0{breaks[count]=t;count+=1;}}}}
 breaks[..count].sort_unstable_by(|x,y|x.total_cmp(y));let mut best=f32::MAX;let mut best_t=0.0;
 let score=|t:f32|{let mut sum=0.0;for k in 0..3{let x=a[k]+d[k]*t;let distance=(x.abs()-h[k]).max(0.0);sum+=distance*distance;}sum};
 for i in 0..count-1{
  let lo=breaks[i];let hi=breaks[i+1];let mid=(lo+hi)*0.5;let mut aa=0.0;let mut bb=0.0;
  for k in 0..3{let x=a[k]+d[k]*mid;let edge=if x < -h[k]{-h[k]}else if x>h[k]{h[k]}else{continue};aa+=d[k]*d[k];bb+=d[k]*(a[k]-edge);}
  let t=if aa>1e-12{clamp(-bb/aa,lo,hi)}else{lo};let distance=score(t);if distance<best{best=distance;best_t=t;}
 }
 let local=v(a[0]+d[0]*best_t,a[1]+d[1]*best_t,a[2]+d[2]*best_t);let on_box=v(clamp(local.x,-h[0],h[0]),clamp(local.y,-h[1],h[1]),clamp(local.z,-h[2],h[2]));
 let vector=b.axes[0]*(local.x-on_box.x)+b.axes[1]*(local.y-on_box.y)+b.axes[2]*(local.z-on_box.z);let distance=sqrt(best.max(0.0));
 let normal=if distance>1e-7{vector/distance}else{let gaps=[h[0]-local.x.abs(),h[1]-local.y.abs(),h[2]-local.z.abs()];let k=if gaps[0]<=gaps[1]&&gaps[0]<=gaps[2]{0}else if gaps[1]<=gaps[2]{1}else{2};b.axes[k]*if [local.x,local.y,local.z][k]>=0.0{1.0}else{-1.0}};
 (distance,normal)
}
pub fn separation(shape:Capsule,b:Box3)->f32{nearest(shape,b).0-shape.r}
pub fn clear(shapes:&[Capsule],boxes:&[Box3])->bool{shapes.iter().all(|shape|boxes.iter().all(|b|separation(*shape,*b)>=-0.0001))}
pub fn sweep(shape:Capsule,delta:V3,boxes:&[Box3])->Option<(f32,V3)>{
 let e=v(shape.r+0.004,shape.r+0.004,shape.r+0.004);let lo=shape.p.min(shape.q).min(shape.p+delta).min(shape.q+delta)-e;let hi=shape.p.max(shape.q).max(shape.p+delta).max(shape.q+delta)+e;
 let mut earliest=1.0;let mut hit=v(0.0,0.0,0.0);
 for &b in boxes{
  let (bl,bh)=b.bounds();if !overlap(lo,hi,bl,bh){continue}let mut t=0.0;let mut normal=v(0.0,0.0,1.0);let mut unfinished=true;
  for _ in 0..20{
   let (distance,n)=nearest(Capsule{p:shape.p+delta*t,q:shape.q+delta*t,..shape},b);normal=n;let closing=-delta.dot(n);
   if closing<=1e-8{unfinished=false;break}let gap=distance-shape.r-0.003;
   if gap<=0.00001{if t<earliest{earliest=t;hit=n;}unfinished=false;break}
   t+=gap/closing;if t>=earliest{unfinished=false;break}
  }
  if unfinished&&t<earliest{earliest=t;hit=normal;}
 }if earliest<1.0{Some((earliest,hit))}else{None}
}
