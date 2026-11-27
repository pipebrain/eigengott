// All Selves use this same exposure/damage function, irrespective of controller.
import {boundaries,clip,rectangle} from './geometry.js';
const pointSegment=(p,a,b)=>{const d=b.map((v,k)=>v-a[k]),t=Math.max(0,Math.min(1,d.reduce((s,v,k)=>s+v*(p[k]-a[k]),0)/(d.reduce((s,v)=>s+v*v,0)||1)));return Math.hypot(...p.map((v,k)=>v-a[k]-t*d[k]));};
const segmentBoxDistance=(a,b,c,r)=>{const lo=[c[0]-r[0],c[1]-r[1]],hi=[c[0]+r[0],c[1]+r[1]],corners=rectangle({x0:lo[0],x1:hi[0],y0:lo[1],y1:hi[1]});let enter=0,leave=1;for(let k=0;k<2;k++){const d=b[k]-a[k];if(Math.abs(d)<1e-9){if(a[k]<lo[k]||a[k]>hi[k])enter=2;}else{const u=(lo[k]-a[k])/d,v=(hi[k]-a[k])/d;enter=Math.max(enter,Math.min(u,v));leave=Math.min(leave,Math.max(u,v));}}if(enter<=leave)return 0;return Math.min(...corners.map(p=>pointSegment(p,a,b)),...[a,b].map(p=>Math.hypot(...p.map((v,k)=>Math.max(lo[k]-v,0,v-hi[k])))));};
export function hazardDose(h,actor){
 const {centre:c,half:r}=actor,box=[[rectangle({x0:c[0]-r[0],x1:c[0]+r[0],y0:c[1]-r[1],y1:c[1]+r[1]})]],inside=clip.intersection(box,h.polygons).length>0,foot=c[2]-r[2],liquid=inside&&foot<h.floor+.15;
 const walls=h.wall?h.wall.map((a,i)=>[a,h.wall[(i+1)%h.wall.length]]):[],wallTouch=c[2]-r[2]<h.top&&c[2]+r[2]>h.floor&&walls.some(([a,b])=>segmentBoxDistance(a,b,c,r)<.04),contact=liquid||wallTouch;
 // Radiation falloff is finite-range so a zero-dose AI bypass can be certified.
 const xy=inside?0:Math.min(...boundaries(h.polygons).map(([a,b])=>segmentBoxDistance(a,b,c,r))),vertical=Math.max(0,foot-h.floor,h.floor-(c[2]+r[2])),wallDistance=walls.length?Math.hypot(Math.min(...walls.map(([a,b])=>segmentBoxDistance(a,b,c,r))),Math.max(0,foot-h.top,h.floor-(c[2]+r[2]))):Infinity,distance=Math.min(Math.hypot(xy,vertical),wallDistance);
 const radiation=h.type==='radiation'&&distance<h.radius?12*(1-distance/h.radius)**2/(1+distance*distance):0;
 return{contact,lethal:liquid&&h.fatal,heat:h.type==='lava'&&contact?45:0,radiation:h.type==='radiation'?(contact?100:radiation):0};
}
export function createHealth(seed=1){let n=seed>>>0;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return(n+.5)/4294967296;};const threshold=()=>-Math.log(random());return{health:100,dead:false,burning:0,heatExposure:0,ignitionThreshold:threshold(),randomThreshold:threshold};}
export function damageSelf(state,actor,hazards,dt){if(!(dt>=0&&dt<=.25))throw Error('Invalid hazard timestep.');if(state.dead)return state;let heat=0,radiation=0;for(const h of hazards){const dose=hazardDose(h,actor);if(dose.lethal)state.health=0;heat+=dose.heat;radiation+=dose.radiation;}
 if(heat){state.ignitionThreshold-=.2*dt+.25*(state.heatExposure*dt+.5*dt*dt);state.heatExposure+=dt;if(state.ignitionThreshold<=0){state.burning=4;state.ignitionThreshold=state.randomThreshold();}}else state.heatExposure=Math.max(0,state.heatExposure-dt*.5);
 state.health=Math.max(0,state.health-(heat+radiation+(state.burning>0?18:0))*dt);state.burning=Math.max(0,state.burning-dt);state.dead=state.health<=0;return state;
}
