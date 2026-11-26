use core::ops::{Add, Sub, Mul, Div, Neg};

#[repr(C)]
#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub struct V3 { pub x:f32, pub y:f32, pub z:f32 }
pub const fn v(x:f32,y:f32,z:f32)->V3 { V3{x,y,z} }
impl Add for V3 {type Output=Self;fn add(self,b:Self)->Self{v(self.x+b.x,self.y+b.y,self.z+b.z)}}
impl Sub for V3 {type Output=Self;fn sub(self,b:Self)->Self{v(self.x-b.x,self.y-b.y,self.z-b.z)}}
impl Mul<f32> for V3 {type Output=Self;fn mul(self,b:f32)->Self{v(self.x*b,self.y*b,self.z*b)}}
impl Div<f32> for V3 {type Output=Self;fn div(self,b:f32)->Self{self*(1.0/b)}}
impl Neg for V3 {type Output=Self;fn neg(self)->Self{self*(-1.0)}}
impl V3 {
 pub fn dot(self,b:Self)->f32{self.x*b.x+self.y*b.y+self.z*b.z}
 pub fn cross(self,b:Self)->Self{v(self.y*b.z-self.z*b.y,self.z*b.x-self.x*b.z,self.x*b.y-self.y*b.x)}
 pub fn len2(self)->f32{self.dot(self)}
 pub fn len(self)->f32{sqrt(self.len2())}
 pub fn unit(self)->Self{let n=self.len();if n>1e-8{self/n}else{v(0.0,0.0,0.0)}}
 pub fn min(self,b:Self)->Self{v(self.x.min(b.x),self.y.min(b.y),self.z.min(b.z))}
 pub fn max(self,b:Self)->Self{v(self.x.max(b.x),self.y.max(b.y),self.z.max(b.z))}
 pub fn finite(self)->bool{self.x.is_finite()&&self.y.is_finite()&&self.z.is_finite()}
}
pub fn sqrt(x:f32)->f32{unsafe{super::host_sqrt(x as f64) as f32}}
pub fn sin(x:f32)->f32{unsafe{super::host_sin(x as f64) as f32}}
pub fn cos(x:f32)->f32{unsafe{super::host_cos(x as f64) as f32}}
pub fn clamp(x:f32,a:f32,b:f32)->f32{x.max(a).min(b)}
pub fn floor(x:f32)->i32{let i=x as i32;i-((x<i as f32) as i32)}
pub fn ceil(x:f32)->i32{-floor(-x)}
pub fn hash(mut x:u32)->u32{x^=x>>16;x=x.wrapping_mul(0x7feb352d);x^=x>>15;x=x.wrapping_mul(0x846ca68b);x^(x>>16)}

pub fn closest_point(p:V3,a:V3,b:V3,c:V3)->V3{
 let ab=b-a;let ac=c-a;let ap=p-a;let d1=ab.dot(ap);let d2=ac.dot(ap);
 if d1<=0.0&&d2<=0.0{return a}
 let bp=p-b;let d3=ab.dot(bp);let d4=ac.dot(bp);if d3>=0.0&&d4<=d3{return b}
 let vc=d1*d4-d3*d2;if vc<=0.0&&d1>=0.0&&d3<=0.0{return a+ab*(d1/(d1-d3))}
 let cp=p-c;let d5=ab.dot(cp);let d6=ac.dot(cp);if d6>=0.0&&d5<=d6{return c}
 let vb=d5*d2-d1*d6;if vb<=0.0&&d2>=0.0&&d6<=0.0{return a+ac*(d2/(d2-d6))}
 let va=d3*d6-d5*d4;if va<=0.0&&(d4-d3)>=0.0&&(d5-d6)>=0.0{return b+(c-b)*((d4-d3)/((d4-d3)+(d5-d6)))}
 let inverse=1.0/(va+vb+vc);a+ab*(vb*inverse)+ac*(vc*inverse)
}
pub fn closest_segments(p:V3,q:V3,a:V3,b:V3)->(V3,V3){
 let d1=q-p;let d2=b-a;let r=p-a;let aa=d1.len2();let ee=d2.len2();let ff=d2.dot(r);let mut s;let t;
 if aa<1e-10&&ee<1e-10{return(p,a)}
 if aa<1e-10{s=0.0;t=clamp(ff/ee,0.0,1.0)}else{
  let cc=d1.dot(r);if ee<1e-10{t=0.0;s=clamp(-cc/aa,0.0,1.0)}else{
   let bb=d1.dot(d2);let denom=aa*ee-bb*bb;s=if denom.abs()>1e-10{clamp((bb*ff-cc*ee)/denom,0.0,1.0)}else{0.0};
   let raw=(bb*s+ff)/ee;if raw<0.0{t=0.0;s=clamp(-cc/aa,0.0,1.0)}else if raw>1.0{t=1.0;s=clamp((bb-cc)/aa,0.0,1.0)}else{t=raw}
  }
 }(p+d1*s,a+d2*t)
}
pub fn segment_hit(p:V3,q:V3,a:V3,b:V3,c:V3,strict:bool)->Option<f32>{
 let d=q-p;let ab=b-a;let ac=c-a;let h=d.cross(ac);let det=ab.dot(h);if det.abs()<1e-7{return None}
 let inv=1.0/det;let s=p-a;let u=s.dot(h)*inv;let k=s.cross(ab);let w=d.dot(k)*inv;let t=ac.dot(k)*inv;
 let e=if strict{1e-5}else{-1e-6};if u>=e&&w>=e&&u+w<=1.0-e&&t>=e&&t<=1.0-e{Some(t)}else{None}
}
pub fn segment_triangle(p:V3,q:V3,tri:[V3;3])->(V3,V3){
 let [a,b,c]=tri;
 if let Some(t)=segment_hit(p,q,a,b,c,false){let hit=p+(q-p)*t;return(hit,hit)}
 let mut pair=(p,closest_point(p,a,b,c));let mut best=(pair.0-pair.1).len2();
 let end=closest_point(q,a,b,c);let d=(q-end).len2();if d<best{best=d;pair=(q,end)}
 for (x,y) in [(a,b),(b,c),(c,a)]{let candidate=closest_segments(p,q,x,y);let d=(candidate.0-candidate.1).len2();if d<best{best=d;pair=candidate}}
 pair
}
pub fn matrix_multiply(a:[f32;16],b:[f32;16])->[f32;16]{
 let mut out=[0.0;16];for col in 0..4{for row in 0..4{for k in 0..4{out[col*4+row]+=a[k*4+row]*b[col*4+k]}}}out
}
