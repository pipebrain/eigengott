use crate::{math::*,scene::{self,SECTORS,VARIANTS},player::Player};
pub const STEP:f64=1.0/120.0;
#[derive(Clone,Copy)]pub struct Node{pub state:u32,pub due:u32,pub start:u32,pub finish:u32,pub target:u32,pub preview:i32,pub slot:u32,pub parent:i32,pub depth:u32,pub root:bool,pub reason:u32}
impl Node{pub const EMPTY:Self=Self{state:0,due:0,start:0,finish:0,target:0,preview:-2,slot:u32::MAX,parent:-1,depth:0,root:false,reason:0};}
#[repr(C)]#[derive(Clone,Copy)]pub struct Event{pub wave:u32,pub tick:u32,pub sector:u32,pub kind:u32,pub variant:u32,pub parent:u32}
const _: [();24]=[();core::mem::size_of::<Event>()];
impl Event{pub const EMPTY:Self=Self{wave:0,tick:0,sector:0,kind:0,variant:0,parent:0};}
pub struct Wave{
 pub layout:[u32;SECTORS],pub epochs:[u32;SECTORS],pub nodes:[Node;SECTORS],pub events:[Event;256],pub event_count:u32,
 pub seed:u32,pub rng:u32,pub id:u32,pub tick:u32,pub active:bool,pub playing:bool,pub enabled:bool,pub looping:bool,
 pub spread:f32,pub coherence:f32,pub delay:f32,pub duration:f32,pub hz:f32,pub blank:f32,pub jitter:f32,pub roots:u32,pub depth:u32,pub margin:f32,pub tail:f32,pub interval:f32,
 pub visited:u32,pub changed:u32,pub protected:u32,pub previews:u32,pub preview_blocks:u32,pub completed:u32,pub body_clears:u32,pub bodies:bool,pub stage_bodies:bool,pub tail_tick:u32,pub idle:u32,
}
impl Wave{
 pub const EMPTY:Self=Self{layout:[0;SECTORS],epochs:[0;SECTORS],nodes:[Node::EMPTY;SECTORS],events:[Event::EMPTY;256],event_count:0,seed:27011984,rng:1,id:0,tick:0,active:false,playing:true,enabled:true,looping:false,spread:0.72,coherence:0.0,delay:0.38,duration:1.1,hz:12.0,blank:0.28,jitter:0.25,roots:2,depth:6,margin:0.2,tail:0.5,interval:2.0,visited:0,changed:0,protected:0,previews:0,preview_blocks:0,completed:0,body_clears:0,bodies:true,stage_bodies:true,tail_tick:0,idle:0};
 pub fn reset(&mut self,seed:u32){*self=Self::EMPTY;self.seed=seed;for id in 0..SECTORS{self.layout[id]=hash(seed^(id as u32).wrapping_mul(0x9e3779b9))%VARIANTS;}}
 fn random(&mut self)->u32{self.rng=hash(self.rng.wrapping_add(0x9e3779b9));self.rng}
 fn unit(&mut self)->f32{(self.random()>>8)as f32/16777216.0}
 fn event(&mut self,id:usize,kind:u32,variant:u32,parent:i32){let at=self.event_count as usize%256;self.events[at]=Event{wave:self.id,tick:self.tick,sector:id as u32,kind,variant,parent:parent as u32};self.event_count=self.event_count.wrapping_add(1);}
 fn queue(&mut self,id:usize,parent:i32,depth:u32,due:u32,root:bool){self.nodes[id]=Node{state:1,due,parent,depth,root,..Node::EMPTY};self.visited+=1;self.event(id,1,self.layout[id],parent);}
 pub fn start(&mut self)->bool{
  if self.active{return false}self.id=self.id.wrapping_add(1);self.tick=0;self.nodes.fill(Node::EMPTY);self.visited=0;self.changed=0;self.protected=0;self.tail_tick=0;self.idle=0;self.active=true;self.playing=true;
  if self.stage_bodies{self.bodies=true;}self.rng=hash(self.seed^self.id.wrapping_mul(0x85ebca6b));self.event(SECTORS,6,0,-1);
  let chaos=1.0-self.coherence;let count=if chaos<=0.0{0}else{ceil(self.roots as f32*chaos)as usize}.min(SECTORS);
  let mut order=[0usize;SECTORS];for(i,n)in order.iter_mut().enumerate(){*n=i;}for i in (1..SECTORS).rev(){let j=self.random()as usize%(i+1);order.swap(i,j);}
  for(i,&id)in order[..count].iter().enumerate(){let due=1+i as u32*18;self.queue(id,-1,0,due,true);}true
 }
 pub fn step(&mut self,player:Player){
  if !self.enabled||!self.playing{return}
  if !self.active{if self.looping{self.idle+=1;if self.idle>=ticks(self.interval){self.start();}}return}
  self.tick+=1;
  for id in 0..SECTORS{
   if self.nodes[id].state==1&&self.nodes[id].due<=self.tick{
    let old=self.layout[id];let target=(old+1+self.random()%(VARIANTS-1))%VARIANTS;
    let duration=self.duration*(1.0+self.jitter*(self.unit()*2.0-1.0));
    self.nodes[id].state=2;self.nodes[id].target=target;self.nodes[id].start=self.tick;self.nodes[id].finish=self.tick+ticks(duration);
    let n=self.nodes[id];if n.depth<self.depth{
     let x=id%scene::COLS;let y=id/scene::COLS;let neighbours=[if x>0{Some(id-1)}else{None},if x+1<scene::COLS{Some(id+1)}else{None},if y>0{Some(id-scene::COLS)}else{None},if y+1<scene::ROWS{Some(id+scene::COLS)}else{None}];
     for next in neighbours.into_iter().flatten(){if self.nodes[next].state==0&&self.unit()<self.spread*(1.0-self.coherence){let delay=self.delay*(1.0+self.jitter*(self.unit()*2.0-1.0));self.queue(next,id as i32,n.depth+1,self.tick+ticks(delay),false);}}
    }
   }
   if self.nodes[id].state==2{
    let n=self.nodes[id];let slot=((self.tick-n.start)as f32*self.hz/120.0)as u32;
    if n.slot!=slot{
     let salt=hash(self.seed^self.id.wrapping_mul(0x27d4eb2d)^(id as u32).wrapping_mul(0x165667b1)^slot.wrapping_mul(0x9e3779b9));
     let blank=(salt>>8)as f32/16777216.0<self.blank;
     let mut choice=hash(salt)%(VARIANTS-2);let mut candidate=0;
     for variant in 0..VARIANTS{if variant==n.target||variant==self.layout[id]{continue}if choice==0{candidate=variant;break}choice-=1;}
     self.nodes[id].preview=if blank{-1}else if scene::safe(id,candidate,player.shapes(),self.margin)==0{candidate as i32}else{self.preview_blocks+=1;-1};
     self.nodes[id].slot=slot;self.previews+=1;self.event(id,2,self.nodes[id].preview as u32,n.parent);
    }
    // Recheck a preview against the current body / gun as the player walks.
    let preview=self.nodes[id].preview;if preview>=0&&scene::safe(id,preview as u32,player.shapes(),self.margin)!=0{self.nodes[id].preview=-1;}
    if self.tick>=n.finish{
     let mut reason=scene::safe(id,n.target,player.shapes(),self.margin);
     if player.grounded&&player.feet.z>0.06&&scene::sector(player.feet)==Some(id){reason|=4;}
     if reason==0{self.layout[id]=n.target;self.epochs[id]=self.id;self.changed+=1;self.nodes[id].state=3;self.event(id,3,n.target,n.parent);}
     else{self.protected+=1;self.nodes[id].state=4;self.nodes[id].reason=reason;self.event(id,4,self.layout[id],n.parent);}
     self.nodes[id].preview=-2;
    }
   }
  }
  if self.nodes.iter().any(|n|n.state==1||n.state==2){self.tail_tick=0;}else{
   self.tail_tick+=1;if self.tail_tick>=ticks(self.tail){self.active=false;self.completed+=1;self.bodies=false;self.body_clears+=1;self.idle=0;self.event(SECTORS,5,0,-1);}
  }
 }
 pub fn visible(&self,id:usize)->i32{if self.nodes[id].state==2{self.nodes[id].preview}else{self.layout[id]as i32}}
 pub fn pending(&self)->u32{self.nodes.iter().filter(|n|n.state==1||n.state==2).count()as u32}
}
pub fn ticks(seconds:f32)->u32{ceil(seconds*120.0).max(1)as u32}
