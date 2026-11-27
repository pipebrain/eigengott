use crate::math::*;
pub const N:usize=49;
pub const CELLS:usize=N*N;
pub const MAX_VERTS:usize=16384;
pub const MAX_TRIS:usize=32768;
pub const MAX_FACES:usize=16384;
pub const MAX_RENDER:usize=262144;
pub const MAX_INDICES:usize=393216;
pub const ATLAS:usize=1024;
pub const MAX_LIGHTS:usize=64;
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
 pub n:usize,pub profile:u32,pub atlas_size:usize,pub density:f32,pub detail:u32,pub requested_lights:usize,pub seed:u32,pub id:u32,pub errors:u32,pub ready:bool,pub tile:i32,pub room_height:i32,pub axis:bool,
 pub floor_x:[i32;N+1],pub floor_y:[i32;N+1],pub ceil_x:[i32;N+1],pub ceil_y:[i32;N+1],
 pub cells:[Cell;CELLS],pub open_count:usize,
 pub vertices:[I3;MAX_VERTS],pub vertex_count:usize,pub tris:[Tri;MAX_TRIS],pub tri_count:usize,
 pub faces:[Face;MAX_FACES],pub face_count:usize,pub collision:[CollisionTri;MAX_TRIS],
 pub render:[Vertex;MAX_RENDER],pub render_count:usize,pub indices:[u32;MAX_INDICES],pub index_count:usize,
 pub points:[V3;MAX_VERTS],pub wire:[u32;MAX_TRIS*6],pub wire_count:usize,
 pub lightmap:[u8;ATLAS*ATLAS*4],pub lights:[Light;MAX_LIGHTS],pub light_count:usize,
 pub nodes:[crate::spatial::Node;MAX_TRIS/2],pub node_count:usize,pub order:[u32;MAX_TRIS],
 pub weld:[u32;MAX_VERTS*2],pub texels:u32,pub rays:u32,pub ray_steps:u32,pub intersection_pairs:u32,pub geometry_hash:u32,
 pub spawn:V3,pub phase_ms:[f32;4],pub unmatched:u32,pub nonmanifold:u32,pub components:u32,pub intersections:u32,
}
impl Arena{
 pub fn grid(&self,x:usize,y:usize,top:bool)->I3{
  let xx=x as i32*self.tile-self.n as i32*self.tile/2;let yy=y as i32*self.tile-self.n as i32*self.tile/2;
  let z=if top{self.room_height+self.ceil_x[x]+self.ceil_y[y]}else{self.floor_x[x]+self.floor_y[y]};I3{x:xx,y:yy,z}

 }
 pub fn center(&self,id:usize)->V3{let x=id%self.n;let y=id/self.n;let a=self.grid(x,y,false).point();let b=self.grid(x+1,y+1,true).point();(a+b)*0.5}
 pub fn floor_at(&self,id:usize,p:V3)->f32{let f=self.cells[id].floor;f[0]*p.x+f[1]*p.y+f[2]}

 fn vertex(&mut self,p:I3)->u32{
  let mut slot=(hash(p.x as u32^hash(p.y as u32)^hash(p.z as u32)) as usize)&(MAX_VERTS*2-1);
  for _ in 0..MAX_VERTS*2{
   let old=self.weld[slot];if old!=0{if self.vertices[old as usize-1]==p{return old-1}}
   else{if self.vertex_count==MAX_VERTS{self.errors|=CAPACITY;return 0}
    let i=self.vertex_count;self.vertices[i]=p;self.points[i]=p.point();self.vertex_count+=1;self.weld[slot]=i as u32+1;return i as u32}
   slot=(slot+1)&(MAX_VERTS*2-1);
  }self.errors|=CAPACITY;0
 }

 fn face(&mut self,p:[I3;4],kind:u32,owner:usize){
  if self.face_count>=MAX_FACES||self.tri_count+2>MAX_TRIS{self.errors|=CAPACITY;return}
  let ids=[self.vertex(p[0]),self.vertex(p[1]),self.vertex(p[2]),self.vertex(p[3])];
  let normal=(p[1].point()-p[0].point()).cross(p[2].point()-p[0].point()).unit();
  self.faces[self.face_count]=Face{p,kind,owner:owner as u32,normal,..Face::EMPTY};self.face_count+=1;
  self.tris[self.tri_count]=Tri{ids:[ids[0],ids[1],ids[2]],owner:owner as u32,kind};self.tris[self.tri_count+1]=Tri{ids:[ids[0],ids[2],ids[3]],owner:owner as u32,kind};self.tri_count+=2;
 }
 pub fn generate(&mut self,seed:u32,id:u32,fault:u32,profile:u32,lights:u32,density:u32,detail:u32){
  self.profile=profile.min(2);self.n=[13,25,49][self.profile as usize];let n=self.n;
  self.atlas_size=if profile==0{512}else{ATLAS};self.density=density.clamp(1,4) as f32;self.detail=detail.min(2);self.requested_lights=lights.clamp(1,MAX_LIGHTS as u32) as usize;
  self.weld.fill(0);self.node_count=0;self.texels=0;self.rays=0;self.ray_steps=0;self.intersection_pairs=0;
  self.seed=seed;self.id=id;self.errors=0;self.ready=false;self.open_count=0;self.vertex_count=0;self.tri_count=0;self.face_count=0;self.render_count=0;self.index_count=0;self.light_count=0;self.wire_count=0;
  self.unmatched=0;self.nonmanifold=0;self.components=0;self.intersections=0;
  self.tile=if profile==0{1536+(seed%3) as i32*128}else if profile==1{3072}else{4096};self.room_height=if profile==0{4608+((seed>>3)&3) as i32*256}else{12288};self.axis=(seed&8)!=0;crate::terrain::prepare(self);
  for y in 0..n{for x in 0..n{
   let stripe=((x==4||x==8)&&y>0&&y<n-1&&y!=2&&y!=6&&y!=10)||((y==4||y==8)&&x>0&&x<n-1&&x!=2&&x!=6&&x!=10);
   let pillar=x==6&&y==6||((seed&1)!=0&&(x==2||x==10)&&(y==2||y==10));
   let (stripe,pillar)=if profile==0{(stripe,pillar)}else{
    let xwall=x%8==0&&x>0&&x<n-1&&y>0&&y<n-1&&!(2..=4).contains(&(y%8));
    let ywall=y%8==0&&y>0&&y<n-1&&x>0&&x<n-1&&!(2..=4).contains(&(x%8));
    (xwall||ywall,(x==n/2&&y==n/2)||(x%8==6&&y%8==6&&seed&1!=0))
   };
   let open=!(stripe||pillar||(fault==5&&y==n/2));let i=y*n+x;
   let a=self.grid(x,y,false).point();let dx=self.grid(x+1,y,false).point().z-a.z;let dy=self.grid(x,y+1,false).point().z-a.z;let size=self.tile as f32/1024.0;
   let f=[dx/size,dy/size,a.z-dx/size*a.x-dy/size*a.y,0.0];
   let ca=self.grid(x,y,true).point();let cx=self.grid(x+1,y,true).point().z-ca.z;let cy=self.grid(x,y+1,true).point().z-ca.z;let ceiling=[cx/size,cy/size,ca.z-cx/size*ca.x-cy/size*ca.y,0.0];self.cells[i]=Cell{open:open as u32,neighbors:[-1;4],floor:f,ceiling};
  }}
  crate::terrain::occupy(self);if fault==5{for x in 0..n{self.cells[n/2*n+x].open=0;}}
  let dx=[0,1,0,-1];let dy=[-1,0,1,0];
  for y in 0..n{for x in 0..n{let i=y*n+x;if self.cells[i].open==0{continue}
   for edge in 0..4{let xx=x as i32+dx[edge];let yy=y as i32+dy[edge];if xx>=0&&yy>=0&&xx<n as i32&&yy<n as i32{let j=yy as usize*n+xx as usize;if self.cells[j].open!=0{self.cells[i].neighbors[edge]=j as i32}}}
   let floor=[self.grid(x,y,false),self.grid(x+1,y,false),self.grid(x+1,y+1,false),self.grid(x,y+1,false)];
   let ceil=[self.grid(x,y,true),self.grid(x+1,y,true),self.grid(x+1,y+1,true),self.grid(x,y+1,true)];
   self.face(floor,0,i);self.face([ceil[3],ceil[2],ceil[1],ceil[0]],1,i);
   for e in 0..4{if self.cells[i].neighbors[e]<0{let next=(e+1)%4;self.face([floor[e],ceil[e],ceil[next],floor[next]],2,i)}}
  }}
  if fault==1&&self.tri_count>0{self.tri_count-=1}
  if fault==2{if let Some(c)=self.cells[..n*n].iter_mut().find(|c|c.open!=0){c.ceiling=[0.0,0.0,-100.0,0.0]}}
  if fault==3&&self.tri_count<MAX_TRIS{self.tris[self.tri_count]=self.tris[0];self.tri_count+=1}
  if fault==4{'outer:for c in self.cells[..n*n].iter_mut(){if c.open!=0{for e in 0..4{if c.neighbors[e]>=0{c.neighbors[e]=-1;break 'outer}}}}}
  if fault==6{self.errors|=CAPACITY}
  if fault==7{self.tris[0].ids[0]=MAX_VERTS as u32}
  if fault==8{self.tris[0].ids.swap(0,1)}
  if fault==9{if let Some(c)=self.cells[..n*n].iter_mut().find(|c|c.open!=0){c.ceiling[2]+=0.25}}
 }
}
