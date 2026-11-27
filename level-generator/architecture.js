// Man-made structural expansions only. Every admitted alcove joins one room.
import {clip,rectangle,area,snap} from './geometry.js';
export const ALCOVE_LIMITS=Object.freeze({perRoom:2,maxDepth:2,repeatChance:.001,maxAreaPerRoom:180});
export function makeAlcoves(plan,rng){
 plan.alcoves=[];
 for(const r of plan.rooms){r.domain=[[r.outline,...r.obstacles.map(o=>o.outline)]];r.alcoves=[];if(!plan.features)continue;
  const candidates=[];
  for(const axis of[0,1])for(const sign of[-1,1]){const side=axis===0?(sign<0?r.x0:r.x1):(sign<0?r.y0:r.y1),across=1-axis,centre=across===0?r.cx:r.cy,width=snap(8+rng()*4),depth=snap(4+rng()*3),offset=(rng()-.5)*8,at=snap(centre+offset),box=axis===0?{x0:sign<0?side-depth:side-.25,x1:sign<0?side+.25:side+depth,y0:snap(at-width/2),y1:snap(at+width/2)}:{x0:snap(at-width/2),x1:snap(at+width/2),y0:sign<0?side-depth:side-.25,y1:sign<0?side+.25:side+depth};
   // Reject the entire wall side if it already carries any corridor entrance.
   const strip=axis===0?{x0:side-.5,x1:side+.5,y0:r.y0,y1:r.y1}:{x0:r.x0,x1:r.x1,y0:side-.5,y1:side+.5};
   if(plan.hallways.some(h=>area(clip.intersection(h.polygons,[[rectangle(strip)]]))>.01))continue;
   candidates.push({axis,sign,side,at,width,depth,box});
  }
  let usedArea=0;for(const c of candidates){if(r.alcoves.length>=ALCOVE_LIMITS.perRoom||rng()>.42)continue;
   const add=(box,depth,parent=null)=>{const polygon=rectangle(box),extra=clip.difference([[polygon]],r.domain),cost=area(extra);if(cost<1||cost+usedArea>ALCOVE_LIMITS.maxAreaPerRoom)return null;
    // Keep a structural gap to other rooms and all hallway geometry.
    const padded={x0:box.x0-2,x1:box.x1+2,y0:box.y0-2,y1:box.y1+2};if(plan.rooms.some(o=>o.id!==r.id&&area(clip.intersection([[rectangle(padded)]],[[o.outline]]))>0)||plan.hallways.some(h=>area(clip.intersection([[rectangle(padded)]],h.polygons))>0))return null;
    const id=plan.alcoves.length,anchor=[(box.x0+box.x1)/2,(box.y0+box.y1)/2],alcove={id,room:r.id,parent,depth,axis:c.axis,sign:c.sign,box,polygons:[[polygon]],anchor:anchor.map(snap)};plan.alcoves.push(alcove);r.alcoves.push(id);usedArea+=cost;r.domain=clip.union(r.domain,[[polygon]]);return alcove;};
   const first=add(c.box,1);if(first&&rng()<ALCOVE_LIMITS.repeatChance&&r.alcoves.length<ALCOVE_LIMITS.perRoom){const b={...c.box},k=c.axis===0?'x':'y',end=c.sign>0?b[k+'1']:b[k+'0'];b[k+'0']=c.sign>0?end-.25:end-4;b[k+'1']=c.sign>0?end+4:end+.25;add(b,2,first.id);}
  }
 }
 plan.summary.alcoves=plan.alcoves.length;plan.summary.rebranchedAlcoves=plan.alcoves.filter(a=>a.depth>1).length;
}
