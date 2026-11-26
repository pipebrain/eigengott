use crate::math::*;
pub const N:usize=13;
pub const CELLS:usize=N*N;
pub const MAX_VERTS:usize=4096;
pub const MAX_TRIS:usize=4096;
pub const MAX_FACES:usize=2048;
pub const MAX_RENDER:usize=32768;
pub const MAX_INDICES:usize=65536;
pub const ATLAS:usize=512;
pub const MAX_LIGHTS:usize=16;
pub const BAD_SECTOR:u32=1;
pub const LEAK:u32=2;
pub const NON_MANIFOLD:u32=4;
pub const WINDING:u32=8;
pub const DISCONNECTED:u32=16;
pub const CLEARANCE:u32=32;
pub const CAPACITY:u32=64;
pub const INTERSECTION:u32=128;
pub const BINDING:u32=256;
pub const BAD_INDEX:u32=512;
pub const DEGENERATE:u32=1024;

#[repr(C)]#[derive(Clone,Copy,PartialEq,Eq,Default)]
pub struct I3{pub x:i32,pub y:i32,pub z:i32}
impl I3{pub const ZERO:Self=Self{x:0,y:0,z:0};pub fn point(self)->V3{v(self.x as f32/1024.0,self.y as f32/1024.0,self.z as f32/1024.0)}}
#[repr(C)]#[derive(Clone,Copy)]
pub struct Cell{pub open:u32,pub neighbors:[i32;4],pub floor:[f32;4],pub ceiling:[f32;4]}
#[repr(C)]#[derive(Clone,Copy)]
pub struct Tri{pub ids:[u32;3],pub owner:u32,pub kind:u32}
#[repr(C)]#[derive(Clone,Copy)]
pub struct CollisionTri{pub p:[V3;3],pub normal:V3,pub lo:V3,pub hi:V3,pub pad:f32}
#[repr(C,align(16))]#[derive(Clone,Copy)]
pub struct Vertex{pub flat:[f32;3],pub normal_ao:u32,pub relief_material:u32,pub flags:u32,pub lm:[f32;2]}
impl Vertex{pub const EMPTY:Self=Self{flat:[0.0;3],normal_ao:0,relief_material:0,flags:0,lm:[0.0;2]};}
const _: [();32]=[();core::mem::size_of::<Vertex>()];
const _: [();16]=[();core::mem::align_of::<Vertex>()];
#[repr(C,align(16))]#[derive(Clone,Copy)]
pub struct Light{pub position:[f32;3],pub radius:f32,pub color:[f32;3],pub intensity:f32}
const _: [();32]=[();core::mem::size_of::<Light>()];
const _: [();16]=[();core::mem::align_of::<Light>()];
const _: [();52]=[();core::mem::size_of::<Cell>()];
#[derive(Clone,Copy)]
pub struct Face{pub p:[I3;4],pub kind:u32,pub owner:u32,pub normal:V3,pub chart:[u32;4],pub origin:[f32;2],pub emitter:bool}
impl Face{pub const EMPTY:Self=Self{p:[I3::ZERO;4],kind:0,owner:0,normal:v(0.0,0.0,0.0),chart:[0;4],origin:[0.0;2],emitter:false};}
#[repr(C,align(16))]#[derive(Clone,Copy)]
pub struct SurfacePreset{pub id:u32,pub inward_relief:f32,pub bottom_trim:f32,pub top_trim:f32,pub bay_width:f32,pub authored_pack_id:u32,pub emitter_material:u32,pub flags:u32}
const _: [();32]=[();core::mem::size_of::<SurfacePreset>()];
const _: [();16]=[();core::mem::align_of::<SurfacePreset>()];
pub const RIBBED:SurfacePreset=SurfacePreset{id:1,inward_relief:0.12,bottom_trim:0.12,top_trim:0.20,bay_width:1.5,authored_pack_id:0,emitter_material:223,flags:0};

#[repr(C,align(16))]
pub struct Arena{
 pub seed:u32,pub id:u32,pub errors:u32,pub ready:bool,pub tile:i32,pub room_height:i32,pub axis:bool,
 pub cells:[Cell;CELLS],pub open_count:usize,
 pub vertices:[I3;MAX_VERTS],pub vertex_count:usize,pub tris:[Tri;MAX_TRIS],pub tri_count:usize,
 pub faces:[Face;MAX_FACES],pub face_count:usize,pub collision:[CollisionTri;MAX_TRIS],
 pub render:[Vertex;MAX_RENDER],pub render_count:usize,pub indices:[u32;MAX_INDICES],pub index_count:usize,
 pub points:[V3;MAX_VERTS],pub wire:[u32;MAX_TRIS*6],pub wire_count:usize,
 pub lightmap:[u8;ATLAS*ATLAS*4],pub lights:[Light;MAX_LIGHTS],pub light_count:usize,
 pub spawn:V3,pub phase_ms:[f32;4],pub unmatched:u32,pub nonmanifold:u32,pub components:u32,pub intersections:u32,
}
impl Arena{
 pub fn grid(&self,x:usize,y:usize,top:bool)->I3{
  let xx=x as i32*self.tile-N as i32*self.tile/2;let yy=y as i32*self.tile-N as i32*self.tile/2;
  let along=if self.axis{xx}else{yy};let floor=((along.abs()-3*self.tile)/4).max(0).min(1024);
  I3{x:xx,y:yy,z:if top{self.room_height-floor}else{floor}}
 }
 pub fn center(&self,id:usize)->V3{let x=id%N;let y=id/N;let a=self.grid(x,y,false).point();let b=self.grid(x+1,y+1,true).point();(a+b)*0.5}
 pub fn floor_at(&self,id:usize,p:V3)->f32{let f=self.cells[id].floor;f[0]*p.x+f[1]*p.y+f[2]}

 fn vertex(&mut self,p:I3)->u32{
  // At this bounded first-test size, deterministic vertex welding is cheap.
  for i in 0..self.vertex_count{if self.vertices[i]==p{return i as u32}}
  if self.vertex_count==MAX_VERTS{self.errors|=CAPACITY;return 0}
  let i=self.vertex_count;self.vertices[i]=p;self.points[i]=p.point();self.vertex_count+=1;i as u32
 }
 fn face(&mut self,p:[I3;4],kind:u32,owner:usize){
  if self.face_count>=MAX_FACES||self.tri_count+2>MAX_TRIS{self.errors|=CAPACITY;return}
  let ids=[self.vertex(p[0]),self.vertex(p[1]),self.vertex(p[2]),self.vertex(p[3])];
  let normal=(p[1].point()-p[0].point()).cross(p[2].point()-p[0].point()).unit();
  self.faces[self.face_count]=Face{p,kind,owner:owner as u32,normal,..Face::EMPTY};self.face_count+=1;
  self.tris[self.tri_count]=Tri{ids:[ids[0],ids[1],ids[2]],owner:owner as u32,kind};self.tris[self.tri_count+1]=Tri{ids:[ids[0],ids[2],ids[3]],owner:owner as u32,kind};self.tri_count+=2;
 }
 pub fn generate(&mut self,seed:u32,id:u32,fault:u32){
  self.seed=seed;self.id=id;self.errors=0;self.ready=false;self.open_count=0;self.vertex_count=0;self.tri_count=0;self.face_count=0;self.render_count=0;self.index_count=0;self.light_count=0;self.wire_count=0;
  self.unmatched=0;self.nonmanifold=0;self.components=0;self.intersections=0;
  self.tile=1536+(seed%3) as i32*128;self.room_height=4608+((seed>>3)&3) as i32*256;self.axis=(seed&8)!=0;
  for y in 0..N{for x in 0..N{
   let stripe=((x==4||x==8)&&y>0&&y<N-1&&y!=2&&y!=6&&y!=10)||((y==4||y==8)&&x>0&&x<N-1&&x!=2&&x!=6&&x!=10);
   let pillar=x==6&&y==6||((seed&1)!=0&&(x==2||x==10)&&(y==2||y==10));
   let open=!(stripe||pillar||(fault==5&&y==6));let i=y*N+x;
   let a=self.grid(x,y,false).point();let b=self.grid(x+1,y+1,false).point();let slope=(b.z-a.z)/(self.tile as f32/1024.0);
   let f=if self.axis{[slope,0.0,a.z-slope*a.x,0.0]}else{[0.0,slope,a.z-slope*a.y,0.0]};
   self.cells[i]=Cell{open:open as u32,neighbors:[-1;4],floor:f,ceiling:[-f[0],-f[1],self.room_height as f32/1024.0-f[2],0.0]};if open{self.open_count+=1}
  }}
  let dx=[0,1,0,-1];let dy=[-1,0,1,0];
  for y in 0..N{for x in 0..N{let i=y*N+x;if self.cells[i].open==0{continue}
   for edge in 0..4{let xx=x as i32+dx[edge];let yy=y as i32+dy[edge];if xx>=0&&yy>=0&&xx<N as i32&&yy<N as i32{let j=yy as usize*N+xx as usize;if self.cells[j].open!=0{self.cells[i].neighbors[edge]=j as i32}}}
   let floor=[self.grid(x,y,false),self.grid(x+1,y,false),self.grid(x+1,y+1,false),self.grid(x,y+1,false)];
   let ceil=[self.grid(x,y,true),self.grid(x+1,y,true),self.grid(x+1,y+1,true),self.grid(x,y+1,true)];
   self.face(floor,0,i);self.face([ceil[3],ceil[2],ceil[1],ceil[0]],1,i);
   for e in 0..4{if self.cells[i].neighbors[e]<0{let next=(e+1)%4;self.face([floor[e],ceil[e],ceil[next],floor[next]],2,i)}}
  }}
  if fault==1&&self.tri_count>0{self.tri_count-=1}
  if fault==2{self.cells[2*N+6].ceiling=[0.0,0.0,-1.0,0.0]}
  if fault==3&&self.tri_count<MAX_TRIS{self.tris[self.tri_count]=self.tris[0];self.tri_count+=1}
  if fault==4{self.cells[2*N+6].neighbors[1]=-1}
  if fault==6{self.errors|=CAPACITY}
  if fault==7{self.tris[0].ids[0]=MAX_VERTS as u32}
  if fault==8{self.tris[0].ids.swap(0,1)}
 }
}
