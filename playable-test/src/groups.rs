//! Rendering and collision share the same canonical cell-group visibility.
use crate::world::*;
static mut SPAN:usize=0;
static mut VISIBLE:[bool;CELLS]=[true;CELLS];
pub fn reset(){unsafe{SPAN=0;VISIBLE.fill(true);}}
pub fn visible(a:&Arena,owner:usize)->bool{unsafe{if SPAN==0{return true}let cols=(a.n+SPAN-1)/SPAN;VISIBLE[(owner%a.n)/SPAN+(owner/a.n)/SPAN*cols]}}
pub fn all<T>(f:impl FnOnce()->T)->T{unsafe{let old=SPAN;SPAN=0;let value=f();SPAN=old;value}}
#[no_mangle]pub extern "C" fn engine_group_layout(span:u32){unsafe{SPAN=(span as usize).clamp(1,8);VISIBLE.fill(true);}}
#[no_mangle]pub extern "C" fn engine_group_visible(id:u32,on:u32)->u32{unsafe{if id as usize>=CELLS{return 0}VISIBLE[id as usize]=on!=0;1}}
