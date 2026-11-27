//! Private flat-blockout mesh adapter. Collision/BVH/controller are the snapshot's.
use super::*;
static mut INPUT_POINTS:[i32;MAX_VERTS*3]=[0;MAX_VERTS*3];
static mut INPUT_TRIS:[u32;MAX_TRIS*3]=[0;MAX_TRIS*3];
#[no_mangle]pub extern "C" fn lab_points()->*mut i32{unsafe{INPUT_POINTS.as_mut_ptr()}}
#[no_mangle]pub extern "C" fn lab_triangles()->*mut u32{unsafe{INPUT_TRIS.as_mut_ptr()}}
#[no_mangle]pub extern "C" fn lab_import(vertices:u32,triangles:u32,seed:u32,x:f32,y:f32,height:f32,extent:f32)->u32{unsafe{
 if vertices==0||vertices as usize>MAX_VERTS||triangles==0||triangles as usize>MAX_TRIS||![x,y,height,extent].iter().all(|v|v.is_finite())||height<3.0||extent<=0.0{return CAPACITY}
 let a=&mut ARENAS[0];ACTIVE=1;PENDING=0;groups::reset();VOID=false;FREE_TRANSITION=false;
 a.errors=0;a.seed=seed;a.id=seed.wrapping_add(1).max(1);a.n=13;a.tile=(extent*1024.0/13.0)as i32;a.room_height=(height*1024.0)as i32;a.atlas_size=512;a.profile=0;a.detail=0;
 a.vertex_count=vertices as usize;a.tri_count=triangles as usize;a.render_count=0;a.index_count=0;a.face_count=triangles as usize/2;a.wire_count=0;a.open_count=1;a.components=1;a.light_count=0;a.unmatched=0;a.nonmanifold=0;a.intersections=0;a.spawn=v(x,y,0.035);a.phase_ms=[0.0;4];
 for i in 0..a.vertex_count{a.vertices[i]=I3{x:INPUT_POINTS[i*3],y:INPUT_POINTS[i*3+1],z:INPUT_POINTS[i*3+2]};a.points[i]=a.vertices[i].point();}
 for i in 0..a.tri_count{
  let ids=[INPUT_TRIS[i*3],INPUT_TRIS[i*3+1],INPUT_TRIS[i*3+2]];if ids.iter().any(|&id|id as usize>=a.vertex_count){return BAD_INDEX}
  // Canonical 1/1024 m cells can have a valid cross product of 1/1024².
  // Keep these small conforming tiles instead of introducing unwelded T seams.
  let p=ids.map(|id|a.vertices[id as usize].point());let cross=(p[1]-p[0]).cross(p[2]-p[0]);if !p.iter().all(|p|p.finite())||cross.len2()<1e-15{return DEGENERATE}let normal=cross.unit();
  let kind=if normal.z>0.8{0}else if normal.z< -0.8{1}else{2};a.tris[i]=Tri{ids,owner:0,kind};
  a.collision[i]=CollisionTri{p,normal,lo:p[0].min(p[1]).min(p[2]),hi:p[0].max(p[1]).max(p[2]),pad:0.0};
  for j in 0..3{a.render[a.render_count]=surface::vertex(p[j],v(0.0,0.0,0.0),normal,1.0,if kind==0{100}else if kind==1{101}else{102},0,[-1.0,-1.0]);a.indices[a.index_count]=a.render_count as u32;a.render_count+=1;a.index_count+=1;}
 }
 spatial::build(a);if a.errors!=0{return a.errors}a.geometry_hash=geometry_hash(a);a.ready=true;
 surface::PALETTE.fill(0);for i in 0..256{let level=if i==100{190}else if i==101{218}else{205};surface::PALETTE[i*4..i*4+4].copy_from_slice(&[level,level,level,255]);}
 PLAYER=Player::EMPTY;PLAYER.feet=a.spawn;PLAYER.profile=1;ACTIVE=0;CAMERA_MODE=0;ACCUMULATOR=0.0;TIME=0.0;ACTIVATIONS=1;
 if !PLAYER.placement_clear(a,a.spawn){ACTIVE=1;return CLEARANCE}render_state();0
}}
#[no_mangle]pub extern "C" fn lab_box_sweep(x:f32,y:f32,z:f32,dx:f32,dy:f32,dz:f32,r:f32,h:f32)->f32{unsafe{
 if ACTIVE>=1||![x,y,z,dx,dy,dz,r,h].iter().all(|v|v.is_finite())||r<=0.0||h<=0.0{return -1.0}
 body::sweep(&ARENAS[0],v(x,y,z),r,h,v(dx,dy,dz)).map(|(t,_)|t).unwrap_or(1.0)
}}
#[no_mangle]pub extern "C" fn lab_box_clear(x:f32,y:f32,z:f32,r:f32,h:f32)->u32{unsafe{
 if ACTIVE>=1{return 0}body::clear(&ARENAS[0],v(x,y,z),r,h)as u32
}}
