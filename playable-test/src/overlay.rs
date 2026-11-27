use crate::{math::*,boxes::{self,Box3,Capsule},physics::{Player}};
pub const MAX:usize=2048;
static mut INPUT:[f32;MAX*8]=[0.0;MAX*8];
// Unused slots are never queried; keep their storage in zero-initialized BSS.
static mut BOXES:[Box3;MAX]=unsafe{core::mem::zeroed()};
static mut COUNT:usize=0;
static mut CONTACT:[u32;2]=[0;2];
static mut PROXIES:[f32;16]=[0.0;16];
pub fn shapes(p:Player)->[Capsule;2]{let radius=p.radius();let(a,b,r)=p.gun(p.feet);[Capsule{p:p.feet+p.up*radius,q:p.feet+p.up*(p.height()-radius),r:radius},Capsule{p:a,q:b,r:r.max(0.30)}]}
pub fn clear(p:V3,q:V3,r:f32)->bool{unsafe{
 let r=if r<0.25{0.30}else{r};let s=Capsule{p,q,r};let e=v(r,r,r);let lo=p.min(q)-e;let hi=p.max(q)+e;
 for b in &BOXES[..COUNT]{let(bl,bh)=b.bounds();if boxes::overlap(lo,hi,bl,bh)&&boxes::separation(s,*b)< -0.0001{return false}}true
}}
pub fn rotation_clear(p:Player,angle:f32)->bool{let s=shapes(p)[1];clear(s.p,s.q,s.r+((s.p-p.feet).len().max((s.q-p.feet).len())+s.r)*angle)}
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
  if p.box_body{let half=v(p.radius(),p.radius(),p.height()*0.5);let center=p.feet+v(0.0,0.0,half.z);let(lo,hi)=b.bounds();let a=center-half;let z=center+half;if a.x<hi.x-0.0001&&z.x>lo.x+0.0001&&a.y<hi.y-0.0001&&z.y>lo.y+0.0001&&a.z<hi.z-0.0001&&z.z>lo.z+0.0001{return 2}}
  for(index,s)in shapes.iter().enumerate(){if p.box_body&&index==0{continue}let e=v(s.r,s.r,s.r);let(lo,hi)=b.bounds();if boxes::overlap(s.p.min(s.q)-e,s.p.max(s.q)+e,lo,hi)&&boxes::separation(*s,b)< -0.0001{return 2}}
 }
 for i in 0..count{let r=&INPUT[i*8..i*8+8];BOXES[i]=Box3{center:v(r[0],r[1],r[2]),half:v(r[3],r[4],r[5]),id:((r[6]as u32)<<24)|(r[7]as u32),..Box3::EMPTY};}COUNT=count;0
}}
#[no_mangle]pub extern "C" fn overlay_contact_ptr()->*const u32{unsafe{CONTACT.as_ptr()}}
#[no_mangle]pub extern "C" fn overlay_count()->u32{unsafe{COUNT as u32}}
pub fn proxies(p:Player)->*const f32{unsafe{for(i,s)in shapes(p).iter().enumerate(){PROXIES[i*8..i*8+8].copy_from_slice(&[s.p.x,s.p.y,s.p.z,s.r,s.q.x,s.q.y,s.q.z,0.0]);}PROXIES.as_ptr()}}

// Exact segment versus axis-aligned overlay boxes (fields and solid props).
pub fn trace(p:V3,q:V3)->Option<(f32,V3,u32)>{unsafe{
 let d=q-p;let mut best=1.0;let mut normal=v(0.0,0.0,0.0);let mut id=0;
 for b in &BOXES[..COUNT]{let(lo,hi)=b.bounds();let mut near=0.0f32;let mut far=1.0f32;let mut n=v(0.0,0.0,0.0);let mut hit=true;
 for axis in 0..3{let(o,t,l,h)=match axis{0=>(p.x,d.x,lo.x,hi.x),1=>(p.y,d.y,lo.y,hi.y),_=>(p.z,d.z,lo.z,hi.z)};
 if t.abs()<1e-9{if o<l||o>h{hit=false;break}}else{let a=(l-o)/t;let z=(h-o)/t;let entry=a.min(z);if entry>near{near=entry;n=match axis{0=>v(if t>0.0{-1.0}else{1.0},0.0,0.0),1=>v(0.0,if t>0.0{-1.0}else{1.0},0.0),_=>v(0.0,0.0,if t>0.0{-1.0}else{1.0})};}far=far.min(a.max(z));if near>far{hit=false;break}}}
 if hit&&near<best&&far>=0.0{best=near;normal=n;id=b.id;}}
 if best<1.0{Some((best,normal,id))}else{None}
}}

pub fn clear_box(center:V3,half:V3)->bool{unsafe{for b in &BOXES[..COUNT]{let(lo,hi)=b.bounds();let a=center-half;let z=center+half;if a.x<hi.x-0.0001&&z.x>lo.x+0.0001&&a.y<hi.y-0.0001&&z.y>lo.y+0.0001&&a.z<hi.z-0.0001&&z.z>lo.z+0.0001{return false}}true}}
pub fn sweep_box(center:V3,half:V3,delta:V3)->Option<(f32,V3,u32)>{unsafe{let mut best=1.0;let mut normal=v(0.0,0.0,0.0);let mut id=0;for b in &BOXES[..COUNT]{let(lo,hi)=b.bounds();let min=lo-half-v(0.002,0.002,0.002);let max=hi+half+v(0.002,0.002,0.002);let mut near=-f32::MAX;let mut far=1.0f32;let mut n=v(0.0,0.0,0.0);let mut hit=true;for axis in 0..3{let(p,d,l,h)=match axis{0=>(center.x,delta.x,min.x,max.x),1=>(center.y,delta.y,min.y,max.y),_=>(center.z,delta.z,min.z,max.z)};if (p<=l+0.0021&&d<=0.0)||(p>=h-0.0021&&d>=0.0){hit=false;break}if d.abs()<1e-9{if p<l||p>h{hit=false;break}}else{let a=(l-p)/d;let z=(h-p)/d;let entry=a.min(z);if entry>=near{near=entry;n=match axis{0=>v(if d>0.0{-1.0}else{1.0},0.0,0.0),1=>v(0.0,if d>0.0{-1.0}else{1.0},0.0),_=>v(0.0,0.0,if d>0.0{-1.0}else{1.0})};}far=far.min(a.max(z));if near>far{hit=false;break}}}if hit&&near<best&&far>=0.0&&delta.dot(n)< -1e-9{best=near.max(0.0);normal=n;id=b.id;}}if best<1.0{Some((best,normal,id))}else{None}}}

pub fn depenetration(p:V3,q:V3,r:f32)->V3{unsafe{let r=r.max(0.30);let s=Capsule{p,q,r};let mut correction=v(0.0,0.0,0.0);let mut depth=0.0;for b in &BOXES[..COUNT]{let(distance,normal)=boxes::nearest(s,*b);let amount=r+0.006-distance;if amount>depth{depth=amount;correction=normal*amount;}}correction}}
