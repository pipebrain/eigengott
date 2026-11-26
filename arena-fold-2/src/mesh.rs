use crate::{math::*,collision::*,player::Player};
pub const MAX_VERTS:usize=8192;
pub const MAX_INDICES:usize=24576;
#[repr(C,align(16))]#[derive(Clone,Copy)]
pub struct Vertex{pub position:[f32;3],pub normal:[f32;3],pub color:u32,pub flags:u32}
impl Vertex{pub const EMPTY:Self=Self{position:[0.0;3],normal:[0.0;3],color:0,flags:0};}
const _: [();32]=[();core::mem::size_of::<Vertex>()];
pub struct Mesh{pub vertices:[Vertex;MAX_VERTS],pub indices:[u32;MAX_INDICES],pub count:usize,pub index_count:usize}
impl Mesh{
 pub const EMPTY:Self=Self{vertices:[Vertex::EMPTY;MAX_VERTS],indices:[0;MAX_INDICES],count:0,index_count:0};
 pub fn clear(&mut self){self.count=0;self.index_count=0;}
 pub fn box3(&mut self,b:Box3,color:u32,flags:u32){
  let h=b.half;let signs=[v(-h.x,-h.y,-h.z),v(h.x,-h.y,-h.z),v(h.x,h.y,-h.z),v(-h.x,h.y,-h.z),v(-h.x,-h.y,h.z),v(h.x,-h.y,h.z),v(h.x,h.y,h.z),v(-h.x,h.y,h.z)];
  let points=signs.map(|p|b.point(p));
  for face in [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]{
   let p=face.map(|i|points[i]);let normal=(p[1]-p[0]).cross(p[2]-p[0]).unit();let start=self.count as u32;
   assert!(self.count+4<=MAX_VERTS&&self.index_count+6<=MAX_INDICES);
   for point in p{self.vertices[self.count]=Vertex{position:[point.x,point.y,point.z],normal:[normal.x,normal.y,normal.z],color,flags};self.count+=1;}
   for index in [0,1,2,0,2,3]{self.indices[self.index_count]=start+index;self.index_count+=1;}
  }
 }
 fn body_box(&mut self,center:V3,axes:[V3;3],half:V3,color:u32){self.box3(Box3{center,axes,half,id:0},color,8);}
 pub fn body(&mut self,p:Player){
  self.clear();let(r,f,u)=p.basis();let up=v(0.0,0.0,1.0);let forward=v(f.x,f.y,0.0).unit();
  self.body_box(p.feet+up*1.03,[r,forward,up],v(0.21,0.12,0.31),rgb(113,109,91));
  for sign in [-1.0,1.0]{
   self.body_box(p.feet+r*(sign*0.11)+up*0.43,[r,forward,up],v(0.085,0.095,0.32),rgb(66,74,69));
   self.body_box(p.feet+r*(sign*0.11)+forward*0.035+up*0.16,[r,forward,up],v(0.075,0.105,0.055),rgb(46,52,48));
  }
  let eye=p.eye();let hand=eye+r*0.16+f*0.28-u*0.32;
  for sign in [-1.0,1.0]{let shoulder=p.feet+up*1.34+r*(sign*0.23);let end=hand+r*(sign*0.035);let long=(end-shoulder).unit();let side=long.cross(up).unit();let other=side.cross(long).unit();self.body_box((shoulder+end)*0.5,[side,other,long],v(0.055,0.055,(end-shoulder).len()*0.5),rgb(113,109,91));}
  self.body_box(eye+r*0.16+f*0.43-u*0.18,[r,f,u],v(0.06,0.20,0.06),rgb(80,88,78));
  self.body_box(eye+r*0.16+f*0.76-u*0.16,[r,f,u],v(0.028,0.14,0.028),rgb(124,132,117));
  self.body_box(eye+r*0.16+f*0.31-u*0.29,[r,f,u],v(0.045,0.06,0.11),rgb(78,65,46));
 }
}
pub const fn rgb(r:u32,g:u32,b:u32)->u32{r|(g<<8)|(b<<16)|0xff000000}
#[repr(C,align(16))]#[derive(Clone,Copy)]pub struct LineVertex{pub position:[f32;3],pub color:u32}
const EMPTY_LINE:LineVertex=LineVertex{position:[0.0;3],color:0};
pub struct Lines{pub vertices:[LineVertex;8192],pub count:usize}
impl Lines{
 pub const EMPTY:Self=Self{vertices:[EMPTY_LINE;8192],count:0};
 pub fn line(&mut self,a:V3,b:V3,color:u32){assert!(self.count+2<=8192);for p in [a,b]{self.vertices[self.count]=LineVertex{position:[p.x,p.y,p.z],color};self.count+=1;}}
 pub fn box3(&mut self,b:Box3,color:u32){let h=b.half;let points=[v(-h.x,-h.y,-h.z),v(h.x,-h.y,-h.z),v(h.x,h.y,-h.z),v(-h.x,h.y,-h.z),v(-h.x,-h.y,h.z),v(h.x,-h.y,h.z),v(h.x,h.y,h.z),v(-h.x,h.y,h.z)].map(|p|b.point(p));for(a,c)in [(0,1),(1,2),(2,3),(3,0),(4,5),(5,6),(6,7),(7,4),(0,4),(1,5),(2,6),(3,7)]{self.line(points[a],points[c],color);}}
 pub fn capsule(&mut self,shape:Capsule,color:u32){
  let axis=(shape.q-shape.p).unit();let side=axis.cross(if axis.z.abs()<0.8{v(0.0,0.0,1.0)}else{v(0.0,1.0,0.0)}).unit();let other=axis.cross(side).unit();let tau=core::f32::consts::TAU;
  for i in 0..24{let a=i as f32/24.0*tau;let b=(i+1)as f32/24.0*tau;let ring=|t:f32|side*(cos(t)*shape.r)+other*(sin(t)*shape.r);self.line(shape.p+ring(a),shape.p+ring(b),color);self.line(shape.q+ring(a),shape.q+ring(b),color);if i%6==0{self.line(shape.p+ring(a),shape.q+ring(a),color);}}
  for direction in [side,other,-side,-other]{for i in 0..12{let a=i as f32/12.0*core::f32::consts::FRAC_PI_2;let b=(i+1)as f32/12.0*core::f32::consts::FRAC_PI_2;self.line(shape.p+direction*(cos(a)*shape.r)-axis*(sin(a)*shape.r),shape.p+direction*(cos(b)*shape.r)-axis*(sin(b)*shape.r),color);self.line(shape.q+direction*(cos(a)*shape.r)+axis*(sin(a)*shape.r),shape.q+direction*(cos(b)*shape.r)+axis*(sin(b)*shape.r),color);}}
 }
}
