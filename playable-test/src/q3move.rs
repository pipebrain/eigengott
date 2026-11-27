// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 1999-2005 id Software, Inc.
// Adapted from id Software Quake III Arena bg_slidemove.c (1999-2005).
// See licenses/quake3-movement.md and quake3-source.zip for pinned originals.
use crate::{math::*,physics::{Player,STEP},world::Arena};
const UNIT:f32=1.0/32.0;
const OVERCLIP:f32=1.001;
const STEP_HEIGHT:f32=18.0*UNIT;
pub fn clip(velocity:V3,normal:V3)->V3{let d=velocity.dot(normal);velocity-normal*if d<0.0{d*OVERCLIP}else{d/OVERCLIP}}
pub fn trace(p:&Player,a:&Arena,at:V3,delta:V3)->Option<(f32,V3)>{if p.box_body{crate::body::sweep(a,at,p.radius(),p.height(),delta)}else{crate::physics::sweep(a,at+p.up*p.radius(),at+p.up*(p.height()-p.radius()),p.radius(),delta)}}
// PM_CorrectAllSolid's 27-point jitter, adapted to move to the verified point.
// Larger bounded shells cover floating-point overlap in our triangle traces.
pub fn recover(p:&mut Player,a:&Arena)->bool{
 if p.body_clear(a,p.feet){p.safe_feet=p.feet;p.has_safe=true;return true}
 let original=p.feet;for distance in [UNIT,UNIT*2.0,UNIT*4.0]{for z in [0,1,-1]{for y in [0,-1,1]{for x in [0,-1,1]{let at=original+v(x as f32,y as f32,z as f32)*distance;if p.body_clear(a,at){p.feet=at;p.velocity=v(0.0,0.0,0.0);p.safe_feet=at;p.has_safe=true;p.up_blocked+=1;return true}}}}}
 if p.has_safe&&p.body_clear(a,p.safe_feet){p.feet=p.safe_feet;p.velocity=v(0.0,0.0,0.0);p.up_blocked+=1;return true}false
}
pub fn ground(p:&mut Player,a:&Arena){p.grounded=false;if let Some((_,n))=trace(p,a,p.feet,-p.up*(2.0*UNIT)){if p.velocity.dot(p.up)>0.0&&p.velocity.dot(n)>10.0*UNIT{return}if n.dot(p.up)>=0.7{p.grounded=true;p.ground=n;}}}
pub fn slide(p:&mut Player,a:&Arena,gravity:bool)->bool{
 let mut end_velocity=p.velocity;if gravity{end_velocity=end_velocity-p.up*(25.0*STEP as f32);p.velocity=(p.velocity+end_velocity)*0.5;if p.grounded{p.velocity=clip(p.velocity,p.ground);}}
 let mut planes=[v(0.0,0.0,0.0);5];let mut count=0usize;if p.grounded{planes[count]=p.ground;count+=1;}if p.velocity.len2()>1e-12{planes[count]=p.velocity.unit();count+=1;}
 let mut left=STEP as f32;let mut collided=false;
 for _ in 0..4{
  if p.velocity.len2()<1e-12{break}let delta=p.velocity*left;
  let Some((fraction,n))=trace(p,a,p.feet,delta)else{p.feet=p.feet+delta;break};
  collided=true;p.hits+=1;p.feet=p.feet+delta*fraction;left*=1.0-fraction;
  if count>=5{p.velocity=v(0.0,0.0,0.0);return true}
  if planes[..count].iter().any(|plane|n.dot(*plane)>0.99){p.velocity=p.velocity+n*UNIT;continue}
  planes[count]=n;count+=1;
  for i in 0..count{if p.velocity.dot(planes[i])>=0.1*UNIT{continue}
   let mut velocity=clip(p.velocity,planes[i]);let mut end=clip(end_velocity,planes[i]);
   for j in 0..count{if j==i||velocity.dot(planes[j])>=0.1*UNIT{continue}velocity=clip(velocity,planes[j]);end=clip(end,planes[j]);if velocity.dot(planes[i])>=0.0{continue}
    let direction=planes[i].cross(planes[j]).unit();velocity=direction*direction.dot(p.velocity);end=direction*direction.dot(end_velocity);
    for k in 0..count{if k!=i&&k!=j&&velocity.dot(planes[k])<0.1*UNIT{p.velocity=v(0.0,0.0,0.0);return true}}
   }p.velocity=velocity;end_velocity=end;break;
  }
 }
 if gravity{p.velocity=end_velocity;}collided
}
pub fn step_slide(p:&mut Player,a:&Arena,gravity:bool){
 let start=*p;if !slide(p,a,gravity){return}let down=*p;
 let support=trace(&start,a,start.feet,-start.up*STEP_HEIGHT);
 if start.velocity.dot(start.up)>0.0&&support.map_or(true,|(_,n)|n.dot(start.up)<0.7){return}
 let lift=trace(&start,a,start.feet,start.up*STEP_HEIGHT).map_or(STEP_HEIGHT,|(t,_)|t*STEP_HEIGHT);
 if lift<0.001{return}let raised=start.feet+start.up*lift;if !start.body_clear(a,raised){return}
 *p=start;p.feet=raised;slide(p,a,gravity);
 if let Some((t,n))=trace(p,a,p.feet,-p.up*lift){p.feet=p.feet-p.up*(lift*t);p.velocity=clip(p.velocity,n);if n.dot(p.up)<0.7{*p=down;return}}else{*p=down;return}
 // Retain the better valid path; never step backward or into another face.
 let flat=(down.feet-start.feet)-start.up*(down.feet-start.feet).dot(start.up);let stepped=(p.feet-start.feet)-start.up*(p.feet-start.feet).dot(start.up);
 if stepped.len2()+1e-8<flat.len2()||!p.body_clear(a,p.feet){*p=down;}
}
