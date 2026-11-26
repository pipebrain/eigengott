use crate::{math::*,collision::*,scene};
pub const STEP:f64=1.0/120.0;
const EPS:f32=0.00001;
#[derive(Clone,Copy)]
pub struct Fold{pub phase:f32,pub target:f32,pub enabled:bool,pub playing:bool,pub looping:bool,pub duration:f32,pub margin:f32,pub blocked:u32,pub reason:u32,pub checks:u32,pub rejections:u32,pub nodes:u32,pub deepest:u32,pub steps:u32,pub holds:f32}
impl Fold{
 pub const EMPTY:Self=Self{phase:0.0,target:0.0,enabled:true,playing:false,looping:false,duration:4.0,margin:0.20,blocked:0,reason:0,checks:0,rejections:0,nodes:0,deepest:0,steps:0,holds:0.0};
 pub fn seek(&mut self,next:f32,shapes:[Capsule;2],travel:f32)->bool{
  if !next.is_finite(){return false}let next=clamp(next,0.0,1.0);self.blocked=0;self.reason=0;
  if next==self.phase{return true}
  for id in 0..4{for (index,mut shape)in shapes.iter().copied().enumerate(){
   shape.r+=travel;let initial=separation(shape,scene::panel(id,self.phase));let threshold=self.margin.min(initial.max(0.0));self.checks+=1;
   if initial < -EPS||!self.interval(id,shape,self.phase,next,threshold,14){self.blocked|=1<<id;self.reason|=1<<index;}
  }}
  if self.blocked!=0{self.rejections+=1;return false}
  self.phase=next;true
 }
 fn interval(&mut self,id:usize,shape:Capsule,start:f32,end:f32,threshold:f32,depth:u32)->bool{
  self.nodes+=1;self.deepest=self.deepest.max(14-depth);
  let middle=(start+end)*0.5;let bound=scene::motion_bound(id)*(end-start).abs()*0.5;
  let b=scene::panel(id,middle);let (lo,hi)=b.bounds();let e=v(shape.r+threshold+bound,shape.r+threshold+bound,shape.r+threshold+bound);
  if !overlap(shape.p.min(shape.q)-e,shape.p.max(shape.q)+e,lo,hi){return true}
  if separation(shape,b)-bound>=threshold-EPS{return true}
  // A failed endpoint is conclusive; an uncertain interval is subdivided.
  if separation(shape,scene::panel(id,end))<threshold-EPS||depth==0{return false}
  self.interval(id,shape,start,middle,threshold,depth-1)&&self.interval(id,shape,middle,end,threshold,depth-1)
 }
 pub fn step(&mut self,shapes:[Capsule;2],travel:f32){
  self.steps+=1;
  if !self.enabled||!self.playing{return}
  let remaining=self.target-self.phase;
  if remaining.abs()<1e-7{
   if self.looping{self.holds+=STEP as f32;if self.holds>=0.5{self.target=if self.target>0.5{0.0}else{1.0};self.holds=0.0;}}
   else{self.playing=false;}return
  }
  let amount=(STEP as f32/self.duration).min(remaining.abs());let next=self.phase+if remaining>0.0{amount}else{-amount};
  self.seek(next,shapes,travel);
 }
}
