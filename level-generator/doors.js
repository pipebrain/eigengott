// Structural leaves only: the same boxes drive rendering, SAT collision and sound.
import {floorAt} from './elevation.js';
export const DOOR_SPEED=4; // full stroke in 0.25 seconds
export const DOOR_TYPES=['up','down','split-horizontal','split-vertical'];
export function makeDoors(plan){plan.doors=[];for(const h of plan.hallways){if(h.shape==='curved')continue;const a=plan.rooms[h.a],b=plan.rooms[h.b],axis=a.grid[1]===b.grid[1]?0:1;let p=h.points.reduce((best,p)=>Math.hypot(p[0]-a.cx,p[1]-a.cy)<Math.hypot(best[0]-a.cx,best[1]-a.cy)?p:best,h.points[0]).slice();const sign=Math.sign((axis?b.cy:b.cx)-(axis?a.cy:a.cx));p[axis]=axis?(sign>0?a.y1+3:a.y0-3):(sign>0?a.x1+3:a.x0-3);if(h.shape==='straight')p[1-axis]=axis?a.cx:a.cy;const floor=floorAt(plan,...p);plan.doors.push({id:plan.doors.length,hallway:h.id,room:h.a,axis,position:p,floor,top:floor+plan.ceiling,width:h.width,thickness:.3,type:DOOR_TYPES[plan.doors.length%4],closedLossDb:24});}plan.summary.doors=plan.doors.length;}
export function doorBoxes(d,open){
 const height=d.top-d.floor,along=d.axis,across=1-along,base=[...d.position,d.floor+height/2],half=[0,0,height/2];half[along]=d.thickness/2;half[across]=d.width/2;
 const box=(centre,size)=>({centre,half:size,id:d.id,category:1});
 if(open>=1)return[];
 if(d.type==='up'||d.type==='down'){base[2]+=(d.type==='up'?1:-1)*open*height;return[box(base,half)];}
 const k=d.type==='split-horizontal'?across:2,span=k===2?height:d.width;half[k]/=2;return[-1,1].map(sign=>{const c=base.slice();c[k]+=sign*(span/4+open*span/2);return box(c,half.slice());});
}
const overlaps=(a,b)=>a.centre.every((v,k)=>Math.abs(v-b.centre[k])<a.half[k]+b.half[k]+.04);
export function createDoors(plan){const states=plan.doors.map(d=>({id:d.id,open:0,hold:0,mode:'closed'}));let revision=0,serial=0,droppedEvents=0;const events=[];const emit=(d,kind,direction)=>{const parts=d.type.startsWith('split')?2:1;for(let part=0;part<parts;part++){if(events.length>=64){droppedEvents++;continue;}const position=[...d.position,d.floor+(d.top-d.floor)/2];if(parts===2){const axis=d.type==='split-horizontal'?1-d.axis:2;position[axis]+=(part?1:-1)*(axis===2?(d.top-d.floor):d.width)/4;}events.push({id:++serial,door:d.id,part,parts,kind,direction,position});}};return{
 states,drainEvents(){return events.splice(0);},get droppedEvents(){return droppedEvents;},get revision(){return revision;},boxes(){return plan.doors.flatMap((d,i)=>doorBoxes(d,states[i].open));},loss(id){return (plan.doors[id]?.closedLossDb||0)*(1-states[id].open);},
 update(dt,actors=[]){if(!(dt>0&&dt<=.25))throw Error('Door timestep must be in (0,.25].');for(const d of plan.doors){const s=states[d.id],old=s.open,near=actors.some(a=>Math.abs(a.centre[d.axis]-d.position[d.axis])<a.half[d.axis]+4&&Math.abs(a.centre[1-d.axis]-d.position[1-d.axis])<d.width/2+a.half[1-d.axis]&&a.centre[2]+a.half[2]>d.floor&&a.centre[2]-a.half[2]<d.top);if(near)s.hold=1;else s.hold=Math.max(0,s.hold-dt);let next=Math.max(0,Math.min(1,s.open+(s.hold>0?1:-1)*dt*DOOR_SPEED));if(next<s.open){const before=doorBoxes(d,s.open),after=doorBoxes(d,next),swept=after.map((b,i)=>{const a=before[i]||b;return{centre:b.centre.map((v,k)=>(v+a.centre[k])/2),half:b.half.map((v,k)=>v+Math.abs(b.centre[k]-a.centre[k])/2)};});if(actors.some(a=>swept.some(b=>overlaps(a,b)))){s.hold=1;next=Math.min(1,s.open+dt*DOOR_SPEED);}}
 if(next>1-1e-9)next=1;if(next<1e-9)next=0;
 if(next!==old){const direction=next>old?'opening':'closing';if(s.mode!==direction)emit(d,'start',direction);if(next===0||next===1)emit(d,'finish',direction);}
 s.open=next;s.mode=next===1?'open':next===0?'closed':next>old?'opening':'closing';if(next!==old)revision++;}return this.boxes();},
 reset(){events.length=0;for(const s of states)Object.assign(s,{open:0,hold:0,mode:'closed'});revision++;}
 };}
export function actorBounds(p,r,h){return{centre:[p[0],p[1],p[2]+h/2],half:[r,r,h/2]};}
export function installDoors(sim,boxes){const input=new Float32Array(sim.memory.buffer,sim.overlay_input(),boxes.length*8);boxes.forEach((b,i)=>input.set([...b.centre,...b.half,b.category,b.id],i*8));const code=sim.overlay_commit(boxes.length);if(code)throw Error('Door overlay rejected: '+code);}
