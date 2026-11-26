use crate::{math::*,world::*};
pub const HEIGHT:f32=1.75;
pub const RADIUS:f32=0.28;
const SKIN:f32=0.003;
pub const STEP:f64=1.0/120.0;
#[derive(Clone,Copy)]
pub struct Player{pub feet:V3,pub velocity:V3,pub up:V3,pub ground:V3,pub yaw:f32,pub pitch:f32,pub grounded:bool,pub previous:u32,pub steps:u32,pub hits:u32,pub up_blocked:u32}
impl Player{
 pub const EMPTY:Self=Self{feet:v(0.0,0.0,0.0),velocity:v(0.0,0.0,0.0),up:v(0.0,0.0,1.0),ground:v(0.0,0.0,1.0),yaw:0.0,pitch:0.0,grounded:false,previous:0,steps:0,hits:0,up_blocked:0};
 pub fn eye(&self)->V3{self.feet+self.up*1.58}
 pub fn basis(&self)->(V3,V3,V3){
  let reference=if self.up.y.abs()<0.8{v(0.0,1.0,0.0)}else{v(1.0,0.0,0.0)};
  let f=(reference-self.up*self.up.dot(reference)).unit();let r=f.cross(self.up).unit();let forward=f*cos(self.yaw)+r*sin(self.yaw);let right=r*cos(self.yaw)-f*sin(self.yaw);
  let view=forward*cos(self.pitch)+self.up*sin(self.pitch);(right,view,right.cross(view).unit())
 }
 pub fn gun(&self,at:V3)->(V3,V3,f32){let (r,f,u)=self.basis();let eye=at+self.up*1.58;(eye+r*0.16-u*0.19+f*0.22,eye+r*0.16-u*0.17+f*0.90,0.16)}
 pub fn placement_clear(&self,a:&Arena,at:V3)->bool{
  if !capsule_clear(a,at,self.up,HEIGHT,RADIUS){return false}
  let (x,y,r)=self.gun(at);shape_clear(a,x,y,r)
 }
 pub fn look(&mut self,a:&Arena,dx:f32,dy:f32){
  if !dx.is_finite()||!dy.is_finite()||(dx==0.0&&dy==0.0){return}let old=(self.yaw,self.pitch);self.yaw+=clamp(dx,-2000.0,2000.0)*0.002;self.pitch=clamp(self.pitch-dy*0.002,-1.44,1.44);
  if !self.placement_clear(a,self.feet){self.yaw=old.0;self.pitch=old.1;self.up_blocked+=1}
 }
 pub fn step(&mut self,a:&Arena,input:u32){
  let dt=STEP as f32;let(r,f,_)=self.basis();let forward=(f-self.up*f.dot(self.up)).unit();
  let mut wish=forward*((input&1!=0) as i32 as f32-(input&2!=0) as i32 as f32)+r*((input&8!=0) as i32 as f32-(input&4!=0) as i32 as f32);
  if wish.len2()>0.0{wish=wish.unit()*3.2}
  if self.grounded{
   wish=wish-self.ground*wish.dot(self.ground);if wish.len2()>0.0{wish=wish.unit()*3.2}
   self.velocity=wish-self.ground*0.5;
  }else{
   let vertical=self.up*self.velocity.dot(self.up);let lateral=self.velocity-vertical;
   let change=wish-lateral;let max_change=12.0*dt;self.velocity=vertical+lateral+if change.len()>max_change{change.unit()*max_change}else{change};
  }
  if input&16!=0&&self.previous&16==0&&self.grounded{self.velocity=wish+self.up*5.6;self.grounded=false}
  self.previous=input;if !self.grounded{self.velocity=self.velocity-self.up*(22.0*dt)}self.grounded=false;
  let mut remaining=self.velocity*dt;
  for _ in 0..5{
   if remaining.len2()<1e-12{break}let mut earliest=1.0;let mut normal=v(0.0,0.0,0.0);
   let p=self.feet+self.up*RADIUS;let q=self.feet+self.up*(HEIGHT-RADIUS);
   if let Some((t,n))=sweep(a,p,q,RADIUS,remaining){earliest=t;normal=n}
   let(x,y,r)=self.gun(self.feet);if let Some((t,n))=sweep(a,x,y,r,remaining){if t<earliest{earliest=t;normal=n}}
   self.feet=self.feet+remaining*earliest;
   if earliest>=1.0{break}
   self.hits+=1;if normal.dot(self.up)>0.65{self.grounded=true;self.ground=normal}
   remaining=remaining*(1.0-earliest);let dot=remaining.dot(normal);if dot<0.0{remaining=remaining-normal*dot}
   let speed=self.velocity.dot(normal);if speed<0.0{self.velocity=self.velocity-normal*speed}
  }
  self.steps+=1;
 }
}
pub fn shape_clear(a:&Arena,p:V3,q:V3,radius:f32)->bool{
 for tri in a.collision[..a.tri_count].iter(){
  let r=radius+tri.pad;let lo=p.min(q)-v(r,r,r);let hi=p.max(q)+v(r,r,r);
  if hi.x<tri.lo.x||lo.x>tri.hi.x||hi.y<tri.lo.y||lo.y>tri.hi.y||hi.z<tri.lo.z||lo.z>tri.hi.z{continue}
  let(x,y)=segment_triangle(p,q,tri.p);if (x-y).len()<r-0.0004{return false}
 }true
}
pub fn inside(a:&Arena,p:V3)->bool{
 let end=p+v(207.643,83.057,124.586);let mut hits=[0.0f32;64];let mut count=0;
 for tri in a.collision[..a.tri_count].iter(){if let Some(t)=segment_hit(p,end,tri.p[0],tri.p[1],tri.p[2],false){
  if t<1e-7{continue}let mut duplicate=false;for old in &hits[..count]{if (t-*old).abs()<1e-6{duplicate=true;break}}
  if !duplicate{if count==64{return false}hits[count]=t;count+=1}
 }}count%2==1
}
pub fn capsule_clear(a:&Arena,feet:V3,up:V3,height:f32,radius:f32)->bool{inside(a,feet+up*(height*0.5))&&shape_clear(a,feet+up*radius,feet+up*(height-radius),radius)}
pub fn sweep(a:&Arena,p:V3,q:V3,radius:f32,delta:V3)->Option<(f32,V3)>{
 let mut earliest=1.0;let mut normal=v(0.0,0.0,0.0);let margin=radius+RIBBED.inward_relief+SKIN;
 let lo=p.min(q).min(p+delta).min(q+delta)-v(margin,margin,margin);let hi=p.max(q).max(p+delta).max(q+delta)+v(margin,margin,margin);
 for tri in a.collision[..a.tri_count].iter(){
  if hi.x<tri.lo.x||lo.x>tri.hi.x||hi.y<tri.lo.y||lo.y>tri.hi.y||hi.z<tri.lo.z||lo.z>tri.hi.z{continue}
  let mut time=0.0;let mut unfinished=true;let mut last_normal=tri.normal;
  for _ in 0..16{
   let(x,y)=segment_triangle(p+delta*time,q+delta*time,tri.p);let distance=(x-y).len();let n=if distance>1e-7{(x-y)/distance}else{tri.normal};
   last_normal=n;let approach=-delta.dot(n);if approach<=1e-8{unfinished=false;break}
   let gap=distance-radius-tri.pad-SKIN;
   if gap<=0.00005{if time<earliest{earliest=time;normal=n}unfinished=false;break}
   time+=gap/approach;if time>=earliest{unfinished=false;break}
  }if unfinished&&time<earliest{earliest=time;normal=last_normal}
 }if earliest<1.0{Some((earliest,normal))}else{None}
}
