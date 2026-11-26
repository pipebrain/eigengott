use crate::{math::*,boxes::{self,Box3,Capsule},physics::{Player,HEIGHT}};
pub const MAX:usize=2048;
static mut INPUT:[f32;MAX*8]=[0.0;MAX*8];
// Unused slots are never queried; keep their storage in zero-initialized BSS.
static mut BOXES:[Box3;MAX]=unsafe{core::mem::zeroed()};
static mut COUNT:usize=0;
static mut CONTACT:[u32;2]=[0;2];
static mut PROXIES:[f32;16]=[0.0;16];
pub fn shapes(p:Player)->[Capsule;2]{let radius=p.radius();let(a,b,r)=p.gun(p.feet);[Capsule{p:p.feet+p.up*radius,q:p.feet+p.up*(HEIGHT-radius),r:radius},Capsule{p:a,q:b,r:r.max(0.30)}]}
pub fn clear(p:V3,q:V3,r:f32)->bool{unsafe{
 let r=if r<0.25{0.30}else{r};let s=Capsule{p,q,r};let e=v(r,r,r);let lo=p.min(q)-e;let hi=p.max(q)+e;
 for b in &BOXES[..COUNT]{let(bl,bh)=b.bounds();if boxes::overlap(lo,hi,bl,bh)&&boxes::separation(s,*b)< -0.0001{return false}}true
}}
pub fn rotation_clear(p:Player,angle:f32)->bool{let s=shapes(p)[1];clear(s.p,s.q,s.r+1.3*angle)}
pub fn sweep(p:V3,q:V3,r:f32,delta:V3)->Option<(f32,V3,u32)>{unsafe{
 let r=if r<0.25{0.30}else{r};let s=Capsule{p,q,r};let e=v(r+0.004,r+0.004,r+0.004);let lo=p.min(q).min(p+delta).min(q+delta)-e;let hi=p.max(q).max(p+delta).max(q+delta)+e;
 let mut best=1.0;let mut normal=v(0.0,0.0,0.0);let mut id=0;
 for b in &BOXES[..COUNT]{let(bl,bh)=b.bounds();if !boxes::overlap(lo,hi,bl,bh){continue}if let Some((t,n))=boxes::sweep(s,delta,core::slice::from_ref(b)){if t<best{best=t;normal=n;id=b.id;}}}
 if best<1.0{Some((best,normal,id))}else{None}
}}
pub fn contact(id:u32){unsafe{if id>>24<3{CONTACT[0]=CONTACT[0].wrapping_add(1);CONTACT[1]=id;}}}
#[no_mangle]pub extern "C" fn overlay_input()->*mut f32{unsafe{INPUT.as_mut_ptr()}}
pub fn install(count:u32,p:Player)->u32{unsafe{
 let count=count as usize;if count>MAX{return 1}let shapes=shapes(p);
 for i in 0..count{let r=&INPUT[i*8..i*8+8];if !r.iter().all(|x|x.is_finite())||r[3..6].iter().any(|x|*x<=0.0||*x>512.0)||r[6]<1.0||r[6]>3.0||r[7]<0.0||r[7]>16000000.0{return 1}
  let b=Box3{center:v(r[0],r[1],r[2]),half:v(r[3],r[4],r[5]),id:((r[6]as u32)<<24)|(r[7]as u32),..Box3::EMPTY};
  for s in shapes{let e=v(s.r,s.r,s.r);let(lo,hi)=b.bounds();if boxes::overlap(s.p.min(s.q)-e,s.p.max(s.q)+e,lo,hi)&&boxes::separation(s,b)< -0.0001{return 2}}
 }
 for i in 0..count{let r=&INPUT[i*8..i*8+8];BOXES[i]=Box3{center:v(r[0],r[1],r[2]),half:v(r[3],r[4],r[5]),id:((r[6]as u32)<<24)|(r[7]as u32),..Box3::EMPTY};}COUNT=count;0
}}
#[no_mangle]pub extern "C" fn overlay_contact_ptr()->*const u32{unsafe{CONTACT.as_ptr()}}
#[no_mangle]pub extern "C" fn overlay_count()->u32{unsafe{COUNT as u32}}
pub fn proxies(p:Player)->*const f32{unsafe{for(i,s)in shapes(p).iter().enumerate(){PROXIES[i*8..i*8+8].copy_from_slice(&[s.p.x,s.p.y,s.p.z,s.r,s.q.x,s.q.y,s.q.z,0.0]);}PROXIES.as_ptr()}}
