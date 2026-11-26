use crate::{math::*,collision::*};
pub const BODY_RADIUS:f32=0.34;
pub const BODY_HEIGHT:f32=1.75;
#[derive(Clone,Copy)]
pub struct Player{pub feet:V3,pub velocity:V3,pub yaw:f32,pub pitch:f32,pub grounded:bool,pub ground:V3,pub previous:u32,pub steps:u32,pub contacts:u32,pub blocked_looks:u32}
impl Player{
 pub const EMPTY:Self=Self{feet:v(0.0,-5.0,0.035),velocity:v(0.0,0.0,0.0),yaw:0.0,pitch:0.0,grounded:false,ground:v(0.0,0.0,1.0),previous:0,steps:0,contacts:0,blocked_looks:0};
 pub fn eye(&self)->V3{self.feet+v(0.0,0.0,1.58)}
 pub fn basis(&self)->(V3,V3,V3){let right=v(cos(self.yaw),-sin(self.yaw),0.0);let forward=v(sin(self.yaw)*cos(self.pitch),cos(self.yaw)*cos(self.pitch),sin(self.pitch));(right,forward,right.cross(forward).unit())}
 pub fn shapes(&self)->[Capsule;2]{
  let(r,f,u)=self.basis();let eye=self.eye();[
   Capsule{p:self.feet+v(0.0,0.0,BODY_RADIUS),q:self.feet+v(0.0,0.0,BODY_HEIGHT-BODY_RADIUS),r:BODY_RADIUS},
   Capsule{p:eye+r*0.16+f*0.18-u*0.23,q:eye+r*0.16+f*0.94-u*0.17,r:0.30}
  ]
 }
 pub fn valid(&self,b:&[Box3])->bool{self.feet.finite()&&self.velocity.finite()&&self.yaw.is_finite()&&self.pitch.is_finite()&&clear(&self.shapes(),b)}
 pub fn look(&mut self,b:&[Box3],dx:f32,dy:f32){
  if !dx.is_finite()||!dy.is_finite(){return}let yaw=clamp(dx,-2000.0,2000.0)*0.002;let pitch=clamp(self.pitch-dy*0.002,-1.44,1.44)-self.pitch;
  let total=yaw.abs()+pitch.abs();if total<1e-9{return}let count=ceil(total/0.02).max(1) as usize;
  for _ in 0..count{
   let old=*self;let mut next=old;next.yaw+=yaw/count as f32;next.pitch+=pitch/count as f32;
   // Every point of the weapon proxy travels at most radius 1.3 m * angle.
   // Inflating the starting capsule certifies the entire rotation subinterval.
   let mut guarded=old.shapes();guarded[1].r+=1.3*total/count as f32;
   if clear(&guarded,b)&&next.valid(b){*self=next;}
   else{self.blocked_looks+=1;break}
  }
 }
 pub fn step(&mut self,b:&[Box3],bits:u32){
  let dt=1.0/120.0;let(r,f,_)=self.basis();let forward=v(f.x,f.y,0.0).unit();
  let mut wish=forward*((bits&1!=0)as i32 as f32-(bits&2!=0)as i32 as f32)+r*((bits&8!=0)as i32 as f32-(bits&4!=0)as i32 as f32);
  if wish.len2()>0.0{wish=wish.unit()*3.2}
  if self.grounded{self.velocity=wish-self.ground*0.5;}
  else{let lateral=v(self.velocity.x,self.velocity.y,0.0);let change=wish-lateral;let next=lateral+if change.len()>12.0*dt{change.unit()*(12.0*dt)}else{change};self.velocity.x=next.x;self.velocity.y=next.y;}
  if bits&16!=0&&self.previous&16==0&&self.grounded{self.velocity=wish+v(0.0,0.0,5.6);self.grounded=false;}
  self.previous=bits;if !self.grounded{self.velocity.z-=22.0*dt;}self.grounded=false;
  let mut remaining=self.velocity*dt;
  for _ in 0..5{
   if remaining.len2()<1e-12{break}let mut earliest=1.0;let mut normal=v(0.0,0.0,0.0);
   for shape in self.shapes(){if let Some((t,n))=sweep(shape,remaining,b){if t<earliest{earliest=t;normal=n;}}}
   self.feet=self.feet+remaining*earliest;if earliest>=1.0{break}
   self.contacts+=1;if normal.z>0.65{self.grounded=true;self.ground=normal;}
   remaining=remaining*(1.0-earliest);let amount=remaining.dot(normal);if amount<0.0{remaining=remaining-normal*amount;}
   let amount=self.velocity.dot(normal);if amount<0.0{self.velocity=self.velocity-normal*amount;}
  }self.steps+=1;
 }
}
