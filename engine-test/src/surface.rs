use crate::{math::*,world::*};
pub const EMISSIVE:u32=1;
pub const DRESSING:u32=2;
pub const BODY:u32=4;
pub static mut PALETTE:[u8;256*4]=[0;256*4];
pub static mut LUT:[u8;32*32*32*4]=[0;32*32*32*4];
fn signed(x:f32)->u32{let n=clamp(x,-1.0,1.0)*127.0;((n+if n<0.0{-0.5}else{0.5}) as i32 as u32)&255}
pub fn vertex(flat:V3,displacement:V3,normal:V3,ao:f32,material:u32,flags:u32,lm:[f32;2])->Vertex{
 Vertex{flat:[flat.x,flat.y,flat.z],normal_ao:signed(normal.x)|(signed(normal.y)<<8)|(signed(normal.z)<<16)|(((clamp(ao,0.0,1.0)*255.0) as u32)<<24),
  relief_material:signed(displacement.x*2.0)|(signed(displacement.y*2.0)<<8)|(signed(displacement.z*2.0)<<16)|(material<<24),flags,lm}
}
pub fn color(id:u32)->V3{unsafe{let i=id as usize*4;v(PALETTE[i] as f32/255.0,PALETTE[i+1] as f32/255.0,PALETTE[i+2] as f32/255.0)}}
pub fn palette(){
 let ramps=[v(0.66,0.53,0.23),v(0.60,0.17,0.12),v(0.36,0.41,0.24),v(0.40,0.28,0.43),v(0.43,0.49,0.48),v(0.76,0.72,0.56),v(0.22,0.77,0.70),v(0.92,0.45,0.16)];
 unsafe{
  for g in 0..8{for level in 0..32{let c=ramps[g]*(level as f32/31.0);let i=(g*32+level)*4;PALETTE[i]=(c.x*255.0) as u8;PALETTE[i+1]=(c.y*255.0) as u8;PALETTE[i+2]=(c.z*255.0) as u8;PALETTE[i+3]=255}}
  for z in 0..32{for y in 0..32{for x in 0..32{
   let rgb=v((x as f32+0.5)/32.0,(y as f32+0.5)/32.0,(z as f32+0.5)/32.0);let mut best=1e9;let mut id=0;
   for n in 0..256{let c=color(n);let d=c-rgb;let score=d.x*d.x*0.25+d.y*d.y*0.55+d.z*d.z*0.2;if score<best{best=score;id=n as usize}}
   let out=((z*32+y)*32+x)*4;for c in 0..4{LUT[out+c]=PALETTE[id*4+c]}
  }}}
 }
}
pub fn quad(a:&mut Arena,p:[V3;4],d:[V3;4],normal:V3,ao:f32,mat:u32,flags:u32,lm:[[f32;2];4]){
 if a.render_count+4>MAX_RENDER||a.index_count+6>MAX_INDICES{a.errors|=CAPACITY;return}
 let start=a.render_count as u32;for i in 0..4{a.render[a.render_count+i]=vertex(p[i],d[i],normal,ao,mat,flags,lm[i])}
 for (i,n) in [0,1,2,0,2,3].iter().enumerate(){a.indices[a.index_count+i]=start+n}
 a.render_count+=4;a.index_count+=6;
}
fn tangent(face:Face)->V3{let d=face.p[3].point()-face.p[0].point();v(d.x,d.y,0.0).unit()}
fn project(face:Face,p:V3)->[f32;2]{if face.kind==2{[(p-face.p[0].point()).dot(tangent(face)),p.z]}else{[p.x,p.y]}}
fn uv(face:Face,p:V3)->[f32;2]{let p=project(face,p);[(face.chart[0] as f32+p[0]*2.0-face.origin[0])/ATLAS as f32,(face.chart[1] as f32+p[1]*2.0-face.origin[1])/ATLAS as f32]}
fn world_point(a:&Arena,face:Face,u:f32,w:f32)->V3{
 if face.kind==2{let mut p=face.p[0].point()+tangent(face)*u;p.z=w;p}
 else{let c=a.cells[face.owner as usize];let f=if face.kind==0{c.floor}else{c.ceiling};v(u,w,f[0]*u+f[1]*w+f[2])}
}
pub fn mesh(a:&mut Arena){
 a.render_count=0;a.index_count=0;a.light_count=0;
 let mut shelf_x=0;let mut shelf_y=0;let mut row=0;
 // Explicit one-luxel guards keep nearest samples inside their parent chart.
 for i in 0..a.face_count{
  let mut f=a.faces[i];let mut lo=[1e9f32;2];let mut hi=[-1e9f32;2];
  for p in f.p{let q=project(f,p.point());for k in 0..2{lo[k]=lo[k].min(q[k]);hi[k]=hi[k].max(q[k]);}}
  f.origin=[floor(lo[0]*2.0) as f32-1.0,floor(lo[1]*2.0) as f32-1.0];
  let width=(ceil(hi[0]*2.0)-f.origin[0] as i32+2) as u32;let height=(ceil(hi[1]*2.0)-f.origin[1] as i32+2) as u32;
  if shelf_x+width>ATLAS as u32{shelf_x=0;shelf_y+=row;row=0}
  if shelf_y+height>ATLAS as u32{a.errors|=CAPACITY;return}
  f.chart=[shelf_x,shelf_y,width,height];shelf_x+=width;row=row.max(height);a.faces[i]=f;
 }
 let mut scores=[u32::MAX;12];let mut selected=[usize::MAX;12];
 for i in 0..a.face_count{if a.faces[i].kind!=2{continue}let score=hash(a.seed^(i as u32).wrapping_mul(1777));
  for k in 0..12{if score<scores[k]{for j in (k+1..12).rev(){scores[j]=scores[j-1];selected[j]=selected[j-1]}scores[k]=score;selected[k]=i;break}}
 }
 for i in selected{if i==usize::MAX{continue}let f=&mut a.faces[i];f.emitter=true;
  let p=(f.p[1].point()+f.p[2].point())*0.5+f.normal*0.16-v(0.0,0.0,0.40);let material=match hash(i as u32^a.seed)%3{0=>223,1=>255,_=>31};let c=color(material);
  a.lights[a.light_count]=Light{position:[p.x,p.y,p.z],radius:9.0,color:[c.x,c.y,c.z],intensity:7.0};a.light_count+=1;
 }
 for i in 0..a.face_count{
  let f=a.faces[i];
  if f.kind!=2{let p=f.p.map(|p|p.point());quad(a,p,[v(0.0,0.0,0.0);4],f.normal,1.0,if f.kind==0{86}else{151},0,p.map(|p|uv(f,p)));continue}
  let left=f.p[0].point();let right=f.p[3].point();let top_left=f.p[1].point();let top_right=f.p[2].point();let dir=tangent(f);let length=(v(right.x,right.y,0.0)-v(left.x,left.y,0.0)).len();
  let us=[0.0,0.12,length-0.12,length];let depths=[0.0,0.065,0.0,-0.055,0.09,0.0];
  for column in 0..3{for band in 0..5{
   let mut p=[v(0.0,0.0,0.0);4];let mut d=p;
   for (j,(col,b)) in [(column,band),(column,band+1),(column+1,band+1),(column+1,band)].iter().enumerate(){
    let u=us[*col];let t=u/length;let floor=left.z+(right.z-left.z)*t;let ceil=top_left.z+(top_right.z-top_left.z)*t;let h=ceil-floor;
    let height=[0.0,RIBBED.bottom_trim,0.28,h-0.52,h-RIBBED.top_trim,h][*b];p[j]=left+dir*u;p[j].z=floor+height;
    d[j]=f.normal*(depths[*b]*if *col==0||*col==3{0.0}else{1.0});
   }
   let n=((p[1]+d[1])-(p[0]+d[0])).cross((p[2]+d[2])-(p[0]+d[0])).unit();
   quad(a,p,d,n,if band==2{0.72}else{0.94},if band==2{119}else if band==3{148}else{26},0,p.map(|p|uv(f,p)));
  }}
  if f.emitter{
   let material=match hash(i as u32^a.seed)%3{0=>223,1=>255,_=>31};
   let base=(top_left+top_right)*0.5-v(0.0,0.0,0.4);let r=dir*((length-0.5)*0.5);let up=v(0.0,0.0,0.028);
   let front=[base-r-up,base-r+up,base+r+up,base+r-up];let displacement=[f.normal*0.10;4];
   quad(a,front,displacement,f.normal,1.0,material,EMISSIVE|DRESSING,front.map(|p|uv(f,p)));
   for e in 0..4{let n=(e+1)%4;let p=[front[e],front[n],front[n],front[e]];let d=[f.normal*0.10,f.normal*0.10,f.normal*0.05,f.normal*0.05];
    let normal=((p[1]+d[1])-(p[0]+d[0])).cross((p[2]+d[2])-(p[0]+d[0])).unit();quad(a,p,d,normal,0.8,148,DRESSING,p.map(|p|uv(f,p)));
   }
  }
 }
}
fn visible(a:&Arena,from:V3,to:V3)->bool{
 let tile=a.tile as f32/1024.0;let half=N as f32*tile*0.5;let delta=to-from;
 let mut x=floor((from.x+half)/tile);let mut y=floor((from.y+half)/tile);let sx=if delta.x>=0.0{1}else{-1};let sy=if delta.y>=0.0{1}else{-1};
 let tx=if delta.x.abs()<1e-8{1e9}else{tile/delta.x.abs()};let ty=if delta.y.abs()<1e-8{1e9}else{tile/delta.y.abs()};
 let mut nx=if delta.x.abs()<1e-8{1e9}else{(((x+if sx>0{1}else{0}) as f32*tile-half)-from.x)/delta.x};
 let mut ny=if delta.y.abs()<1e-8{1e9}else{(((y+if sy>0{1}else{0}) as f32*tile-half)-from.y)/delta.y};let mut enter=0.0f32;
 for _ in 0..64{
  if x<0||y<0||x>=N as i32||y>=N as i32{return false}let id=y as usize*N+x as usize;if a.cells[id].open==0{return false}
  let exit=nx.min(ny).min(1.0);let cell=a.cells[id];
  for t in [enter.min(1.0),exit]{let p=from+delta*t;let floor=cell.floor[0]*p.x+cell.floor[1]*p.y+cell.floor[2];let ceiling=cell.ceiling[0]*p.x+cell.ceiling[1]*p.y+cell.ceiling[2];if p.z<floor-0.005||p.z>ceiling+0.005{return false}}
  if exit>=1.0{return true}enter=exit;
  if nx<ny{x+=sx;nx+=tx}else{y+=sy;ny+=ty}
 }false
}
fn inverse_sqrt(x:f32)->f32{let mut y=f32::from_bits(0x5f3759df-(x.to_bits()>>1));y*=1.5-0.5*x*y*y;y*(1.5-0.5*x*y*y)}
pub fn bake(a:&mut Arena){
 a.lightmap.fill(0);
 for i in 0..a.face_count{let face=a.faces[i];let [x,y,w,h]=face.chart;
  for row in 0..h{for col in 0..w{
   let p=world_point(a,face,(face.origin[0]+col as f32+0.5)*0.5,(face.origin[1]+row as f32+0.5)*0.5)+face.normal*0.03;
   let mut illumination=v(0.18,0.16,0.135);
   for light in a.lights[..a.light_count].iter(){let to=v(light.position[0],light.position[1],light.position[2]);let d=to-p;let squared=d.len2();if squared>light.radius*light.radius||squared<1e-6{continue}
    let diffuse=(face.normal.dot(d)*inverse_sqrt(squared)).max(0.0);if diffuse<=0.0||!visible(a,p,to){continue}
    illumination=illumination+v(light.color[0],light.color[1],light.color[2])*(light.intensity*diffuse/(1.0+squared*0.22));
   }
   let at=((y+row) as usize*ATLAS+(x+col) as usize)*4;
   for (k,value) in [illumination.x,illumination.y,illumination.z].iter().enumerate(){let quant=(clamp(*value,0.0,1.0)*15.0+0.5) as u32;a.lightmap[at+k]=(quant*255/15) as u8}a.lightmap[at+3]=255;
  }}
 }
}
