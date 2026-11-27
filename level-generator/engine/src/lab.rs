//! Private flat-blockout mesh adapter. Collision/BVH/controller are the snapshot's.
use super::*;
static mut INPUT_POINTS:[i32;MAX_VERTS*3]=[0;MAX_VERTS*3];
static mut INPUT_TRIS:[u32;MAX_TRIS*3]=[0;MAX_TRIS*3];
static mut IMPORTED:bool=false;
static mut LOW:f32=0.0;
static mut HIGH:f32=5.5;
// Column membership from the actual sloped floors and ceilings, using f64
// barycentrics. This avoids the general parity ray's near-hit deduplication.
pub fn column_contains(a:&Arena,p:V3)->Option<bool>{unsafe{
 if !IMPORTED{return None}if !p.finite(){return Some(false)}
 let mut floor=-1e9f32;let mut ceiling=1e9f32;
 spatial::query(a,v(p.x,p.y,LOW-1.0),v(p.x,p.y,HIGH+1.0),|i|{
  let kind=a.tris[i].kind;if kind>1{return true}let t=a.collision[i].p;
  let cross=|a:V3,b:V3,c:V3|(b.x as f64-a.x as f64)*(c.y as f64-a.y as f64)-(b.y as f64-a.y as f64)*(c.x as f64-a.x as f64);
  let den=cross(t[0],t[1],t[2]);if den.abs()<1e-12{return true}
  let u=cross(p,t[1],t[2])/den;let w=cross(t[0],t[1],p)/den;let q=1.0-u-w;
  if u>=-1e-9&&q>=-1e-9&&w>=-1e-9{let z=(u*t[0].z as f64+q*t[1].z as f64+w*t[2].z as f64)as f32;if kind==0{floor=floor.max(z)}else{ceiling=ceiling.min(z)}}true
 });Some(floor> -1e8&&ceiling<1e8&&p.z>floor+0.00001&&p.z<ceiling-0.00001)
}}
// Clip upward structural triangles to the complete box footprint; the highest
// retained point is the support height. This is not a centre-floor sample.
pub fn support(a:&Arena,x:f32,y:f32,r:f32)->f32{unsafe{
 let mut high=-1e9f32;
 spatial::query(a,v(x-r,y-r,LOW-1.0),v(x+r,y+r,HIGH+1.0),|i|{
  if a.tris[i].kind!=0{return true}let mut poly=[v(0.0,0.0,0.0);12];poly[..3].copy_from_slice(&a.collision[i].p);let mut count=3;
  for (axis,limit,sign)in [(0,x-r,1.0),(0,x+r,-1.0),(1,y-r,1.0),(1,y+r,-1.0)]{
   if count==0{break}let mut out=[v(0.0,0.0,0.0);12];let mut n=0;
   for j in 0..count{let a=poly[j];let b=poly[(j+1)%count];let da=(if axis==0{a.x}else{a.y}-limit)*sign;let db=(if axis==0{b.x}else{b.y}-limit)*sign;
    if da>=-0.000001{out[n]=a;n+=1}if (da>=0.0)!=(db>=0.0){let t=da/(da-db);out[n]=a+(b-a)*t;n+=1;}
   }poly=out;count=n;
  }for p in &poly[..count]{high=high.max(p.z);}true
 });high
}}
#[no_mangle]pub extern "C" fn lab_floor(x:f32,y:f32,r:f32)->f32{unsafe{if ACTIVE>=1||![x,y,r].iter().all(|n|n.is_finite())||r<0.0{return -1e9}support(&ARENAS[0],x,y,r)}}
// Grounded traversal uses three continuous SAT sweeps: bounded lift, forward,
// then support contact. Actual risers remain in both render and collision data.
static mut SUPPORT_DEBUG:[f32;12]=[0.0;12];
#[no_mangle]pub extern "C" fn lab_support_debug()->*const f32{unsafe{SUPPORT_DEBUG.as_ptr()}}
pub fn supported_move(p:&mut Player,a:&Arena)->bool{unsafe{
 SUPPORT_DEBUG=[0.0;12];SUPPORT_DEBUG[5]=p.velocity.z;
 if !IMPORTED||!p.box_body||p.velocity.z>2.0{SUPPORT_DEBUG[0]=1.0;return false}let r=p.radius();let exact=support(a,p.feet.x,p.feet.y,r);let padded=support(a,p.feet.x,p.feet.y,r+0.006);let base=if (p.feet.z-exact).abs()<(p.feet.z-padded).abs(){exact}else{padded};
 SUPPORT_DEBUG[1]=base;SUPPORT_DEBUG[2]=exact;SUPPORT_DEBUG[3]=padded;
 if base< -1e8||p.feet.z-base>0.09||p.feet.z-base< -0.003{SUPPORT_DEBUG[0]=2.0;return false}
 let delta=v(p.velocity.x,p.velocity.y,0.0)*physics::STEP as f32;if delta.len2()<1e-12{SUPPORT_DEBUG[0]=3.0;return false}
 let target=support(a,p.feet.x+delta.x,p.feet.y+delta.y,r+0.006);SUPPORT_DEBUG[4]=target;
 if target< -1e8||target-base>0.2501||base-target>0.2501{SUPPORT_DEBUG[0]=4.0;return false}
 let lift=(target+0.004-p.feet.z).max(0.0);SUPPORT_DEBUG[6]=lift;let up=v(0.0,0.0,lift);if lift>0.0&&body::sweep(a,p.feet,r,p.height(),up).is_some(){SUPPORT_DEBUG[0]=5.0;return false}
 let raised=p.feet+up;if let Some((t,n))=body::sweep(a,raised,r,p.height(),delta){SUPPORT_DEBUG[0]=6.0;SUPPORT_DEBUG[7]=t;SUPPORT_DEBUG[8]=n.x;SUPPORT_DEBUG[9]=n.y;SUPPORT_DEBUG[10]=n.z;return false}
 let mut at=raised+delta;let ground_target=support(a,at.x,at.y,r);let down=v(0.0,0.0,-(at.z-target.min(ground_target)+0.04).max(0.04));let Some((t,n))=body::sweep(a,at,r,p.height(),down)else{SUPPORT_DEBUG[0]=7.0;return false};if n.z<0.65{SUPPORT_DEBUG[0]=8.0;return false}at=at+down*t;
 if !p.placement_clear(a,at){SUPPORT_DEBUG[0]=9.0;return false}p.feet=at;p.velocity.z=0.0;p.ground=n;p.grounded=true;p.steps+=1;SUPPORT_DEBUG[0]=10.0;true
}}
#[no_mangle]pub extern "C" fn lab_points()->*mut i32{unsafe{INPUT_POINTS.as_mut_ptr()}}
#[no_mangle]pub extern "C" fn lab_triangles()->*mut u32{unsafe{INPUT_TRIS.as_mut_ptr()}}
#[no_mangle]pub extern "C" fn lab_import(vertices:u32,triangles:u32,seed:u32,x:f32,y:f32,z:f32,height:f32,extent:f32)->u32{unsafe{
 if vertices==0||vertices as usize>MAX_VERTS||triangles==0||triangles as usize>MAX_TRIS||![x,y,z,height,extent].iter().all(|v|v.is_finite())||height<3.0||extent<=0.0{return CAPACITY}
 let a=&mut ARENAS[0];ACTIVE=1;PENDING=0;groups::reset();VOID=false;FREE_TRANSITION=false;
 a.errors=0;a.seed=seed;a.id=seed.wrapping_add(1).max(1);a.n=13;a.tile=(extent*1024.0/13.0)as i32;a.room_height=(height*1024.0)as i32;a.atlas_size=512;a.profile=0;a.detail=0;
 a.vertex_count=vertices as usize;a.tri_count=triangles as usize;a.render_count=0;a.index_count=0;a.face_count=triangles as usize/2;a.wire_count=0;a.open_count=1;a.components=1;a.light_count=0;a.unmatched=0;a.nonmanifold=0;a.intersections=0;a.spawn=v(x,y,z);a.phase_ms=[0.0;4];
 LOW=f32::MAX;HIGH=f32::MIN;
 for i in 0..a.vertex_count{a.vertices[i]=I3{x:INPUT_POINTS[i*3],y:INPUT_POINTS[i*3+1],z:INPUT_POINTS[i*3+2]};a.points[i]=a.vertices[i].point();LOW=LOW.min(a.points[i].z);HIGH=HIGH.max(a.points[i].z);}
 for i in 0..a.tri_count{
  let ids=[INPUT_TRIS[i*3],INPUT_TRIS[i*3+1],INPUT_TRIS[i*3+2]];if ids.iter().any(|&id|id as usize>=a.vertex_count){return BAD_INDEX}
  // Canonical 1/1024 m cells can have a valid cross product of 1/1024².
  // Keep these small conforming tiles instead of introducing unwelded T seams.
  let p=ids.map(|id|a.vertices[id as usize].point());let cross=(p[1]-p[0]).cross(p[2]-p[0]);if !p.iter().all(|p|p.finite())||cross.len2()<1e-15{return DEGENERATE}let normal=cross.unit();
  let kind=if normal.z>0.8{0}else if normal.z< -0.8{1}else{2};a.tris[i]=Tri{ids,owner:0,kind};
  a.collision[i]=CollisionTri{p,normal,lo:p[0].min(p[1]).min(p[2]),hi:p[0].max(p[1]).max(p[2]),pad:0.0};
  for j in 0..3{a.render[a.render_count]=surface::vertex(p[j],v(0.0,0.0,0.0),normal,1.0,if kind==0{100}else if kind==1{101}else{102},0,[-1.0,-1.0]);a.indices[a.index_count]=a.render_count as u32;a.render_count+=1;a.index_count+=1;}
 }
 spatial::build(a);if a.errors!=0{return a.errors}a.geometry_hash=geometry_hash(a);a.ready=true;IMPORTED=true;
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
