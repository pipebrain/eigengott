#![no_std]
#![allow(static_mut_refs)]
mod math;
mod world;
mod validate;
mod physics;
mod surface;
mod spatial;
mod boxes;
mod overlay;
mod body;
mod groups;
mod terrain;
static mut VOID:bool=false;
static mut FREE_TRANSITION:bool=false;
static mut LANDING:V3=V3{x:0.0,y:0.0,z:0.0};
use math::*;
use world::*;
use physics::Player;

#[link(wasm_import_module="env")]
extern "C"{
 #[link_name="sin"]fn host_sin(value:f64)->f64;
 #[link_name="cos"]fn host_cos(value:f64)->f64;
 #[link_name="atan2"]fn host_atan2(y:f64,x:f64)->f64;
 #[link_name="sqrt"]fn host_sqrt(value:f64)->f64;
 #[link_name="now"]fn host_now()->f64;
 #[link_name="progress"]fn host_progress(phase:u32);
}
#[panic_handler]fn panic(_:&core::panic::PanicInfo)->!{core::arch::wasm32::unreachable()}
// All fields have valid zero representations. BSS avoids embedding megabytes
// of mostly empty arena buffers in the downloadable WASM binary.
static mut ARENAS:[Arena;1]=unsafe{core::mem::zeroed()};
static mut ACTIVE:usize=1;
static mut PENDING:usize=0;
static mut SERIAL:u32=0;
static mut ACTIVATIONS:u32=0;
static mut PLAYER:Player=Player::EMPTY;
static mut ACCUMULATOR:f64=0.0;
static mut TIME:f64=0.0;
static mut ASPECT:f32=16.0/9.0;
static mut ZOOM:bool=false;
#[no_mangle]pub extern "C" fn engine_zoom(value:u32){unsafe{ZOOM=value!=0;render_state();}}
static mut OPTIONS:[f32;4]=[0.0,1.0,1.0,0.0];
#[repr(C,align(16))]struct Frame{data:[f32;24]}
static mut FRAME:Frame=Frame{data:[0.0;24]};
#[repr(C,align(16))]struct Stats{words:[u32;32],floats:[f32;32]}
const _: [();96]=[();core::mem::size_of::<Frame>()];
const _: [();256]=[();core::mem::size_of::<Stats>()];
const _: [();16]=[();core::mem::align_of::<Frame>()];
const _: [();16]=[();core::mem::align_of::<Stats>()];
static mut STATS:Stats=Stats{words:[0;32],floats:[0.0;32]};
const BODY_VERTICES:usize=512;
static mut BODY_VERTS:[Vertex;BODY_VERTICES]=[Vertex::EMPTY;BODY_VERTICES];
static mut BODY_INDICES:[u32;768]=[0;768];
static mut BODY_COUNT:usize=0;
static mut BODY_INDEX_COUNT:usize=0;

#[no_mangle]pub extern "C" fn abi_version()->u32{4}
static mut CONFIG:[u32;4]=[0,12,2,1];
static mut PALETTE_READY:bool=false;
static mut CAMERA_MODE:u32=0;
static mut CAMERA:Player=Player::EMPTY;
#[no_mangle]pub extern "C" fn engine_init(seed:u32)->u32{engine_build(seed,0,0,12,2,1)}
// This module is an isolated arena factory/player, not a multi-arena transaction.
// The host preserves the active instance while a worker builds another instance.
#[no_mangle]pub extern "C" fn engine_build(seed:u32,fault:u32,profile:u32,lights:u32,density:u32,detail:u32)->u32{unsafe{
 groups::reset();VOID=false;FREE_TRANSITION=false;ACTIVE=1;PENDING=0;SERIAL=SERIAL.wrapping_add(1).max(1);ACTIVATIONS=0;PLAYER=Player::EMPTY;CAMERA_MODE=0;ACCUMULATOR=0.0;TIME=0.0;CONFIG=[profile.min(2),lights,density,detail];
 if !PALETTE_READY{surface::palette();PALETTE_READY=true;}engine_prepare(seed,fault)
}}
#[no_mangle]pub extern "C" fn engine_prepare(seed:u32,fault:u32)->u32{unsafe{
 if ACTIVE<1{return BAD_SECTOR}let a=&mut ARENAS[0];
 host_progress(1);let start=host_now();a.generate(seed,SERIAL,fault,CONFIG[0],CONFIG[1],CONFIG[2],CONFIG[3]);let generated=host_now();
 host_progress(2);validate::validate(a);a.geometry_hash=geometry_hash(a);let validated=host_now();
 host_progress(3);if a.errors==0{surface::mesh(a)}let meshed=host_now();
 host_progress(4);// Dynamic emitters only: no lightmap bake.
 let baked=host_now();
 let mut player=Player::EMPTY;player.feet=a.spawn;if a.errors==0&&!player.placement_clear(a,a.spawn){a.errors|=CLEARANCE}
 a.phase_ms=[(generated-start) as f32,(validated-generated) as f32,(meshed-validated) as f32,(baked-meshed) as f32];a.ready=a.errors==0;a.errors
}}
#[no_mangle]pub extern "C" fn engine_activate(id:u32)->u32{unsafe{
 let a=&ARENAS[PENDING];if !a.ready||a.errors!=0||a.id!=id{return 0}
 let mut p=PLAYER;if ACTIVE>=1{p=Player::EMPTY;p.feet=a.spawn}
 if !p.placement_clear(a,p.feet){p.feet=a.spawn;p.velocity=v(0.0,0.0,0.0);if !p.placement_clear(a,p.feet){p.yaw=0.0;p.pitch=0.0;p.up=v(0.0,0.0,1.0)}}
 if !p.placement_clear(a,p.feet){return 0}p.grounded=false;p.previous=0;
 PLAYER=p;ACTIVE=PENDING;ACCUMULATOR=0.0;ACTIVATIONS+=1;render_state();1
}}
#[no_mangle]pub extern "C" fn engine_tick(dt:f64,bits:u32,look_x:f32,look_y:f32){unsafe{
 if ACTIVE>=1{return}let a=&ARENAS[ACTIVE];
 if VOID{if FREE_TRANSITION{PLAYER.yaw+=clamp(look_x,-2000.0,2000.0)*0.002;PLAYER.pitch=clamp(PLAYER.pitch-look_y*0.002,-1.44,1.44);let(r,f,_)=PLAYER.basis();let motion=v(f.x,f.y,0.0).unit()*((bits&1!=0)as i32 as f32-(bits&2!=0)as i32 as f32)+r*((bits&8!=0)as i32 as f32-(bits&4!=0)as i32 as f32);let dt=dt.max(0.0).min(0.1)as f32;PLAYER.velocity.x=motion.x*6.0;PLAYER.velocity.y=motion.y*6.0;PLAYER.feet.x+=PLAYER.velocity.x*dt;PLAYER.feet.y+=PLAYER.velocity.y*dt;}let delta=if dt.is_finite(){dt.max(0.0).min(0.1) as f32}else{0.0};if FREE_TRANSITION{PLAYER.velocity.z=0.0;PLAYER.feet.z=PLAYER.feet.z.max(LANDING.z);}else{PLAYER.velocity.z=(PLAYER.velocity.z-22.0*delta).max(-24.0);PLAYER.feet.z+=PLAYER.velocity.z*delta;}PLAYER.grounded=false;TIME+=delta as f64;render_state();return}
 if CAMERA_MODE!=0&&CAMERA_MODE!=3{
  let dt=if dt.is_finite(){dt.max(0.0).min(0.1) as f32}else{0.0};
  if CAMERA_MODE==1{CAMERA.yaw+=clamp(look_x,-2000.0,2000.0)*0.002;CAMERA.pitch=clamp(CAMERA.pitch-look_y*0.002,-1.55,1.55);}
  let(r,f,_)=CAMERA.basis();let up=v(0.0,0.0,1.0);
  let motion=f*((bits&1!=0) as i32 as f32-(bits&2!=0) as i32 as f32)+r*((bits&8!=0) as i32 as f32-(bits&4!=0) as i32 as f32)+up*((bits&16!=0) as i32 as f32-(bits&32!=0) as i32 as f32);
  CAMERA.feet=CAMERA.feet+motion.unit()*dt*if bits&64!=0{60.0}else{20.0};render_state();return
 }if FREE_TRANSITION&&!physics::inside(a,PLAYER.feet+v(0.0,0.0,PLAYER.height()*0.5)){PLAYER.yaw+=clamp(look_x,-2000.0,2000.0)*0.002;PLAYER.pitch=clamp(PLAYER.pitch-look_y*0.002,-1.44,1.44);}else{PLAYER.look(a,look_x,look_y);}
 if dt.is_finite()&&dt>0.0{ACCUMULATOR+=dt.min(0.1);let mut steps=0;while ACCUMULATOR+1e-9>=physics::STEP&&steps<12{PLAYER.step(a,bits);ACCUMULATOR-=physics::STEP;TIME+=physics::STEP;steps+=1}}
 render_state();
}}
#[no_mangle]pub extern "C" fn engine_view(width:f32,height:f32){unsafe{if width.is_finite()&&height.is_finite()&&width>0.0&&height>0.0{ASPECT=width/height;render_state()}}}
#[no_mangle]pub extern "C" fn engine_options(wire:u32,relief:f32,lighting:u32){unsafe{OPTIONS[0]=if wire!=0{1.0}else{0.0};OPTIONS[1]=if relief.is_finite(){clamp(relief,0.0,1.0)}else{1.0};OPTIONS[2]=if lighting!=0{1.0}else{0.0};render_state()}}
#[no_mangle]pub extern "C" fn engine_reset_player(){unsafe{if ACTIVE<1{let a=&ARENAS[ACTIVE];PLAYER=Player::EMPTY;PLAYER.feet=a.spawn;ACCUMULATOR=0.0;render_state()}}}
#[no_mangle]pub extern "C" fn engine_try_place(x:f32,y:f32,z:f32,yaw:f32,pitch:f32)->u32{unsafe{
 if ACTIVE>=1||![x,y,z,yaw,pitch].iter().all(|n|n.is_finite()){return 0}let mut p=PLAYER;p.feet=v(x,y,z);p.yaw=yaw;p.pitch=clamp(pitch,-1.44,1.44);
 if !p.placement_clear(&ARENAS[ACTIVE],p.feet){return 0}p.velocity=v(0.0,0.0,0.0);p.grounded=false;PLAYER=p;ACCUMULATOR=0.0;render_state();1
}}
#[no_mangle]pub extern "C" fn engine_player_clear()->u32{unsafe{(ACTIVE<1&&PLAYER.placement_clear(&ARENAS[ACTIVE],PLAYER.feet)) as u32}}
#[no_mangle]pub extern "C" fn engine_contains(x:f32,y:f32,z:f32)->u32{unsafe{(ACTIVE<1&&physics::inside(&ARENAS[ACTIVE],v(x,y,z))) as u32}}
#[no_mangle]pub extern "C" fn engine_sweep_test(x:f32,y:f32,z:f32,dx:f32,dy:f32,dz:f32)->f32{unsafe{
 if ACTIVE>=1{return -1.0}let p=v(x,y,z)+v(0.0,0.0,physics::RADIUS);let q=v(x,y,z)+v(0.0,0.0,physics::HEIGHT-physics::RADIUS);
 physics::sweep(&ARENAS[ACTIVE],p,q,physics::RADIUS,v(dx,dy,dz)).map(|(t,_)|t).unwrap_or(1.0)
}}

fn geometry_hash(a:&Arena)->u32{
 let mut result=0x811c9dc5u32;for p in &a.vertices[..a.vertex_count]{for n in [p.x,p.y,p.z]{result=(result^n as u32).wrapping_mul(16777619)}}
 for t in &a.tris[..a.tri_count]{for n in t.ids{result=(result^n).wrapping_mul(16777619)}}result
}
#[no_mangle]pub extern "C" fn stats_ptr()->*const u8{unsafe{
 let s=&mut STATS;s.words.fill(0);s.floats.fill(0.0);let b=&ARENAS[PENDING];
 s.words[0]=4;s.words[3]=b.id;s.words[4]=b.seed;s.words[5]=b.ready as u32;s.words[6]=b.errors;s.words[14]=b.open_count as u32;s.words[15]=b.tri_count as u32;s.words[16]=b.render_count as u32;s.words[17]=b.index_count as u32;
 s.words[18]=b.unmatched;s.words[19]=b.nonmanifold;s.words[20]=b.components;s.words[21]=b.intersections;s.words[22]=PLAYER.grounded as u32;s.words[23]=PLAYER.steps;s.words[24]=PLAYER.hits;s.words[25]=PLAYER.up_blocked;s.words[26]=MAX_RENDER as u32;s.words[27]=MAX_INDICES as u32;s.words[29]=b.geometry_hash;s.words[30]=ACTIVATIONS;s.words[31]=(core::mem::size_of::<Arena>()) as u32;
 if ACTIVE<1{let a=&ARENAS[ACTIVE];s.words[1]=a.id;s.words[2]=a.seed;s.words[7]=a.open_count as u32;s.words[8]=a.vertex_count as u32;s.words[9]=a.tri_count as u32;s.words[10]=a.render_count as u32;s.words[11]=a.index_count as u32;s.words[12]=a.face_count as u32;s.words[13]=a.light_count as u32;s.words[28]=a.geometry_hash;s.floats[16]=a.n as f32*a.tile as f32/1024.0;s.floats[17]=a.room_height as f32/1024.0;}
 let p=PLAYER;s.floats[..9].copy_from_slice(&[p.feet.x,p.feet.y,p.feet.z,p.velocity.x,p.velocity.y,p.velocity.z,p.yaw,p.pitch,TIME as f32]);s.floats[9..13].copy_from_slice(&b.phase_ms);s.floats[13..16].copy_from_slice(&[b.spawn.x,b.spawn.y,b.spawn.z]);s.floats[18..21].copy_from_slice(&[p.up.x,p.up.y,p.up.z]);
 core::ptr::addr_of!(STATS) as *const u8
}}
#[no_mangle]pub extern "C" fn candidate_id()->u32{unsafe{ARENAS[PENDING].id}}
#[no_mangle]pub extern "C" fn candidate_vbo_ptr()->*const Vertex{unsafe{ARENAS[PENDING].render.as_ptr()}}
#[no_mangle]pub extern "C" fn candidate_vbo_bytes()->u32{unsafe{ARENAS[PENDING].render_count as u32*32}}
#[no_mangle]pub extern "C" fn candidate_ibo_ptr()->*const u32{unsafe{ARENAS[PENDING].indices.as_ptr()}}
#[no_mangle]pub extern "C" fn candidate_ibo_count()->u32{unsafe{ARENAS[PENDING].index_count as u32}}
#[no_mangle]pub extern "C" fn candidate_points_ptr()->*const V3{unsafe{ARENAS[PENDING].points.as_ptr()}}
#[no_mangle]pub extern "C" fn candidate_points_bytes()->u32{unsafe{ARENAS[PENDING].vertex_count as u32*12}}
#[no_mangle]pub extern "C" fn candidate_wire_ptr()->*const u32{unsafe{ARENAS[PENDING].wire.as_ptr()}}
#[no_mangle]pub extern "C" fn candidate_wire_count()->u32{unsafe{ARENAS[PENDING].wire_count as u32}}
#[no_mangle]pub extern "C" fn candidate_lightmap_ptr()->*const u8{unsafe{ARENAS[PENDING].lightmap.as_ptr()}}
#[no_mangle]pub extern "C" fn candidate_lights_ptr()->*const Light{unsafe{ARENAS[PENDING].lights.as_ptr()}}
#[no_mangle]pub extern "C" fn candidate_light_count()->u32{unsafe{ARENAS[PENDING].light_count as u32}}
#[no_mangle]pub extern "C" fn palette_ptr()->*const u8{core::ptr::addr_of!(surface::PALETTE) as *const u8}
#[no_mangle]pub extern "C" fn lut_ptr()->*const u8{core::ptr::addr_of!(surface::LUT) as *const u8}
#[no_mangle]pub extern "C" fn frame_ptr()->*const u8{core::ptr::addr_of!(FRAME) as *const u8}
#[no_mangle]pub extern "C" fn body_vbo_ptr()->*const Vertex{core::ptr::addr_of!(BODY_VERTS) as *const Vertex}
#[no_mangle]pub extern "C" fn body_vbo_bytes()->u32{unsafe{BODY_COUNT as u32*32}}
#[no_mangle]pub extern "C" fn body_ibo_ptr()->*const u32{core::ptr::addr_of!(BODY_INDICES) as *const u32}
#[no_mangle]pub extern "C" fn body_ibo_count()->u32{unsafe{BODY_INDEX_COUNT as u32}}
#[no_mangle]pub extern "C" fn active_cells_ptr()->*const Cell{unsafe{if ACTIVE<1{ARENAS[ACTIVE].cells.as_ptr()}else{core::ptr::null()}}}
#[no_mangle]pub extern "C" fn cell_stride()->u32{core::mem::size_of::<Cell>() as u32}
// Buffer ABI: 0 vertices, 1 indices, 2 structural points, 3 structural edges,
// 4 RGBA lightmap, 5 light descriptors. `candidate=0` reads the active arena.
#[no_mangle]pub extern "C" fn arena_buffer_ptr(kind:u32,candidate:u32)->*const u8{unsafe{
 let index=if candidate!=0{PENDING}else{ACTIVE};if index>=1{return core::ptr::null()}let a=&ARENAS[index];
 match kind{0=>a.render.as_ptr() as *const u8,1=>a.indices.as_ptr() as *const u8,2=>a.points.as_ptr() as *const u8,3=>a.wire.as_ptr() as *const u8,4=>a.lightmap.as_ptr(),5=>a.lights.as_ptr() as *const u8,_=>core::ptr::null()}
}}
#[no_mangle]pub extern "C" fn arena_buffer_bytes(kind:u32,candidate:u32)->u32{unsafe{
 let index=if candidate!=0{PENDING}else{ACTIVE};if index>=1{return 0}let a=&ARENAS[index];
 match kind{0=>(a.render_count*32) as u32,1=>(a.index_count*4) as u32,2=>(a.vertex_count*12) as u32,3=>(a.wire_count*4) as u32,4=>(a.atlas_size*a.atlas_size*4) as u32,5=>(a.light_count*32) as u32,_=>0}
}}

unsafe fn render_state(){
 if ACTIVE>=1{return}let p=if CAMERA_MODE==0{PLAYER}else if CAMERA_MODE==3{let mut p=PLAYER;let(_,f,_)=PLAYER.basis();let forward=(f-v(0.0,0.0,f.z)).unit();let eye=PLAYER.eye();let delta=-forward*4.0+v(0.0,0.0,0.9);let fraction=physics::sweep(&ARENAS[0],eye,eye,0.12,delta).map(|(t,_)|(t-0.02).max(0.0)).unwrap_or(1.0);let camera_eye=eye+delta*fraction;p.feet=camera_eye-(p.eye()-p.feet);let look=PLAYER.feet+v(0.0,0.0,1.05)-camera_eye;p.yaw=host_atan2(look.x as f64,look.y as f64)as f32;p.pitch=host_atan2(look.z as f64,sqrt(look.x*look.x+look.y*look.y)as f64)as f32;p}else{CAMERA};let(r,f,u)=p.basis();let eye=p.eye();let near=0.04;let far=600.0;let scale=if ZOOM{3.7320508}else{1.3032254};
 let projection=[scale/ASPECT,0.0,0.0,0.0,0.0,scale,0.0,0.0,0.0,0.0,far/(near-far),-1.0,0.0,0.0,near*far/(near-far),0.0];
 let view=[r.x,u.x,-f.x,0.0,r.y,u.y,-f.y,0.0,r.z,u.z,-f.z,0.0,-r.dot(eye),-u.dot(eye),f.dot(eye),1.0];
 FRAME.data[..16].copy_from_slice(&matrix_multiply(projection,view));FRAME.data[16..20].copy_from_slice(&[eye.x,eye.y,eye.z,TIME as f32]);OPTIONS[3]=ARENAS[ACTIVE].light_count as f32;FRAME.data[20..24].copy_from_slice(&OPTIONS);
 build_body(PLAYER);
}
unsafe fn body_quad(points:[V3;4],normal:V3,material:u32){
 if BODY_COUNT+4>BODY_VERTICES||BODY_INDEX_COUNT+6>768{return}let start=BODY_COUNT as u32;
 for (i,p) in points.iter().enumerate(){BODY_VERTS[BODY_COUNT+i]=surface::vertex(*p,v(0.0,0.0,0.0),normal,0.9,material,surface::BODY,[-1.0,-1.0])}
 for (i,n) in [0,1,2,0,2,3].iter().enumerate(){BODY_INDICES[BODY_INDEX_COUNT+i]=start+n}BODY_COUNT+=4;BODY_INDEX_COUNT+=6;
}
unsafe fn body_box(center:V3,right:V3,forward:V3,up:V3,half:V3,material:u32){
 let mut points=[v(0.0,0.0,0.0);8];for(i,[x,y,z])in [[-1.0,-1.0,-1.0],[1.0,-1.0,-1.0],[1.0,1.0,-1.0],[-1.0,1.0,-1.0],[-1.0,-1.0,1.0],[1.0,-1.0,1.0],[1.0,1.0,1.0],[-1.0,1.0,1.0]].iter().enumerate(){points[i]=center+right*(*x*half.x)+forward*(*y*half.y)+up*(*z*half.z)}
 for face in [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]{let p=face.map(|i|points[i]);body_quad(p,(p[1]-p[0]).cross(p[2]-p[0]).unit(),material)}
}
unsafe fn build_body(p:Player){
 BODY_COUNT=0;BODY_INDEX_COUNT=0;let(r,f,u)=p.basis();let up=p.up;let forward=(f-up*f.dot(up)).unit();
 body_box(p.feet+up*1.03,r,forward,up,v(0.21,0.12,0.31),181);
 for sign in [-1.0,1.0]{
  body_box(p.feet+r*(sign*0.11)+up*0.43,r,forward,up,v(0.085,0.095,0.32),147);
  let n=if p.grounded{p.ground}else{up};let mut base=p.feet+r*(sign*0.11)+forward*0.035;
  if p.grounded{base=base-up*(n.dot(base-p.feet)/n.dot(up).max(0.1))}
  let boot_r=(r-n*r.dot(n)).unit();let boot_f=n.cross(boot_r).unit();body_box(base+n*0.08,boot_r,boot_f,n,v(0.095,0.15,0.075),140);
 }
 let eye=p.eye();let hand=eye+r*0.16+f*0.28-u*0.32;
 for sign in [-1.0,1.0]{let shoulder=p.feet+up*1.34+r*(sign*0.23);let end=hand+r*(sign*0.035);let long=(end-shoulder).unit();let side=long.cross(up).unit();let other=side.cross(long).unit();body_box((shoulder+end)*0.5,side,other,long,v(0.055,0.055,(end-shoulder).len()*0.5),181)}
 body_box(eye+r*0.16+f*0.43-u*0.18,r,f,u,v(0.06,0.20,0.06),145);
 body_box(eye+r*0.16+f*0.76-u*0.16,r,f,u,v(0.028,0.14,0.028),151);
 body_box(eye+r*0.16+f*0.31-u*0.29,r,f,u,v(0.045,0.06,0.11),26);
}

#[repr(C,align(16))]struct Bench{words:[u32;32]}
static mut BENCH:Bench=Bench{words:[0;32]};
#[no_mangle]pub extern "C" fn bench_ptr()->*const u32{unsafe{
 let a=&ARENAS[0];BENCH.words.fill(0);BENCH.words[..16].copy_from_slice(&[a.profile,a.n as u32,a.atlas_size as u32,a.density as u32,a.detail,a.requested_lights as u32,a.texels,a.rays,a.ray_steps,a.node_count as u32,a.intersection_pairs,core::mem::size_of::<Arena>() as u32,PLAYER.profile,CAMERA_MODE,MAX_TRIS as u32,MAX_FACES as u32]);BENCH.words.as_ptr()
}}
#[no_mangle]pub extern "C" fn engine_profile(profile:u32){unsafe{
 PLAYER.profile=profile.min(1);PLAYER.velocity=v(0.0,0.0,0.0);PLAYER.previous=0;
 if ACTIVE<1&&!PLAYER.placement_clear(&ARENAS[0],PLAYER.feet){
  PLAYER.feet=ARENAS[0].spawn;PLAYER.grounded=false;
  if !PLAYER.placement_clear(&ARENAS[0],PLAYER.feet){PLAYER.yaw=0.0;PLAYER.pitch=0.0;}
 }render_state();
}}
#[no_mangle]pub extern "C" fn engine_camera_mode(mode:u32){unsafe{
 CAMERA_MODE=mode.min(3);CAMERA=PLAYER;
 if CAMERA_MODE==2{CAMERA.feet=v(0.0,0.0,ARENAS[0].n as f32*ARENAS[0].tile as f32/1024.0*0.8+ARENAS[0].room_height as f32/1024.0);CAMERA.pitch=-core::f32::consts::FRAC_PI_2;CAMERA.yaw=0.0;}
 render_state();
}}
#[no_mangle]pub extern "C" fn engine_inherit_player(x:f32,y:f32,z:f32,vx:f32,vy:f32,vz:f32,yaw:f32,pitch:f32,time:f64,profile:u32,steps:u32)->u32{unsafe{
 if ACTIVE>=1{return 0}let mut p=PLAYER;p.feet=v(x,y,z);p.velocity=v(vx,vy,vz);p.yaw=yaw;p.pitch=pitch;p.profile=profile.min(1);p.steps=steps;
 let retained=if p.feet.finite()&&p.velocity.finite()&&yaw.is_finite()&&pitch.is_finite()&&p.placement_clear(&ARENAS[0],p.feet){PLAYER=p;1}else{PLAYER.profile=profile.min(1);PLAYER.steps=steps;0};
 TIME=if time.is_finite(){time.max(0.0)}else{0.0};ACCUMULATOR=0.0;render_state();retained
}}
// The trusted same-build worker transfers only an internal linear-memory image.
// Stack bytes are excluded. __heap_base bounds the static image; no allocator.
#[no_mangle]pub extern "C" fn image_start()->u32{262144}
#[no_mangle]pub extern "C" fn engine_import_check()->u32{unsafe{
 let a=&ARENAS[0];(ACTIVE==0&&a.ready&&a.errors==0&&[13,25,49].contains(&a.n)&&a.vertex_count<=MAX_VERTS&&a.tri_count<=MAX_TRIS&&a.render_count<=MAX_RENDER&&a.index_count<=MAX_INDICES&&a.node_count<=a.nodes.len()&&[512,1024].contains(&a.atlas_size)&&PLAYER.placement_clear(a,PLAYER.feet)) as u32
}}

#[no_mangle]pub extern "C" fn atlas_size()->u32{unsafe{ARENAS[0].atlas_size as u32}}

#[no_mangle]pub extern "C" fn overlay_commit(count:u32)->u32{unsafe{overlay::install(count,PLAYER,!(VOID&&FREE_TRANSITION))}}
#[no_mangle]pub extern "C" fn player_proxies()->*const f32{unsafe{overlay::proxies(PLAYER)}}
#[no_mangle]pub extern "C" fn engine_proxy_clear(x:f32,y:f32,z:f32,yaw:f32,pitch:f32)->u32{unsafe{if ACTIVE>=1||![x,y,z,yaw,pitch].iter().all(|v|v.is_finite()){return 0}let mut p=PLAYER;p.feet=v(x,y,z);p.yaw=yaw;p.pitch=pitch;p.placement_clear(&ARENAS[0],p.feet)as u32}}

// Interactive-test ABI: bounded physical queries and actor stepping. No renderer
// or input bindings live in the WASM module.
static mut ACTOR:[f32;32]=[0.0;32];
static mut TRACE:[f32;12]=[0.0;12];
#[no_mangle]pub extern "C" fn actor_input()->*mut f32{unsafe{ACTOR.as_mut_ptr()}}
unsafe fn actor_player()->Player{let mut p=Player::EMPTY;p.feet=v(ACTOR[0],ACTOR[1],ACTOR[2]);p.velocity=v(ACTOR[3],ACTOR[4],ACTOR[5]);p.yaw=ACTOR[6];p.pitch=ACTOR[7];p.grounded=ACTOR[8]>0.5;p.crouched=ACTOR[9]>0.5;p.body_radius=ACTOR[10].max(0.34).min(4.0);p.body_height=ACTOR[11].max(1.0).min(8.0);p.eye_height=ACTOR[12].max(0.6).min(p.body_height-0.05);p.gun_length=ACTOR[13].max(0.3).min(4.0);p.gun_radius=ACTOR[14].max(0.1).min(1.5);p.profile=ACTOR[15]as u32;p.previous=ACTOR[16]as u32;p.gun_start=ACTOR[17];p.gun_right=ACTOR[18];p.gun_down=ACTOR[19];p.box_body=ACTOR[20]>0.5;p.gun_pivot=ACTOR[21];p.crouch_height=ACTOR[22].max(0.6).min(p.body_height);p.speed_scale=if ACTOR[23]>0.0{ACTOR[23].max(0.4).min(1.4)}else{1.0};p}
#[no_mangle]pub extern "C" fn actor_clear()->u32{unsafe{if ACTIVE>=1||!ACTOR[..23].iter().all(|n|n.is_finite()){return 0}let p=actor_player();p.placement_clear(&ARENAS[0],p.feet)as u32}}
#[no_mangle]pub extern "C" fn actor_tick(bits:u32,dx:f32,dy:f32)->u32{unsafe{
 if ACTIVE>=1||!ACTOR[..23].iter().all(|n|n.is_finite()){return 0}let mut p=actor_player();let a=&ARENAS[0];if !p.placement_clear(a,p.feet){return 0}p.look(a,dx,dy);let before=p;p.step(a,bits);if !p.placement_clear(a,p.feet){p=before;}
 ACTOR[..10].copy_from_slice(&[p.feet.x,p.feet.y,p.feet.z,p.velocity.x,p.velocity.y,p.velocity.z,p.yaw,p.pitch,p.grounded as u32 as f32,p.crouched as u32 as f32]);ACTOR[16]=p.previous as f32;1
}}
#[no_mangle]pub extern "C" fn engine_equipment(radius:f32,height:f32,eye:f32,length:f32,gun_radius:f32,start:f32,right:f32,down:f32,boxed:u32,pivot:f32,crouch_height:f32)->u32{unsafe{
 if ACTIVE>=1||![radius,height,eye,length,gun_radius,start,right,down,pivot,crouch_height].iter().all(|n|n.is_finite())||radius<0.34||radius>4.0||height<1.0||height>8.0||eye<0.6||eye>height||length<0.3||length>4.0||gun_radius<0.1||gun_radius>1.5{return 0}
 let mut p=PLAYER;p.body_radius=radius;p.body_height=height;p.eye_height=eye;p.gun_length=length;p.gun_radius=gun_radius;p.gun_start=start;p.gun_right=right;p.gun_down=down;p.box_body=boxed!=0;p.gun_pivot=pivot;p.crouch_height=crouch_height.max(0.6).min(height);let valid=if VOID{true}else{p.placement_clear(&ARENAS[0],p.feet)};if !valid{return 0}PLAYER=p;render_state();1
}}
#[no_mangle]pub extern "C" fn engine_impulse(x:f32,y:f32,z:f32){unsafe{if [x,y,z].iter().all(|n|n.is_finite()){PLAYER.velocity=PLAYER.velocity+v(x,y,z);}}}
#[no_mangle]pub extern "C" fn engine_pose_ptr()->*const f32{unsafe{ACTOR[..20].copy_from_slice(&[PLAYER.feet.x,PLAYER.feet.y,PLAYER.feet.z,PLAYER.velocity.x,PLAYER.velocity.y,PLAYER.velocity.z,PLAYER.yaw,PLAYER.pitch,PLAYER.grounded as u32 as f32,PLAYER.crouched as u32 as f32,PLAYER.radius(),PLAYER.height(),(PLAYER.eye()-PLAYER.feet).z,PLAYER.gun_length,PLAYER.gun_radius,PLAYER.profile as f32,PLAYER.previous as f32,PLAYER.gun_start,PLAYER.gun_right,PLAYER.gun_down]);ACTOR.as_ptr()}}
#[no_mangle]pub extern "C" fn engine_cast(x:f32,y:f32,z:f32,qx:f32,qy:f32,qz:f32,r:f32)->*const f32{unsafe{
 TRACE.fill(0.0);TRACE[0]=1.0;if ACTIVE>=1||![x,y,z,qx,qy,qz,r].iter().all(|n|n.is_finite()){return TRACE.as_ptr()}let p=v(x,y,z);let q=v(qx,qy,qz);let a=&ARENAS[0];let mut best=1.0;let mut normal=v(0.0,0.0,0.0);let mut id=0;
 if r>0.001{if let Some((t,n))=physics::sweep(a,p,p,r.min(1.0),q-p){best=t;normal=n;}}
 else{spatial::ray(a,p,q,|i|{let tri=a.collision[i];if let Some(t)=segment_hit(p,q,tri.p[0],tri.p[1],tri.p[2],false){if t<best&&t>=0.0{best=t;normal=tri.normal;}}true});if let Some((t,n,key))=overlay::trace(p,q){if t<best{best=t;normal=n;id=key;}}}
 let hit=p+(q-p)*best;TRACE[..8].copy_from_slice(&[best,normal.x,normal.y,normal.z,hit.x,hit.y,hit.z,id as f32]);TRACE.as_ptr()
}}
// Small contact corrections from the bounded actor broadphase retain velocity
// and support state; unlike an explicit test placement they do not respawn.
#[no_mangle]pub extern "C" fn engine_actor_contact(x:f32,y:f32,z:f32,vx:f32,vy:f32,vz:f32)->u32{unsafe{
 if ACTIVE>=1||![x,y,z,vx,vy,vz].iter().all(|n|n.is_finite()){return 0}let feet=v(x,y,z);if !PLAYER.placement_clear(&ARENAS[0],feet){return 0}PLAYER.feet=feet;PLAYER.velocity=v(vx,vy,vz);render_state();1
}}
#[no_mangle]pub extern "C" fn actor_proxies()->*const f32{unsafe{overlay::proxies(actor_player())}}

#[no_mangle]pub extern "C" fn engine_speed_scale(scale:f32){unsafe{if scale.is_finite(){PLAYER.speed_scale=scale.max(0.4).min(1.4);}}}

// The void is a deliberate gameplay state, never an invalid collision recovery.
#[no_mangle]pub extern "C" fn engine_void_begin(x:f32,y:f32,z:f32)->u32{unsafe{
 if ACTIVE>=1||VOID||![x,y,z].iter().all(|v|v.is_finite()){return 0}let mut p=PLAYER;p.feet=v(x,y,z);
 if !FREE_TRANSITION&&!groups::all(||p.placement_clear(&ARENAS[0],p.feet)){return 0}LANDING=p.feet;VOID=true;if !FREE_TRANSITION{PLAYER.velocity=v(0.0,0.0,-1.0);}PLAYER.grounded=false;CAMERA_MODE=0;render_state();1
}}
#[no_mangle]pub extern "C" fn engine_void_land()->u32{unsafe{
 if ACTIVE>=1||!VOID{return 0}let mut p=PLAYER;p.feet=LANDING;
 if !p.placement_clear(&ARENAS[0],p.feet){return 0}
 for lift in [0.7,0.4,0.15,0.0]{let q=LANDING+v(0.0,0.0,lift);if p.placement_clear(&ARENAS[0],q){p.feet=q;break}}
 p.velocity=v(0.0,0.0,-2.0);p.grounded=false;PLAYER=p;VOID=false;ACCUMULATOR=0.0;render_state();1
}}
#[no_mangle]pub extern "C" fn engine_void_active()->u32{unsafe{VOID as u32}}

#[no_mangle]pub extern "C" fn actor_clear_full()->u32{unsafe{if ACTIVE>=1{return 0}let p=actor_player();groups::all(||p.placement_clear(&ARENAS[0],p.feet))as u32}}

#[no_mangle]pub extern "C" fn terrain_knots()->*const i32{unsafe{ARENAS[0].floor_x.as_ptr()}}
#[no_mangle]pub extern "C" fn engine_apply_actor()->u32{unsafe{if ACTIVE>=1{return 0}let p=actor_player();if !p.placement_clear(&ARENAS[0],p.feet){return 0}PLAYER=p;ACCUMULATOR=0.0;render_state();1}}
#[no_mangle]pub extern "C" fn terrain_tile()->u32{unsafe{ARENAS[0].tile as u32}}
#[no_mangle]pub extern "C" fn terrain_height()->u32{unsafe{ARENAS[0].room_height as u32}}

#[no_mangle]pub extern "C" fn engine_transition_mode(enabled:u32){unsafe{FREE_TRANSITION=enabled!=0;}}
#[no_mangle]pub extern "C" fn engine_void_pose(x:f32,y:f32,z:f32,yaw:f32,pitch:f32,vx:f32,vy:f32,vz:f32)->u32{unsafe{if !VOID||![x,y,z,yaw,pitch,vx,vy,vz].iter().all(|n|n.is_finite()){return 0}PLAYER.feet=v(x,y,z);PLAYER.yaw=yaw;PLAYER.pitch=clamp(pitch,-1.44,1.44);PLAYER.velocity=v(vx,vy,vz);render_state();1}}
#[no_mangle]pub extern "C" fn engine_void_finish()->u32{unsafe{if ACTIVE>=1||!PLAYER.placement_clear(&ARENAS[ACTIVE],PLAYER.feet){return 0}VOID=false;PLAYER.velocity=v(0.0,0.0,0.0);ACCUMULATOR=0.0;render_state();1}}
