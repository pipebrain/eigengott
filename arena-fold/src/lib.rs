#![no_std]
#![allow(static_mut_refs,dead_code)]
mod math;mod collision;mod player;mod scene;mod fold;mod mesh;
use math::*;use collision::*;use player::Player;use fold::Fold;use mesh::*;
#[link(wasm_import_module="env")]extern "C"{
 #[link_name="sin"]fn host_sin(x:f64)->f64;
 #[link_name="cos"]fn host_cos(x:f64)->f64;
 #[link_name="sqrt"]fn host_sqrt(x:f64)->f64;
}
#[panic_handler]fn panic(_:&core::panic::PanicInfo)->!{core::arch::wasm32::unreachable()}
static mut PLAYER:Player=Player::EMPTY;static mut CAMERA:Player=Player::EMPTY;
static mut FOLD:Fold=Fold::EMPTY;static mut CAMERA_MODE:u32=0;
static mut ACCUMULATOR:f64=0.0;static mut TIME:f64=0.0;static mut ASPECT:f32=16.0/9.0;
static mut WORLD:Mesh=Mesh::EMPTY;static mut BODY:Mesh=Mesh::EMPTY;static mut LINES:Lines=Lines::EMPTY;
static mut DEBUG:u32=0;
#[repr(C,align(16))]struct Floats<const N:usize>([f32;N]);
static mut FRAME:Floats<32>=Floats([0.0;32]);
#[repr(C,align(16))]struct Stats{words:[u32;16],floats:[f32;32]}
static mut STATS:Stats=Stats{words:[0;16],floats:[0.0;32]};
static mut PANEL:Floats<16>=Floats([0.0;16]);
static mut SHAPES:Floats<16>=Floats([0.0;16]);
#[no_mangle]pub extern "C" fn abi_version()->u32{1}
#[no_mangle]pub extern "C" fn fold_init(){unsafe{FOLD=Fold::EMPTY;fold_reset(0);}}
// Only an explicit scenario reset relocates the player or resets geometry.
#[no_mangle]pub extern "C" fn fold_reset(scenario:u32){unsafe{
 PLAYER=Player::EMPTY;FOLD.phase=0.0;FOLD.target=0.0;FOLD.playing=false;FOLD.blocked=0;FOLD.reason=0;FOLD.holds=0.0;ACCUMULATOR=0.0;TIME=0.0;
 if scenario==1{PLAYER.feet=v(-3.5,1.0,0.035)}
 if scenario==2{PLAYER.feet=v(0.0,4.8,0.035);PLAYER.yaw=core::f32::consts::PI;}
 CAMERA_MODE=0;CAMERA=PLAYER;render();
}}
#[no_mangle]pub extern "C" fn fold_options(enabled:u32,playing:u32,looping:u32,duration:f32,margin:f32){unsafe{
 FOLD.enabled=enabled!=0;FOLD.playing=playing!=0;FOLD.looping=looping!=0;
 if duration.is_finite(){FOLD.duration=clamp(duration,1.0,30.0)}if margin.is_finite(){FOLD.margin=clamp(margin,0.05,0.6)}render();
}}
#[no_mangle]pub extern "C" fn fold_trigger(target:f32){unsafe{if target.is_finite(){FOLD.target=clamp(target,0.0,1.0);FOLD.playing=true;FOLD.holds=0.0;}}}
#[no_mangle]pub extern "C" fn fold_seek(phase:f32)->u32{unsafe{let accepted=FOLD.seek(phase,PLAYER.shapes(),0.0);render();accepted as u32}}
#[no_mangle]pub extern "C" fn fold_tick(dt:f64,bits:u32,dx:f32,dy:f32){unsafe{
 let dt=if dt.is_finite(){dt.max(0.0).min(0.1)}else{0.0};
 if CAMERA_MODE!=0{
  if CAMERA_MODE==1{if dx.is_finite(){CAMERA.yaw+=clamp(dx,-2000.0,2000.0)*0.002;}if dy.is_finite(){CAMERA.pitch=clamp(CAMERA.pitch-dy*0.002,-1.55,1.55);}}
  let(r,f,_)=CAMERA.basis();let motion=f*((bits&1!=0)as i32 as f32-(bits&2!=0)as i32 as f32)+r*((bits&8!=0)as i32 as f32-(bits&4!=0)as i32 as f32)+v(0.0,0.0,1.0)*((bits&16!=0)as i32 as f32-(bits&32!=0)as i32 as f32);
  CAMERA.feet=CAMERA.feet+motion.unit()*dt as f32*8.0;
 }else{PLAYER.look(&scene::boxes(FOLD.phase),dx,dy);}
 ACCUMULATOR+=dt;let mut steps=0;
 while ACCUMULATOR+1e-9>=fold::STEP&&steps<12{
  let before=PLAYER.feet;PLAYER.step(&scene::boxes(FOLD.phase),if CAMERA_MODE==0{bits}else{0});
  FOLD.step(PLAYER.shapes(),(PLAYER.feet-before).len());
  ACCUMULATOR-=fold::STEP;TIME+=fold::STEP;steps+=1;
 }render();
}}
#[no_mangle]pub extern "C" fn fold_place(x:f32,y:f32,z:f32,yaw:f32,pitch:f32)->u32{unsafe{
 if ![x,y,z,yaw,pitch].iter().all(|x|x.is_finite()){return 0}let mut p=PLAYER;p.feet=v(x,y,z);p.yaw=yaw;p.pitch=clamp(pitch,-1.44,1.44);p.velocity=v(0.0,0.0,0.0);p.grounded=false;
 if !p.valid(&scene::boxes(FOLD.phase)){return 0}PLAYER=p;ACCUMULATOR=0.0;render();1
}}
#[no_mangle]pub extern "C" fn fold_clear()->u32{unsafe{PLAYER.valid(&scene::boxes(FOLD.phase)) as u32}}
#[no_mangle]pub extern "C" fn fold_view(width:f32,height:f32){unsafe{if width.is_finite()&&height.is_finite()&&width>0.0&&height>0.0{ASPECT=clamp(width/height,0.1,10.0);render();}}}
#[no_mangle]pub extern "C" fn fold_camera(mode:u32){unsafe{
 CAMERA_MODE=mode.min(2);CAMERA=PLAYER;if CAMERA_MODE==2{CAMERA.feet=v(0.0,-0.1,19.0);CAMERA.pitch=-core::f32::consts::FRAC_PI_2;}render();
}}
#[no_mangle]pub extern "C" fn fold_debug(flags:u32){unsafe{DEBUG=flags&3;render();}}
unsafe fn render(){
 let boxes=scene::boxes(FOLD.phase);WORLD.clear();
 let colors=[rgb(101,104,92),rgb(93,94,82),rgb(119,121,105),rgb(107,113,106),rgb(109,103,86),rgb(125,121,100),rgb(135,138,118),rgb(135,138,118),rgb(114,123,113),rgb(112,100,82)];
 for(i,b)in boxes.iter().enumerate(){WORLD.box3(*b,colors[i],if i<6{1}else{2});}
 BODY.body(PLAYER);LINES.count=0;
 if DEBUG&1!=0{for b in boxes{LINES.box3(b,if b.id<6{rgb(87,115,126)}else if FOLD.blocked&(1<<(b.id-6))!=0{rgb(255,90,67)}else{rgb(214,202,119)});}}
 if DEBUG&2!=0{for(mut s,c)in PLAYER.shapes().into_iter().zip([rgb(100,219,155),rgb(129,173,255)]){s.r+=FOLD.margin;LINES.capsule(s,c);}}
 let p=if CAMERA_MODE==0{PLAYER}else{CAMERA};let(r,f,u)=p.basis();let eye=p.eye();let near=0.04;let far=100.0;let scale=1.3032254;
 let projection=[scale/ASPECT,0.0,0.0,0.0,0.0,scale,0.0,0.0,0.0,0.0,far/(near-far),-1.0,0.0,0.0,near*far/(near-far),0.0];
 let view=[r.x,u.x,-f.x,0.0,r.y,u.y,-f.y,0.0,r.z,u.z,-f.z,0.0,-r.dot(eye),-u.dot(eye),f.dot(eye),1.0];
 FRAME.0[..16].copy_from_slice(&matrix_multiply(projection,view));FRAME.0[16..20].copy_from_slice(&[eye.x,eye.y,eye.z,TIME as f32]);
 FRAME.0[20..24].copy_from_slice(&[r.x,r.y,r.z,0.0]);FRAME.0[24..28].copy_from_slice(&[u.x,u.y,u.z,0.0]);FRAME.0[28..32].copy_from_slice(&[f.x,f.y,f.z,0.0]);
}
#[no_mangle]pub extern "C" fn fold_stats()->*const u32{unsafe{
 let boxes=scene::boxes(FOLD.phase);let shapes=PLAYER.shapes();let mut distances=[f32::MAX;2];for i in 0..2{for b in &boxes[6..]{distances[i]=distances[i].min(separation(shapes[i],*b));}}
 STATS.words=[PLAYER.valid(&boxes)as u32,scene::sealed(&boxes)as u32,scene::bounded(FOLD.phase)as u32,FOLD.blocked,FOLD.reason,FOLD.checks,FOLD.rejections,FOLD.nodes,FOLD.deepest,PLAYER.steps,PLAYER.contacts,PLAYER.blocked_looks,FOLD.playing as u32,FOLD.enabled as u32,CAMERA_MODE,FOLD.looping as u32];
 STATS.floats.fill(0.0);STATS.floats[..16].copy_from_slice(&[FOLD.phase,FOLD.target,FOLD.duration,FOLD.margin,PLAYER.feet.x,PLAYER.feet.y,PLAYER.feet.z,PLAYER.yaw,PLAYER.pitch,distances[0],distances[1],TIME as f32,PLAYER.velocity.x,PLAYER.velocity.y,PLAYER.velocity.z,ACCUMULATOR as f32]);STATS.words.as_ptr()
}}
#[no_mangle]pub extern "C" fn fold_buffer(kind:u32)->*const u8{unsafe{match kind{0=>WORLD.vertices.as_ptr()as _,1=>WORLD.indices.as_ptr()as _,2=>BODY.vertices.as_ptr()as _,3=>BODY.indices.as_ptr()as _,4=>LINES.vertices.as_ptr()as _,_=>FRAME.0.as_ptr()as _}}}
#[no_mangle]pub extern "C" fn fold_bytes(kind:u32)->u32{unsafe{match kind{0=>(WORLD.count*32)as _,1=>(WORLD.index_count*4)as _,2=>(BODY.count*32)as _,3=>(BODY.index_count*4)as _,4=>(LINES.count*16)as _,_=>128}}}
#[no_mangle]pub extern "C" fn fold_panel(id:u32,phase:f32)->*const f32{unsafe{
 let b=scene::panel((id as usize).min(3),clamp(phase,0.0,1.0));PANEL.0=[b.center.x,b.center.y,b.center.z,b.id as f32,b.axes[0].x,b.axes[0].y,b.axes[0].z,b.half.x,b.axes[1].x,b.axes[1].y,b.axes[1].z,b.half.y,b.axes[2].x,b.axes[2].y,b.axes[2].z,b.half.z];PANEL.0.as_ptr()
}}
#[no_mangle]pub extern "C" fn fold_shapes()->*const f32{unsafe{for(i,s)in PLAYER.shapes().iter().enumerate(){SHAPES.0[i*8..i*8+8].copy_from_slice(&[s.p.x,s.p.y,s.p.z,s.r,s.q.x,s.q.y,s.q.z,0.0]);}SHAPES.0.as_ptr()}}
