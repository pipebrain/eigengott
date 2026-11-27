use crate::{math::*,world::*};
#[derive(Clone,Copy)]struct Edge{a:u32,b:u32,count:u32,balance:i32}
const EMPTY:Edge=Edge{a:0,b:0,count:0,balance:0};
const EDGE_SLOTS:usize=131072;
static mut EDGES:[Edge;EDGE_SLOTS]=[EMPTY;EDGE_SLOTS];

pub fn validate(a:&mut Arena){
 if a.vertex_count>MAX_VERTS||a.tri_count>MAX_TRIS||a.face_count>MAX_FACES{a.errors|=CAPACITY;return}
 let n=a.n;let cells=n*n;
 let mut visited=[false;CELLS];let mut queue=[0usize;CELLS];
 for id in 0..cells{
  if a.cells[id].open==0{continue}let cell=a.cells[id];let x=id%n;let y=id/n;
  for (xx,yy) in [(x,y),(x+1,y),(x+1,y+1),(x,y+1)]{let p=a.grid(xx,yy,false).point();let f=cell.floor[0]*p.x+cell.floor[1]*p.y+cell.floor[2];let c=cell.ceiling[0]*p.x+cell.ceiling[1]*p.y+cell.ceiling[2];if !f.is_finite()||!c.is_finite()||c-f<2.0||(f-p.z).abs()>0.0001||(c-a.grid(xx,yy,true).point().z).abs()>0.0001{a.errors|=BAD_SECTOR}}
  for e in 0..4{
   let xx=x as i32+[0,1,0,-1][e];let yy=y as i32+[-1,0,1,0][e];
   let expected=if xx>=0&&yy>=0&&xx<n as i32&&yy<n as i32&&a.cells[yy as usize*n+xx as usize].open!=0{yy*n as i32+xx}else{-1};
   if cell.neighbors[e]!=expected{a.errors|=BINDING}
   if expected>=0&&a.cells[expected as usize].neighbors[(e+2)%4]!=id as i32{a.errors|=BINDING}
  }
  if !visited[id]{
   a.components+=1;let mut head=0;let mut tail=1;queue[0]=id;visited[id]=true;
   while head<tail{let here=queue[head];head+=1;for next in a.cells[here].neighbors{if next>=0&&(next as usize)<cells&&!visited[next as usize]&&a.cells[next as usize].open!=0{visited[next as usize]=true;queue[tail]=next as usize;tail+=1}}}
  }
 }
 if a.components!=1{a.errors|=DISCONNECTED}
 unsafe{for slot in EDGES.iter_mut(){slot.count=0}}
 for i in 0..a.tri_count{
  let t=a.tris[i];if t.ids.iter().any(|&n|n as usize>=a.vertex_count)||t.owner as usize>=cells{a.errors|=BAD_INDEX;continue}
  let p=t.ids.map(|id|a.vertices[id as usize].point());let cross=(p[1]-p[0]).cross(p[2]-p[0]);
  if !p.iter().all(|p|p.finite())||cross.len2()<1e-10{a.errors|=DEGENERATE;continue}
  if cross.dot(a.center(t.owner as usize)-(p[0]+p[1]+p[2])/3.0)<=0.0{a.errors|=WINDING}
  for e in 0..3{
   let x=t.ids[e];let y=t.ids[(e+1)%3];let lo=x.min(y);let hi=x.max(y);let mut slot=(hash(lo.wrapping_mul(1777)^hi) as usize)&(EDGE_SLOTS-1);let mut found=false;
   for _ in 0..EDGE_SLOTS{let edge=unsafe{&mut EDGES[slot]};if edge.count==0||edge.a==lo&&edge.b==hi{if edge.count==0{edge.a=lo;edge.b=hi;edge.balance=0}edge.count+=1;edge.balance+=if x<y{1}else{-1};found=true;break}slot=(slot+1)&(EDGE_SLOTS-1)}
   if !found{a.errors|=CAPACITY}
  }
 }
 unsafe{for edge in EDGES.iter(){if edge.count==1{a.unmatched+=1}else if edge.count>2{a.nonmanifold+=1}else if edge.count==2&&edge.balance!=0{a.errors|=WINDING}}}
 if a.unmatched>0{a.errors|=LEAK}if a.nonmanifold>0{a.errors|=NON_MANIFOLD}
 if a.errors!=0{return}
 for i in 0..a.tri_count{
  let t=a.tris[i];let p=t.ids.map(|id|a.vertices[id as usize].point());let normal=(p[1]-p[0]).cross(p[2]-p[0]).unit();
  a.collision[i]=CollisionTri{p,normal,lo:p[0].min(p[1]).min(p[2]),hi:p[0].max(p[1]).max(p[2]),pad:if t.kind==2{RIBBED.inward_relief}else{0.0}};
  for e in 0..3{a.wire[i*6+e*2]=t.ids[e];a.wire[i*6+e*2+1]=t.ids[(e+1)%3]}
 }a.wire_count=a.tri_count*6;
 // The grid generator additionally proves non-overlap through canonical cell
 // ownership. This narrow phase catches proper nonadjacent 3D face crossings;
 // it is not advertised as a general arbitrary-mesh CSG validator.
 crate::spatial::build(a);if a.errors!=0{return}
 let mut pairs=0;let mut crossings=0;
 for i in 0..a.tri_count{let t=a.collision[i];crate::spatial::query(a,t.lo,t.hi,|j|{
  if j<=i{return true}let b=a.collision[j];
  if t.hi.x<b.lo.x||b.hi.x<t.lo.x||t.hi.y<b.lo.y||b.hi.y<t.lo.y||t.hi.z<b.lo.z||b.hi.z<t.lo.z{return true}
  if a.tris[i].ids.iter().any(|id|a.tris[j].ids.contains(id)){return true}
  pairs+=1;let mut hit=false;for edge in 0..3{
   hit|=segment_hit(t.p[edge],t.p[(edge+1)%3],b.p[0],b.p[1],b.p[2],true).is_some();
   hit|=segment_hit(b.p[edge],b.p[(edge+1)%3],t.p[0],t.p[1],t.p[2],true).is_some();
  }if hit{crossings+=1}true
 });}a.intersections=crossings;a.intersection_pairs=pairs;if crossings>0{a.errors|=INTERSECTION}
 let mut found=false;for id in 0..n*n{if a.cells[id].open==0{continue}let x=id%n;let y=id/n;if x==0||y==0||x+1==n||y+1==n{continue}if ![-1i32,0,1].iter().all(|dy|[-1i32,0,1].iter().all(|dx|a.cells[(y as i32+dy)as usize*n+(x as i32+dx)as usize].open!=0)){continue}let mut p=a.center(id);p.z=a.floor_at(id,p)+0.035;if crate::physics::capsule_clear(a,p,v(0.0,0.0,1.0),1.75,0.28){a.spawn=p;found=true;break;}}if !found{a.errors|=CLEARANCE}
}
