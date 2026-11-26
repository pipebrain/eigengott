use crate::{math::*,collision::*};
pub const BOXES:usize=10;
pub const WIDTH:f32=8.0;
pub const LENGTH:f32=10.0;
pub const HEIGHT:f32=6.0;
fn fixed(center:V3,half:V3,id:u32)->Box3{Box3{center,half,id,..Box3::EMPTY}}
pub fn panel(id:usize,p:f32)->Box3{
 let pi=core::f32::consts::PI;
 match id{
  0|1=>{let angle=if id==0{-p*pi*0.5}else{pi+p*pi*0.5};let u=v(cos(angle),sin(angle),0.0);let w=v(-sin(angle),cos(angle),0.0);let hinge=v(if id==0{-5.0}else{5.0},3.0,2.4);Box3{center:hinge+u*1.8,axes:[u,w,v(0.0,0.0,1.0)],half:v(1.8,0.12,2.4),id:id as u32+6}}
  2=>{let angle=p*0.65;Box3{center:v(3.0-6.0*p,6.0-4.0*p,2.0),axes:[v(cos(angle),sin(angle),0.0),v(-sin(angle),cos(angle),0.0),v(0.0,0.0,1.0)],half:v(2.2,0.12,2.0),id:8}}
  _=>{let angle=p;let y=v(0.0,cos(angle),sin(angle));let z=v(0.0,-sin(angle),cos(angle));Box3{center:v(0.0,5.0,5.7)-y*2.3,axes:[v(1.0,0.0,0.0),y,z],half:v(1.2,2.3,0.1),id:9}}
 }
}
// Upper bounds on the speed of every point of each box per unit phase.
// center translation + circumradius * angular rate bounds Hausdorff motion.
pub fn motion_bound(id:usize)->f32{match id{0|1=>8.0,2=>9.3,_=>5.0}}
pub fn boxes(p:f32)->[Box3;BOXES]{[
 fixed(v(0.0,0.0,-0.25),v(8.5,10.5,0.25),0),fixed(v(0.0,0.0,6.25),v(8.5,10.5,0.25),1),
 fixed(v(-8.25,0.0,3.0),v(0.25,10.5,3.5),2),fixed(v(8.25,0.0,3.0),v(0.25,10.5,3.5),3),
 fixed(v(0.0,-10.25,3.0),v(8.5,0.25,3.5),4),fixed(v(0.0,10.25,3.0),v(8.5,0.25,3.5),5),
 panel(0,p),panel(1,p),panel(2,p),panel(3,p)
]}
pub fn sealed(b:&[Box3;BOXES])->bool{
 // Exact overlapping outer slabs cover all six boundary planes. Interior
 // moving boxes never replace, resize, or puncture this physical enclosure.
 let expected=boxes(0.0);
 (0..6).all(|i|b[i].center==expected[i].center&&b[i].half==expected[i].half)
}
pub fn bounded(p:f32)->bool{
 (0..4).all(|i|{let(lo,hi)=panel(i,p).bounds();lo.x>=-WIDTH&&hi.x<=WIDTH&&lo.y>=-LENGTH&&hi.y<=LENGTH&&lo.z>=-0.0001&&hi.z<=HEIGHT})
}
