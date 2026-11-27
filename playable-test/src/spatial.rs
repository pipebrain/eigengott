//! Bounded 3D BVH shared by validation and physical queries.
use crate::{math::*,world::*};
#[repr(C)]#[derive(Clone,Copy)]
pub struct Node{pub lo:V3,pub first:u32,pub hi:V3,pub count:u32}
const BRANCH:u32=1<<31;
pub fn build(a:&mut Arena){
 a.node_count=0;for i in 0..a.tri_count{a.order[i]=i as u32;}
 if a.tri_count>0{branch(a,0,a.tri_count);}
}
fn branch(a:&mut Arena,start:usize,end:usize)->u32{
 let id=a.node_count;if id>=a.nodes.len(){a.errors|=CAPACITY;return 0}a.node_count+=1;
 let mut lo=v(f32::MAX,f32::MAX,f32::MAX);let mut hi=-lo;
 for &i in &a.order[start..end]{let t=a.collision[i as usize];lo=lo.min(t.lo);hi=hi.max(t.hi);}
 a.nodes[id]=Node{lo,hi,first:start as u32,count:(end-start) as u32};
 if end-start>8{
  let extent=hi-lo;let axis=if extent.x>=extent.y&&extent.x>=extent.z{0}else if extent.y>=extent.z{1}else{2};
  let triangles=&a.collision;let center=|i:u32|{let t=triangles[i as usize];match axis{0=>t.lo.x+t.hi.x,1=>t.lo.y+t.hi.y,_=>t.lo.z+t.hi.z}};
  a.order[start..end].sort_unstable_by(|x,y|center(*x).total_cmp(&center(*y)).then(x.cmp(y)));
  let middle=(start+end)/2;let left=branch(a,start,middle);let right=branch(a,middle,end);
  a.nodes[id].first=left;a.nodes[id].count=right|BRANCH;
 }id as u32
}
pub fn query(a:&Arena,lo:V3,hi:V3,mut visit:impl FnMut(usize)->bool){
 traverse(a,|n|!(hi.x<n.lo.x||lo.x>n.hi.x||hi.y<n.lo.y||lo.y>n.hi.y||hi.z<n.lo.z||lo.z>n.hi.z),&mut visit);
}
pub fn ray(a:&Arena,p:V3,q:V3,mut visit:impl FnMut(usize)->bool){
 let delta=q-p;
 traverse(a,|n|{
  let mut near=0.0f32;let mut far=1.0f32;
  for (origin,d,lo,hi) in [(p.x,delta.x,n.lo.x,n.hi.x),(p.y,delta.y,n.lo.y,n.hi.y),(p.z,delta.z,n.lo.z,n.hi.z)]{
   if d.abs()<1e-9{if origin<lo||origin>hi{return false}}
   else{let x=(lo-origin)/d;let y=(hi-origin)/d;near=near.max(x.min(y));far=far.min(x.max(y));if near>far{return false}}
  }true
 },&mut visit);
}
fn traverse(a:&Arena,intersects:impl Fn(Node)->bool,visit:&mut impl FnMut(usize)->bool){
 if a.node_count==0{return}let mut stack=[0u32;64];let mut count=1;
 while count>0{
  count-=1;let node=a.nodes[stack[count] as usize];if !intersects(node){continue}
  if node.count&BRANCH!=0{stack[count]=node.first;stack[count+1]=node.count&!BRANCH;count+=2;}
  else{for i in node.first..node.first+node.count{let id=a.order[i as usize] as usize;if crate::groups::visible(a,a.tris[id].owner as usize)&&!visit(id){return}}}
 }
}
