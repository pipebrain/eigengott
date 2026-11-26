#![no_std]
#![allow(static_mut_refs,dead_code)]
mod math;mod collision;mod player;mod scene;mod wave;mod mesh;
use math::*;use player::Player;use wave::Wave;use mesh::*;use scene::SECTORS;
#[link(wasm_import_module="env")]extern "C"{
 #[link_name="sin"]fn host_sin(x:f64)->f64;
 #[link_name="cos"]fn host_cos(x:f64)->f64;
 #[link_name="sqrt"]fn host_sqrt(x:f64)->f64;
}
#[panic_handler]fn panic(_:&core::panic::PanicInfo)->!{core::arch::wasm32::unreachable()}
static mut PLAYER:Player=Player::EMPTY;static mut CAMERA:Player=Player::EMPTY;static mut CAMERA_MODE:u32=0;
static mut WAVE:Wave=Wave::EMPTY;static mut ACCUMULATOR:f64=0.0;static mut TIME:f64=0.0;static mut ASPECT:f32=16.0/9.0;
static mut WORLD:Mesh=Mesh::EMPTY;static mut BODY:Mesh=Mesh::EMPTY;static mut LINES:Lines=Lines::EMPTY;
static mut DEBUG:u32=0;static mut CUTAWAY:bool=false;static mut SHOW_PLAYER:bool=true;static mut SHOW_CORPSES:bool=true;
static mut KEYS:[i32;SECTORS]=[-99;SECTORS];static mut MESH_REVISION:u32=0;
#[repr(C,align(16))]struct Floats<const N:usize>([f32;N]);
static mut FRAME:Floats<32>=Floats([0.0;32]);static mut PIECE:Floats<16>=Floats([0.0;16]);
#[repr(C,align(16))]struct Stats{words:[u32;32],floats:[f32;32]}
static mut STATS:Stats=Stats{words:[0;32],floats:[0.0;32]};
static mut SECTOR_DATA:[u32;SECTORS*16]=[0;SECTORS*16];
#[no_mangle]pub extern "C" fn abi_version()->u32{2}
#[no_mangle]pub extern "C" fn fold_init(seed:u32){unsafe{WAVE.reset(seed);PLAYER=Player::EMPTY;PLAYER.feet=v(0.0,-8.5,0.035);CAMERA=PLAYER;CAMERA_MODE=0;ACCUMULATOR=0.0;TIME=0.0;KEYS.fill(-99);render();}}
#[no_mangle]pub extern "C" fn wave_options(enabled:u32,looping:u32,spread:f32,coherence:f32,delay:f32,duration:f32,hz:f32,blank:f32,jitter:f32,roots:u32,depth:u32,margin:f32,tail:f32,interval:f32,stage_bodies:u32){unsafe{
 WAVE.enabled=enabled!=0;WAVE.looping=looping!=0;WAVE.stage_bodies=stage_bodies!=0;
 let sanitize=|x:f32,old:f32,lo:f32,hi:f32|if x.is_finite(){clamp(x,lo,hi)}else{old};
 WAVE.spread=sanitize(spread,WAVE.spread,0.0,1.0);WAVE.coherence=sanitize(coherence,WAVE.coherence,0.0,1.0);WAVE.delay=sanitize(delay,WAVE.delay,0.08,2.0);WAVE.duration=sanitize(duration,WAVE.duration,0.25,4.0);WAVE.hz=sanitize(hz,WAVE.hz,2.0,30.0);WAVE.blank=sanitize(blank,WAVE.blank,0.0,1.0);WAVE.jitter=sanitize(jitter,WAVE.jitter,0.0,0.8);WAVE.margin=sanitize(margin,WAVE.margin,0.05,0.6);WAVE.tail=sanitize(tail,WAVE.tail,0.1,3.0);WAVE.interval=sanitize(interval,WAVE.interval,0.25,10.0);WAVE.roots=roots.clamp(1,8);WAVE.depth=depth.min(12);render();
}}
#[no_mangle]pub extern "C" fn wave_start()->u32{unsafe{let ok=WAVE.start();render();ok as u32}}
#[no_mangle]pub extern "C" fn wave_pause(playing:u32){unsafe{WAVE.playing=playing!=0;}}
#[no_mangle]pub extern "C" fn wave_seed(seed:u32){unsafe{WAVE.seed=seed;}}
#[no_mangle]pub extern "C" fn wave_stage_bodies(){unsafe{WAVE.bodies=true;render();}}
#[no_mangle]pub extern "C" fn wave_step(){unsafe{if WAVE.enabled{let playing=WAVE.playing;WAVE.playing=true;WAVE.step(PLAYER);WAVE.playing=playing;render();}}}
#[no_mangle]pub extern "C" fn fold_render_options(cutaway:u32,show_player:u32,show_corpses:u32){unsafe{if CUTAWAY!=(cutaway!=0){KEYS.fill(-99);}CUTAWAY=cutaway!=0;SHOW_PLAYER=show_player!=0;SHOW_CORPSES=show_corpses!=0;render();}}
#[no_mangle]pub extern "C" fn fold_tick(dt:f64,bits:u32,dx:f32,dy:f32){unsafe{
 let dt=if dt.is_finite(){dt.max(0.0).min(0.1)}else{0.0};let colliders=scene::colliders(&WAVE.layout);
 if CAMERA_MODE!=0{
  if CAMERA_MODE==1{if dx.is_finite(){CAMERA.yaw+=clamp(dx,-2000.0,2000.0)*0.002;}if dy.is_finite(){CAMERA.pitch=clamp(CAMERA.pitch-dy*0.002,-1.55,1.55);}}
  let(r,f,_)=CAMERA.basis();let motion=f*((bits&1!=0)as i32 as f32-(bits&2!=0)as i32 as f32)+r*((bits&8!=0)as i32 as f32-(bits&4!=0)as i32 as f32)+v(0.0,0.0,1.0)*((bits&16!=0)as i32 as f32-(bits&32!=0)as i32 as f32);CAMERA.feet=CAMERA.feet+motion.unit()*dt as f32*8.0;
 }else{PLAYER.look(&colliders.b[..colliders.len],dx,dy);}
 ACCUMULATOR+=dt;let mut steps=0;while ACCUMULATOR+1e-9>=wave::STEP&&steps<12{
  let colliders=scene::colliders(&WAVE.layout);PLAYER.step(&colliders.b[..colliders.len],if CAMERA_MODE==0{bits}else{0});WAVE.step(PLAYER);ACCUMULATOR-=wave::STEP;TIME+=wave::STEP;steps+=1;
 }render();
}}
#[no_mangle]pub extern "C" fn fold_place(x:f32,y:f32,z:f32,yaw:f32,pitch:f32)->u32{unsafe{
 if ![x,y,z,yaw,pitch].iter().all(|x|x.is_finite()){return 0}let mut p=PLAYER;p.feet=v(x,y,z);p.yaw=yaw;p.pitch=clamp(pitch,-1.44,1.44);p.velocity=v(0.0,0.0,0.0);p.grounded=false;let b=scene::colliders(&WAVE.layout);if !p.valid(&b.b[..b.len]){return 0}PLAYER=p;ACCUMULATOR=0.0;render();1
}}
#[no_mangle]pub extern "C" fn fold_clear()->u32{unsafe{let b=scene::colliders(&WAVE.layout);PLAYER.valid(&b.b[..b.len])as u32}}
#[no_mangle]pub extern "C" fn fold_view(width:f32,height:f32){unsafe{if width.is_finite()&&height.is_finite()&&width>0.0&&height>0.0{ASPECT=clamp(width/height,0.1,10.0);render();}}}
#[no_mangle]pub extern "C" fn fold_camera(mode:u32){unsafe{CAMERA_MODE=mode.min(2);CAMERA=PLAYER;if CAMERA_MODE==2{CAMERA.feet=v(0.0,-0.1,19.0);CAMERA.pitch=-core::f32::consts::FRAC_PI_2;}render();}}
#[no_mangle]pub extern "C" fn fold_debug(flags:u32){unsafe{DEBUG=flags&7;render();}}
fn color(variant:u32)->u32{[rgb(127,129,113),rgb(115,122,111),rgb(130,121,103),rgb(109,119,116),rgb(126,113,95),rgb(115,118,102)][variant as usize%6]}
unsafe fn world_mesh(){
 let keys=core::array::from_fn(|id|WAVE.visible(id));if keys==KEYS{return}KEYS=keys;MESH_REVISION+=1;WORLD.clear();
 for id in 0..SECTORS{let variant=keys[id];if variant<0{continue}let c=scene::center(id);let flags=((id as u32+1)<<8)|2;
  WORLD.box3(scene::fixed(c+v(0.0,0.0,-0.125),v(2.0,2.0,0.125),0),rgb(93,99,91),flags);
  if !CUTAWAY{WORLD.box3(scene::fixed(c+v(0.0,0.0,6.125),v(2.0,2.0,0.125),0),rgb(88,92,82),flags);}
  if id%4==0{WORLD.box3(scene::fixed(v(-8.125,c.y,3.0),v(0.125,2.0,3.0),0),rgb(109,116,105),flags);}
  if id%4==3{WORLD.box3(scene::fixed(v(8.125,c.y,3.0),v(0.125,2.0,3.0),0),rgb(103,113,108),flags);}
  if id/4==0{WORLD.box3(scene::fixed(v(c.x,-10.125,3.0),v(2.0,0.125,3.0),0),rgb(116,110,93),flags);}
  if id/4==4{WORLD.box3(scene::fixed(v(c.x,10.125,3.0),v(2.0,0.125,3.0),0),rgb(111,115,103),flags);}
  let p=scene::pieces(id,variant as u32);for &b in &p.b[..p.len]{WORLD.box3(b,color(variant as u32),flags);}
 }
}
unsafe fn body_mesh(){
 if SHOW_PLAYER{BODY.body(PLAYER);}else{BODY.clear();}
 if WAVE.bodies&&SHOW_CORPSES{for id in [0,2,5,10,13,18]{let c=scene::center(id)+v(1.65,0.0,0.0);
  for(offset,half,tint)in [(v(0.0,0.6,0.16),v(0.14,0.15,0.14),rgb(120,122,105)),(v(0.0,0.13,0.16),v(0.17,0.3,0.13),rgb(112,104,83)),(v(-0.08,-0.4,0.11),v(0.07,0.25,0.08),rgb(65,77,70)),(v(0.08,-0.4,0.11),v(0.07,0.25,0.08),rgb(65,77,70)),(v(-0.21,0.13,0.12),v(0.035,0.3,0.055),rgb(112,104,83)),(v(0.21,0.13,0.12),v(0.035,0.3,0.055),rgb(112,104,83)),(v(0.17,-0.2,0.13),v(0.035,0.3,0.04),rgb(139,141,119))]{BODY.box3(scene::fixed(c+offset,half,0),tint,16);}
 }}
}
unsafe fn render(){
 world_mesh();body_mesh();LINES.count=0;
 if DEBUG&1!=0{let b=scene::colliders(&WAVE.layout);for &piece in &b.b[..b.len]{LINES.box3(piece,rgb(172,172,125));}}
 if DEBUG&2!=0{for(mut s,c)in PLAYER.shapes().into_iter().zip([rgb(100,219,155),rgb(129,173,255)]){s.r+=WAVE.margin;LINES.capsule(s,c);}}
 if DEBUG&4!=0{for id in 0..SECTORS{let state=WAVE.nodes[id].state;let tint=match state{1=>rgb(207,167,90),2=>rgb(239,239,220),3=>rgb(109,199,136),4=>rgb(235,110,80),_=>rgb(94,122,129)};LINES.box3(scene::fixed(scene::center(id)+v(0.0,0.0,3.0),v(1.99,1.99,3.0),0),tint);}}
 let p=if CAMERA_MODE==0{PLAYER}else{CAMERA};let(r,f,u)=p.basis();let eye=p.eye();let near=0.04;let far=100.0;let scale=1.3032254;
 let projection=[scale/ASPECT,0.0,0.0,0.0,0.0,scale,0.0,0.0,0.0,0.0,far/(near-far),-1.0,0.0,0.0,near*far/(near-far),0.0];let view=[r.x,u.x,-f.x,0.0,r.y,u.y,-f.y,0.0,r.z,u.z,-f.z,0.0,-r.dot(eye),-u.dot(eye),f.dot(eye),1.0];FRAME.0[..16].copy_from_slice(&matrix_multiply(projection,view));FRAME.0[16..20].copy_from_slice(&[eye.x,eye.y,eye.z,TIME as f32]);FRAME.0[20..24].copy_from_slice(&[r.x,r.y,r.z,0.0]);FRAME.0[24..28].copy_from_slice(&[u.x,u.y,u.z,0.0]);FRAME.0[28..32].copy_from_slice(&[f.x,f.y,f.z,0.0]);
}
#[no_mangle]pub extern "C" fn fold_stats()->*const u32{unsafe{
 let b=scene::colliders(&WAVE.layout);let ages=WAVE.epochs.map(|e|WAVE.id.saturating_sub(e));
 STATS.words=[PLAYER.valid(&b.b[..b.len])as u32,1,scene::catalog_valid()as u32,WAVE.active as u32,WAVE.playing as u32,WAVE.id,WAVE.completed,WAVE.visited,WAVE.changed,WAVE.protected,WAVE.pending(),WAVE.bodies as u32,WAVE.body_clears,WAVE.previews,WAVE.preview_blocks,PLAYER.steps,MESH_REVISION,CAMERA_MODE,WAVE.enabled as u32,WAVE.looping as u32,WAVE.tick,WAVE.event_count,ages.iter().copied().max().unwrap_or(0),b.len as u32,WAVE.nodes.iter().filter(|n|n.root).count()as u32,WAVE.nodes.iter().filter(|n|n.state==2).count()as u32,WAVE.stage_bodies as u32,WAVE.seed,PLAYER.blocked_looks,0,0,0];
 STATS.floats.fill(0.0);STATS.floats[..16].copy_from_slice(&[PLAYER.feet.x,PLAYER.feet.y,PLAYER.feet.z,PLAYER.yaw,PLAYER.pitch,TIME as f32,WAVE.tick as f32/120.0,WAVE.spread*(1.0-WAVE.coherence),WAVE.coherence,WAVE.margin,PLAYER.velocity.x,PLAYER.velocity.y,PLAYER.velocity.z,ACCUMULATOR as f32,0.0,0.0]);STATS.words.as_ptr()
}}
#[no_mangle]pub extern "C" fn wave_sectors()->*const u32{unsafe{for id in 0..SECTORS{let n=WAVE.nodes[id];SECTOR_DATA[id*16..id*16+16].copy_from_slice(&[id as u32,WAVE.layout[id],WAVE.visible(id)as u32,n.state,n.parent as u32,n.depth,WAVE.id.saturating_sub(WAVE.epochs[id]),WAVE.epochs[id],n.root as u32,n.slot,n.due,n.start,n.finish,n.target,n.reason,0]);}SECTOR_DATA.as_ptr()}}
#[no_mangle]pub extern "C" fn wave_events()->*const wave::Event{unsafe{WAVE.events.as_ptr()}}
#[no_mangle]pub extern "C" fn wave_piece(id:u32,variant:u32,index:u32)->*const f32{unsafe{let p=scene::pieces((id as usize).min(SECTORS-1),variant);let b=p.b[(index as usize).min(p.len-1)];PIECE.0=[b.center.x,b.center.y,b.center.z,p.len as f32,b.axes[0].x,b.axes[0].y,b.axes[0].z,b.half.x,b.axes[1].x,b.axes[1].y,b.axes[1].z,b.half.y,b.axes[2].x,b.axes[2].y,b.axes[2].z,b.half.z];PIECE.0.as_ptr()}}
#[no_mangle]pub extern "C" fn fold_buffer(kind:u32)->*const u8{unsafe{match kind{0=>WORLD.vertices.as_ptr()as _,1=>WORLD.indices.as_ptr()as _,2=>BODY.vertices.as_ptr()as _,3=>BODY.indices.as_ptr()as _,4=>LINES.vertices.as_ptr()as _,_=>FRAME.0.as_ptr()as _}}}
#[no_mangle]pub extern "C" fn fold_bytes(kind:u32)->u32{unsafe{match kind{0=>(WORLD.count*32)as _,1=>(WORLD.index_count*4)as _,2=>(BODY.count*32)as _,3=>(BODY.index_count*4)as _,4=>(LINES.count*16)as _,_=>128}}}
