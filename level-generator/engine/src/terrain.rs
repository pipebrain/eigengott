//! Separable knot heights keep every sector planar and every shared edge canonical.
use crate::{math::*,world::*};
const K:usize=N+1;
static mut INPUT:[f32;8+4*K+3*CELLS]=[0.0;8+4*K+3*CELLS];
static mut OPTIONS:[f32;3]=[4096.0,0.35,0.22];
static mut FALLBACK:bool=false;
#[no_mangle]pub extern "C" fn terrain_input()->*mut f32{unsafe{INPUT.as_mut_ptr()}}
#[no_mangle]pub extern "C" fn terrain_options(height:f32,sky:f32,dark:f32){unsafe{OPTIONS=[height.max(0.0).min(8192.0),sky.max(0.0).min(1.0),dark.max(0.0).min(0.5)];}}
#[no_mangle]pub extern "C" fn terrain_fallback(value:u32){unsafe{FALLBACK=value!=0;}}
pub fn reserved(id:usize)->bool{unsafe{INPUT[0]>0.5&&INPUT[8+4*K+id]>=0.0}}
pub fn patched()->bool{unsafe{INPUT[0]>0.5}}
pub fn patch_header()->[f32;4]{unsafe{[INPUT[1],INPUT[2],INPUT[3],INPUT[4]]}}
fn axis(out:&mut [i32;K],n:usize,seed:u32,range:i32,limit:i32,fixed:&[bool;K],old:usize){
 let value=|i:usize|->i32{let h=hash(seed^(i as u32).wrapping_mul(19237));((h%17)as i32-8)*range/16};
 for i in 0..=n{let k=i/4;out[i]=(value(k)*(4-i%4)as i32+value(k+1)*(i%4)as i32)/4;if fixed[i]{out[i]=unsafe{INPUT[8+old*K+i]as i32};}}
 for _ in 0..=n{for i in 1..=n{if !fixed[i]{out[i]=out[i].clamp(out[i-1]-limit,out[i-1]+limit);}}for i in (0..n).rev(){if !fixed[i]{out[i]=out[i].clamp(out[i+1]-limit,out[i+1]+limit);}}}
}
pub fn prepare(a:&mut Arena){
 let n=a.n;let mut fx=[false;K];let mut fy=fx;
 if patched(){let h=patch_header();if h[0]as usize==n{a.tile=h[1]as i32;a.room_height=h[2]as i32;}}
 for y in 0..n{for x in 0..n{if reserved(y*n+x){fx[x]=true;fx[x+1]=true;fy[y]=true;fy[y+1]=true;}}}
 let range=unsafe{OPTIONS[0]as i32}.min(a.tile*3);let limit=(a.tile/3).max(128);
 axis(&mut a.floor_x,n,a.seed^17,range,limit,&fx,0);axis(&mut a.floor_y,n,a.seed^719,range,limit,&fy,1);
 axis(&mut a.ceil_x,n,a.seed^2917,range,limit,&fx,2);axis(&mut a.ceil_y,n,a.seed^919,range,limit,&fy,3);
 // A separate nonnegative vault profile varies ceilings while preserving headroom.
 for i in 0..=n{if !fx[i]{a.ceil_x[i]=a.floor_x[i]+(a.ceil_x[i].abs()/3).min(1024);}if !fy[i]{a.ceil_y[i]=a.floor_y[i]+(a.ceil_y[i].abs()/3).min(1024);}}
}
pub fn occupy(a:&mut Arena){
 let n=a.n;let mut xs=[false;K];let mut ys=xs;let mut x=4+(hash(a.seed^83)%3)as usize;while x<n-2{xs[x]=true;x+=5+(hash(a.seed^x as u32)%4)as usize;}let mut y=4+(hash(a.seed^431)%3)as usize;while y<n-2{ys[y]=true;y+=5+(hash(a.seed^y as u32^19)%4)as usize;}
 for y in 0..n{for x in 0..n{let id=y*n+x;let mut open=true;
  if xs[x]&&y>0&&y<n-1{let lo=(0..y).rev().find(|&k|ys[k]).unwrap_or(0);let hi=(y+1..n).find(|&k|ys[k]).unwrap_or(n-1);let width=hi-lo;let gap=if a.profile==0{5}else{3}.min(width.saturating_sub(1).max(1));let door=lo+1+(hash(a.seed^x as u32^(lo as u32*77))as usize%(width-gap).max(1));open=y>=door&&y<door+gap;}
  if ys[y]&&x>0&&x<n-1{let lo=(0..x).rev().find(|&k|xs[k]).unwrap_or(0);let hi=(x+1..n).find(|&k|xs[k]).unwrap_or(n-1);let width=hi-lo;let gap=if a.profile==0{5}else{3}.min(width.saturating_sub(1).max(1));let door=lo+1+(hash(a.seed^y as u32^(lo as u32*311))as usize%(width-gap).max(1));open&=x>=door&&x<door+gap;}
  if x>1&&y>1&&x<n-2&&y<n-2&&hash(a.seed^id as u32)%173==0{open=false;}
  if unsafe{FALLBACK}{open=true;}if reserved(id){open=unsafe{INPUT[8+4*K+id]>0.5};}a.cells[id].open=open as u32;
 }}
 // Remove diagonal-only contacts, which otherwise produce nonmanifold corner edges.
 for _ in 0..4{for y in 0..n-1{for x in 0..n-1{let ids=[y*n+x,y*n+x+1,(y+1)*n+x,(y+1)*n+x+1];let v=ids.map(|i|a.cells[i].open!=0);if v==[true,false,false,true]||v==[false,true,true,false]{for i in ids{if a.cells[i].open==0&&!reserved(i){a.cells[i].open=1;break;}}}}}}
 let mut min=f32::MAX;let mut max=f32::MIN;for id in 0..n*n{if a.cells[id].open!=0{let p=a.center(id);let z=a.floor_at(id,p);min=min.min(z);max=max.max(z);}}
 let dark=unsafe{OPTIONS[2]};let sky=unsafe{OPTIONS[1]};a.open_count=0;
 for id in 0..n*n{if a.cells[id].open==0{continue}a.open_count+=1;let p=a.center(id);let z=a.floor_at(id,p);let low=dark>0.0&&max-min>0.25&&z<=min+(max-min).max(0.5)*dark;let scene=if !low&&hash(a.seed^id as u32^995)%1000<(sky*1000.0)as u32{1+(id%n*3/n)as u32}else{0};a.cells[id].floor[3]=low as u32 as f32;a.cells[id].ceiling[3]=scene as f32;
  if reserved(id){a.cells[id].floor[3]=unsafe{INPUT[8+4*K+CELLS+id]};a.cells[id].ceiling[3]=unsafe{INPUT[8+4*K+2*CELLS+id]};}
 }
}
