// Sky portals shade the sealed structural shell; collision never has a hole.
import {boundaries,contains,rectangle,clip,area,snap} from './geometry.js';
export function makeOpenings(plan,rng){plan.openings=[];
 const add=(r,kind,axis,at,u0,u1,z0,z1)=>{const o={id:plan.openings.length,room:r.id,kind,axis,at:snap(at),u0:snap(u0),u1:snap(u1),v0:snap(z0),v1:snap(z1),scene:(plan.seed+r.id)%3,sealed:true};plan.openings.push(o);return o;};
 for(const r of plan.rooms){r.skyMode=plan.features&&(r.id===1||rng()<.2)?'open':'roofed';
  if(r.skyMode==='open'){const points=r.domain.flat(2);add(r,'open-ceiling',2,r.ceilingZ,Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1])));}
  else if(plan.features&&(r.id===0||r.kind==='plain'&&rng()<.65)){
   // The centre is flat and stays clear of corner features and doorway landings.
   const floor=plan.sectors.findLast(s=>s.room===r.id&&contains(s.polygons,[r.cx,r.cy])).floor,box={x0:r.cx-4,x1:r.cx+4,y0:r.cy-4,y1:r.cy+4},polygons=[[rectangle(box)]],id=plan.sectors.length;
   plan.sectors.push({id,room:r.id,kind:'skylight-reveal',polygons,floor,ceiling:r.ceilingZ+.5,safe:true,hazard:null,bounds:[box.x0,box.y0,box.x1,box.y1]});r.sectors.push(id);add(r,'skylight',2,r.ceilingZ+.5,box.x0+1,box.x1-1,box.y0+1,box.y1-1);
  }
  if(!plan.features)continue;
  const sides=boundaries(r.domain).filter(([a,b])=>(a[0]===b[0]||a[1]===b[1])&&Math.hypot(b[0]-a[0],b[1]-a[1])>=8).filter(([a,b])=>{const box={x0:Math.min(a[0],b[0])-.2,x1:Math.max(a[0],b[0])+.2,y0:Math.min(a[1],b[1])-.2,y1:Math.max(a[1],b[1])+.2};return!plan.hallways.some(h=>area(clip.intersection(h.polygons,[[rectangle(box)]]))>.01);});
  if(sides.length&&(r.id===0||rng()<.7)){const[a,b]=sides[Math.floor(rng()*sides.length)],axis=a[0]===b[0]?0:1,k=1-axis,mid=(a[k]+b[k])/2;add(r,'window',axis,a[axis],mid-3,mid+3,r.floorZ+1.1,r.floorZ+3.8);}
 }
 plan.summary.sectors=plan.sectors.length;plan.summary.openCeilings=plan.rooms.filter(r=>r.skyMode==='open').length;plan.summary.skylights=plan.openings.filter(o=>o.kind==='skylight').length;plan.summary.windows=plan.openings.filter(o=>o.kind==='window').length;
}
export function skyOpeningAt(plan,p,normal){return plan.openings?.find(o=>Math.abs(p[o.axis]-o.at)<.015&&(!normal||Math.abs(normal[o.axis])>.9)&&p[o.axis===2?0:1-o.axis]>=o.u0-.001&&p[o.axis===2?0:1-o.axis]<=o.u1+.001&&p[o.axis===2?1:2]>=o.v0-.001&&p[o.axis===2?1:2]<=o.v1+.001);}
export function openingData(plan){const data=new Float32Array(4+64*12);if(plan.openings.length>64)throw Error('Sky portal budget exceeded.');data[0]=plan.openings.length;for(const [i,o]of plan.openings.entries())data.set([o.axis,o.at,o.u0,o.u1,o.v0,o.v1,o.scene,0,0,0,0,0],4+i*12);return data;}
