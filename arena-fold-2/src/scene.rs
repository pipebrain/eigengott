use crate::{math::*,collision::*};
pub const COLS:usize=4;pub const ROWS:usize=5;pub const SECTORS:usize=COLS*ROWS;
pub const VARIANTS:u32=6;pub const MAX_BOXES:usize=6+SECTORS*6;
pub fn fixed(center:V3,half:V3,id:u32)->Box3{Box3{center,half,id,..Box3::EMPTY}}
pub fn center(id:usize)->V3{v(-6.0+(id%COLS)as f32*4.0,-8.0+(id/COLS)as f32*4.0,0.0)}
pub fn sector(p:V3)->Option<usize>{let x=floor((p.x+8.0)/4.0);let y=floor((p.y+10.0)/4.0);if x>=0&&x<COLS as i32&&y>=0&&y<ROWS as i32{Some(y as usize*COLS+x as usize)}else{None}}
pub fn shell()->[Box3;6]{[
 fixed(v(0.0,0.0,-0.25),v(8.5,10.5,0.25),0),fixed(v(0.0,0.0,6.25),v(8.5,10.5,0.25),1),
 fixed(v(-8.25,0.0,3.0),v(0.25,10.5,3.5),2),fixed(v(8.25,0.0,3.0),v(0.25,10.5,3.5),3),
 fixed(v(0.0,-10.25,3.0),v(8.5,0.25,3.5),4),fixed(v(0.0,10.25,3.0),v(8.5,0.25,3.5),5)]}
pub struct Pieces{pub b:[Box3;6],pub len:usize}
pub fn pieces(id:usize,variant:u32)->Pieces{
 let c=center(id);let mut p=Pieces{b:[Box3::EMPTY;6],len:0};
 let mut add=|x:f32,y:f32,z:f32,hx:f32,hy:f32,hz:f32|{p.b[p.len]=fixed(c+v(x,y,z),v(hx,hy,hz),id as u32+6);p.len+=1;};
 // Every catalogue entry is a fixed pose. There is no animation parameter.
 match variant%VARIANTS{
  0=>{add(-1.05,0.0,2.0,0.22,0.35,2.0);add(1.05,0.0,2.0,0.22,0.35,2.0);add(0.0,0.0,4.2,1.27,0.35,0.2);}
  1=>{add(0.0,0.0,2.3,0.6,0.6,2.3);add(0.0,0.0,4.7,0.86,0.86,0.1);}
  2=>{add(-0.25,-0.85,1.8,0.95,0.14,1.8);add(0.25,0.85,2.25,0.95,0.14,2.25);}
  3=>{for x in [-0.95,0.95]{for y in [-0.95,0.95]{add(x,y,2.0,0.18,0.18,2.0);}}add(0.0,-0.95,4.2,1.13,0.18,0.2);add(0.0,0.95,4.2,1.13,0.18,0.2);}
  4=>{add(-0.75,-0.5,0.65,0.55,0.7,0.65);add(0.65,0.65,1.2,0.65,0.65,1.2);add(-0.75,-0.5,1.4,0.32,0.45,0.1);}
  _=>{for y in [-0.95,0.0,0.95]{add(0.0,y,5.1,1.3,0.16,0.9);}}
 }p
}
pub struct Colliders{pub b:[Box3;MAX_BOXES],pub len:usize}
pub fn colliders(layout:&[u32;SECTORS])->Colliders{let mut out=Colliders{b:[Box3::EMPTY;MAX_BOXES],len:6};out.b[..6].copy_from_slice(&shell());for(id,&variant)in layout.iter().enumerate(){let p=pieces(id,variant);for b in &p.b[..p.len]{out.b[out.len]=*b;out.len+=1;}}out}
pub fn safe(id:usize,variant:u32,shapes:[Capsule;2],margin:f32)->u32{
 let p=pieces(id,variant);let mut reason=0;for(i,s)in shapes.iter().enumerate(){if p.b[..p.len].iter().any(|b|separation(*s,*b)<margin-0.00001){reason|=1<<i;}}reason
}
pub fn catalog_valid()->bool{
 for id in 0..SECTORS{for variant in 0..VARIANTS{let p=pieces(id,variant);let c=center(id);
  for b in &p.b[..p.len]{let(lo,hi)=b.bounds();if !lo.finite()||!hi.finite()||lo.x<c.x-1.35||hi.x>c.x+1.35||lo.y<c.y-1.35||hi.y>c.y+1.35||lo.z<0.0||hi.z>6.0{return false}}
 }}true
}
