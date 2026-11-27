use crate::{math::*,world::*};
pub const HEIGHT:f32=1.75;
pub const RADIUS:f32=0.34;
const SKIN:f32=0.003;
pub const STEP:f64=1.0/120.0;
#[derive(Clone,Copy)]
pub struct Player{pub feet:V3,pub velocity:V3,pub up:V3,pub ground:V3,pub yaw:f32,pub pitch:f32,pub grounded:bool,pub previous:u32,pub profile:u32,pub steps:u32,pub hits:u32,pub up_blocked:u32,pub body_radius:f32,pub body_height:f32,pub eye_height:f32,pub gun_length:f32,pub gun_radius:f32,pub crouched:bool,pub gun_start:f32,pub gun_right:f32,pub gun_down:f32,pub box_body:bool,pub gun_pivot:f32,pub crouch_height:f32,pub speed_scale:f32,pub weapon_touch:bool}
impl Player{
 pub const EMPTY:Self=Self{feet:v(0.0,0.0,0.0),velocity:v(0.0,0.0,0.0),up:v(0.0,0.0,1.0),ground:v(0.0,0.0,1.0),yaw:0.0,pitch:0.0,grounded:false,previous:0,profile:0,steps:0,hits:0,up_blocked:0,body_radius:0.42,body_height:1.75,eye_height:1.58,gun_length:0.90,gun_radius:0.20,crouched:false,gun_start:0.22,gun_right:0.16,gun_down:0.19,box_body:false,gun_pivot:1.58,crouch_height:1.25,speed_scale:1.0,weapon_touch:false};
 pub fn radius(&self)->f32{self.body_radius.max(if self.profile==1{0.46875}else{RADIUS})}
 pub fn height(&self)->f32{if self.crouched{if self.box_body{self.crouch_height}else{(self.body_height*0.7142857).max(self.radius()*2.0+0.02)}}else{self.body_height}}
 pub fn eye(&self)->V3{self.feet+self.up*(self.eye_height-(self.body_height-self.height())).min(self.height()-0.10)}
 pub fn basis(&self)->(V3,V3,V3){
  let reference=if self.up.y.abs()<0.8{v(0.0,1.0,0.0)}else{v(1.0,0.0,0.0)};
  let f=(reference-self.up*self.up.dot(reference)).unit();let r=f.cross(self.up).unit();let forward=f*cos(self.yaw)+r*sin(self.yaw);let right=r*cos(self.yaw)-f*sin(self.yaw);
  let view=forward*cos(self.pitch)+self.up*sin(self.pitch);(right,view,right.cross(view).unit())
 }
 pub fn gun(&self,at:V3)->(V3,V3,f32){let (r,f,u)=self.basis();let pivot=self.gun_pivot-(self.body_height-self.height());let eye=at+self.up*pivot+u*((self.eye()-self.feet).z-pivot);(eye+r*self.gun_right-u*self.gun_down+f*self.gun_start,eye+r*self.gun_right-u*self.gun_down+f*self.gun_length,self.gun_radius)}
 pub fn placement_clear(&self,a:&Arena,at:V3)->bool{
  if self.box_body{if !crate::body::clear(a,at,self.radius(),self.height()){return false}}else if !capsule_clear(a,at,self.up,self.height(),self.radius()){return false}
  let (x,y,r)=self.gun(at);shape_clear(a,x,y,r)
 }
 pub fn body_clear(&self,a:&Arena,at:V3)->bool{if self.box_body{crate::body::clear(a,at,self.radius(),self.height())}else{capsule_clear(a,at,self.up,self.height(),self.radius())}}
 pub fn push_weapon(&mut self,a:&Arena)->bool{
  let original=self.feet;
  for _ in 0..10{let(p,q,r)=self.gun(self.feet);let margin=r+0.14;let pad=v(margin,margin,margin);let mut push=crate::overlay::depenetration(p,q,r);let mut depth=push.len();crate::spatial::query(a,p.min(q)-pad,p.max(q)+pad,|i|{let tri=a.collision[i];let(x,y)=segment_triangle(p,q,tri.p);let d=(x-y).len();let amount=r+tri.pad+0.006-d;if amount>depth{depth=amount;push=if d>0.00001{(x-y)/d*amount}else{tri.normal*amount};}true});
   if depth<=0.00001{return self.placement_clear(a,self.feet)}
   if push.len()>0.18{push=push.unit()*0.18;}let mut at=self.feet;let mut remaining=push;for _ in 0..3{let hit=if self.box_body{crate::body::sweep(a,at,self.radius(),self.height(),remaining)}else{sweep(a,at+self.up*self.radius(),at+self.up*(self.height()-self.radius()),self.radius(),remaining)};if let Some((t,n))=hit{at=at+remaining*t;let lifted=at+n*0.002;if self.body_clear(a,lifted){at=lifted;}remaining=remaining*(1.0-t);remaining=remaining-n*remaining.dot(n).min(0.0);}else{at=at+remaining;break}}
   if (at-original).len()>0.65||(at-self.feet).len()<0.000001||!self.body_clear(a,at){self.feet=original;return false}self.feet=at;
  }let okay=self.placement_clear(a,self.feet);if !okay{self.feet=original;}okay
 }
 pub fn look(&mut self,a:&Arena,dx:f32,dy:f32){
  if !dx.is_finite()||!dy.is_finite(){return}let yaw=clamp(dx,-2000.0,2000.0)*0.002;let pitch=clamp(self.pitch-clamp(dy,-2000.0,2000.0)*0.002,-1.44,1.44)-self.pitch;
  let total=yaw.abs()+pitch.abs();if total<1e-10{return}let count=ceil(total/0.02).max(1)as u32;
  for _ in 0..count{let old=*self;self.yaw+=yaw/count as f32;self.pitch+=pitch/count as f32;if !self.placement_clear(a,self.feet)&&!self.push_weapon(a){*self=old;self.up_blocked+=1;break}}

 }
 pub fn step(&mut self,a:&Arena,input:u32){
  let dt=STEP as f32;if self.weapon_touch{self.push_weapon(a);self.weapon_touch=false;}let old_crouch=self.crouched;self.crouched=input&32!=0;if old_crouch&&!self.crouched&&!self.placement_clear(a,self.feet){self.crouched=true;}let(r,f,_)=self.basis();let forward=(f-self.up*f.dot(self.up)).unit();
  let mut wish=forward*((input&1!=0) as i32 as f32-(input&2!=0) as i32 as f32)+r*((input&8!=0) as i32 as f32-(input&4!=0) as i32 as f32);
  let speed=self.speed_scale*(if self.profile==1{10.0}else{3.2})*if self.crouched{0.5}else if input&64!=0{0.5}else{1.0};
  if wish.len2()>0.0{wish=wish.unit()*speed}
  if self.profile==1{
   let vertical=self.up*self.velocity.dot(self.up);let mut lateral=self.velocity-vertical;
   if self.grounded{let speed=lateral.len();if speed>0.0{lateral=lateral*((speed-speed.max(3.125)*6.0*dt).max(0.0)/speed);}}
   let direction=wish.unit();let target=wish.len();let add=(target-lateral.dot(direction)).max(0.0);
   lateral=lateral+direction*add.min((if self.grounded{10.0}else{1.0})*target*dt);
   if self.grounded{lateral=lateral-self.ground*lateral.dot(self.ground);self.velocity=lateral-self.ground*0.5;}
   else{self.velocity=vertical+lateral;}
  }else if self.grounded{
   wish=wish-self.ground*wish.dot(self.ground);if wish.len2()>0.0{wish=wish.unit()*speed}
   self.velocity=wish-self.ground*0.5;
  }else{
   let vertical=self.up*self.velocity.dot(self.up);let lateral=self.velocity-vertical;
   let change=wish-lateral;let max_change=12.0*dt;self.velocity=vertical+lateral+if change.len()>max_change{change.unit()*max_change}else{change};
  }
  if input&16!=0&&self.previous&16==0&&self.grounded{self.velocity=if self.profile==1{self.velocity-self.up*self.velocity.dot(self.up)+self.up*8.4375}else{wish+self.up*5.6};self.grounded=false}
  self.previous=input;if !self.grounded{self.velocity=self.velocity-self.up*((if self.profile==1{25.0}else{22.0})*dt)}self.grounded=false;
  let mut remaining=self.velocity*dt;
  for _ in 0..5{
   if remaining.len2()<1e-12{break}let mut earliest=1.0;let mut weapon_contact=false;let mut normal=v(0.0,0.0,0.0);
   let radius=self.radius();let p=self.feet+self.up*radius;let q=self.feet+self.up*(self.height()-radius);
   let contact=if self.box_body{crate::body::sweep(a,self.feet,radius,self.height(),remaining)}else{sweep(a,p,q,radius,remaining)};if let Some((t,n))=contact{earliest=t;normal=n}
   let(x,y,r)=self.gun(self.feet);if let Some((t,n))=sweep(a,x,y,r,remaining){if t<earliest{earliest=t;normal=n;weapon_contact=true;}}
   self.feet=self.feet+remaining*earliest;
   if earliest>=1.0{break}
   self.hits+=1;if weapon_contact{self.weapon_touch=true;let nudge=self.feet+normal*0.006;if self.body_clear(a,nudge){self.feet=nudge;}}if normal.dot(self.up)>0.65{self.grounded=true;self.ground=normal}
   remaining=remaining*(1.0-earliest);let dot=remaining.dot(normal);if dot<0.0{remaining=remaining-normal*dot}
   let speed=self.velocity.dot(normal);if speed<0.0{self.velocity=self.velocity-normal*speed}
  }
  self.steps+=1;
 }
}
pub fn shape_clear(a:&Arena,p:V3,q:V3,radius:f32)->bool{
 let margin=radius+RIBBED.inward_relief;let lo=p.min(q)-v(margin,margin,margin);let hi=p.max(q)+v(margin,margin,margin);let mut clear=true;
 crate::spatial::query(a,lo,hi,|i|{let tri=a.collision[i];let(x,y)=segment_triangle(p,q,tri.p);if (x-y).len()<radius+tri.pad-0.0004{clear=false;return false}true});clear&&crate::overlay::clear(p,q,radius)
}
pub fn inside(a:&Arena,p:V3)->bool{
 let end=p+v(207.643,83.057,124.586);let mut hits=[0.0f32;256];let mut count=0;let mut overflow=false;
 crate::groups::all(||crate::spatial::ray(a,p,end,|i|{let tri=a.collision[i];if let Some(t)=segment_hit(p,end,tri.p[0],tri.p[1],tri.p[2],false){
  if t<1e-7{return true}if hits[..count].iter().any(|old|(t-*old).abs()<1e-6){return true}
  if count==hits.len(){overflow=true;return false}hits[count]=t;count+=1;
 }true}));!overflow&&count%2==1
}
pub fn capsule_clear(a:&Arena,feet:V3,up:V3,height:f32,radius:f32)->bool{inside(a,feet+up*(height*0.5))&&shape_clear(a,feet+up*radius,feet+up*(height-radius),radius)}
pub fn sweep(a:&Arena,p:V3,q:V3,radius:f32,delta:V3)->Option<(f32,V3)>{
 let mut earliest=1.0;let mut normal=v(0.0,0.0,0.0);let margin=radius+RIBBED.inward_relief+SKIN;
 let lo=p.min(q).min(p+delta).min(q+delta)-v(margin,margin,margin);let hi=p.max(q).max(p+delta).max(q+delta)+v(margin,margin,margin);
 crate::spatial::query(a,lo,hi,|i|{let tri=a.collision[i];
  let mut time=0.0;let mut unfinished=true;let mut last_normal=tri.normal;
  for _ in 0..16{
   let(x,y)=segment_triangle(p+delta*time,q+delta*time,tri.p);let distance=(x-y).len();let n=if distance>1e-7{(x-y)/distance}else{tri.normal};
   last_normal=n;let approach=-delta.dot(n);if approach<=1e-8{unfinished=false;break}
   let gap=distance-radius-tri.pad-SKIN;
   if gap<=0.00005{if time<earliest{earliest=time;normal=n}unfinished=false;break}
   time+=gap/approach;if time>=earliest{unfinished=false;break}
  }if unfinished&&time<earliest{earliest=time;normal=last_normal}
 true});if let Some((t,n,id))=crate::overlay::sweep(p,q,radius,delta){if t<earliest{earliest=t;normal=n;crate::overlay::contact(id);}}if earliest<1.0{Some((earliest,normal))}else{None}
}
