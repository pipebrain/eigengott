import {sectorAt,sectorSupport} from './sectors.js';
import {snap,Q} from './geometry.js';

export const MAX_STEP=.25;
export const MAX_SLOPE=.2;
export function makeElevation(plan,rng,{elevation=true}={}){
 const axis=(count,spacing,offset)=>{
  const segments=[],ceilings=[],flights=[],landings=[];let start=-1024,z=0;
  const flat=(lo,hi,at)=>{segments.push({lo,hi,from:at,to:at,kind:'landing'});ceilings.push({lo,hi,from:at,to:at,kind:'landing'});};
  const flight=(lo,hi,from,to,kind)=>{ceilings.push({lo,hi,from,to,kind:'slope'});flights.push({lo,hi,from,to,kind});if(kind==='slope')segments.push({lo,hi,from,to,kind});else{const risers=Math.round(Math.abs(to-from)/.15625)||1,step=(to-from)/risers;for(let n=0;n<risers;n++)segments.push({lo:snap(lo+n*(hi-lo)/risers),hi:snap(lo+(n+1)*(hi-lo)/risers),from:from+step*(n+1),to:from+step*(n+1),kind});}};
  for(let i=0;i<count-1;i++){
   const centre=snap((i+.5-(count-1)/2)*spacing),kind=(i+offset)%2?'steps':'slope';
   const rise=elevation?(rng()<.35?-1:1)*[1.25,1.5625,1.875][Math.floor(rng()*3)]:0;
   const lo=centre-18,hi=centre+18;flat(start,lo,z);
   if(kind==='slope')flight(lo,hi,z,z+rise,kind);
   else {const middle=rise/2,half=8;flight(lo,centre-half,z,z+middle,kind);flat(centre-half,centre+half,z+middle);landings.push({lo:centre-half,hi:centre+half,height:z+middle,turning:true});flight(centre+half,hi,z+middle,z+rise,kind);}
   z+=rise;start=hi;
  }
  flat(start,1024,z);return{segments,ceilings,flights,landings};
 };
 plan.elevation={version:2,x:axis(plan.cols,plan.spacing,0),y:axis(plan.rows,plan.spacing,1),maxStep:MAX_STEP,maxSlope:MAX_SLOPE,clearHeight:plan.ceiling};
 for(const r of plan.rooms){r.floorZ=floorAt(plan,r.cx,r.cy);r.ceilingZ=r.floorZ+plan.ceiling;}
 plan.summary.slopes=[...plan.elevation.x.segments,...plan.elevation.y.segments].filter(s=>s.kind==='slope'&&s.from!==s.to).length;
 plan.summary.stairRisers=[plan.elevation.x,plan.elevation.y].reduce((sum,axis)=>sum+axis.segments.reduce((n,s,i)=>n+(i>0&&Math.abs(s.from-axis.segments[i-1].to)>1e-6?1:0),0),0);
}
export function axisSegment(axis,value){return axis.segments.find(s=>value>=s.lo-1e-9&&value<s.hi-1e-9)||axis.segments.at(-1);}
export function axisAt(axis,value){const s=axisSegment(axis,value);return s.from+(s.to-s.from)*(value-s.lo)/(s.hi-s.lo);}
export function baseFloorAt(plan,x,y){return axisAt(plan.elevation.x,x)+axisAt(plan.elevation.y,y);}
export function floorAt(plan,x,y){const s=sectorAt(plan,x,y);return s?s.floor:baseFloorAt(plan,x,y);}
export function ceilingAt(plan,x,y){const s=sectorAt(plan,x,y);return s?s.ceiling:axisAt({segments:plan.elevation.x.ceilings||plan.elevation.x.segments},x)+axisAt({segments:plan.elevation.y.ceilings||plan.elevation.y.segments},y)+(plan.ceiling??plan.clearHeight);}
function range(axis,lo,hi){const values=[];for(const s of axis.segments){const a=Math.max(lo,s.lo),b=Math.min(hi,s.hi);if(a>b)continue;for(const at of[a,b])values.push(s.from+(s.to-s.from)*(at-s.lo)/(s.hi-s.lo));}return[Math.min(...values),Math.max(...values)];}
export function supportHeight(plan,x,y,r){return sectorSupport(plan,x,y,r,range(plan.elevation.x,x-r,x+r)[1]+range(plan.elevation.y,y-r,y+r)[1]);}
export function headroom(plan,x,y,r){const a=range(plan.elevation.x,x-r,x+r),b=range(plan.elevation.y,y-r,y+r);return plan.ceiling+a[0]+b[0]-a[1]-b[1];}
export function planeFor(plan,x,y,ceiling=false){const s=sectorAt(plan,x,y);if(s)return[0,0,ceiling?s.ceiling:s.floor];const axis=k=>ceiling?{segments:plan.elevation[k].ceilings||plan.elevation[k].segments}:plan.elevation[k];const a=axisSegment(axis('x'),x),b=axisSegment(axis('y'),y),dx=(a.to-a.from)/(a.hi-a.lo),dy=(b.to-b.from)/(b.hi-b.lo);return[dx,dy,a.from-dx*a.lo+b.from-dy*b.lo+(ceiling?plan.ceiling:0)];}
export function elevationCuts(plan,axis,lo,hi){return[lo,...new Set([...plan.elevation[axis].segments,...(plan.elevation[axis].ceilings||[])].flatMap(s=>[s.lo,s.hi]).filter(v=>v>lo+1e-8&&v<hi-1e-8)),hi].sort((a,b)=>a-b);}
export function validateElevation(plan,profile){
 let maxRiser=0,maxGrade=0,minHeadroom=Infinity;
 for(const axis of[plan.elevation.x,plan.elevation.y])for(let i=0;i<axis.segments.length;i++){const s=axis.segments[i];if(![s.lo,s.hi,s.from,s.to].every(Number.isFinite)||s.hi<=s.lo)throw new Error('Invalid terrain interval.');maxGrade=Math.max(maxGrade,Math.abs((s.to-s.from)/(s.hi-s.lo)));if(i)maxRiser=Math.max(maxRiser,Math.abs(s.from-axis.segments[i-1].to));}
 const extrema=axis=>[...new Set([...plan.elevation[axis].segments,...(plan.elevation[axis].ceilings||[])].flatMap(s=>[s.lo,s.hi]).filter(v=>Math.abs(v)<512).flatMap(v=>[v-profile.radius,v,v+profile.radius]))];
 for(const x of extrema('x'))for(const y of extrema('y'))minHeadroom=Math.min(minHeadroom,headroom(plan,x,y,profile.radius+.012));
 if(!Number.isFinite(minHeadroom))minHeadroom=plan.ceiling;
 if(maxGrade>MAX_SLOPE+1/Q||maxRiser>MAX_STEP+1/Q||minHeadroom<profile.height+.08)throw new Error('Elevation exceeds supported grade, riser or largest-profile headroom.');
 return{maxRiser,maxGrade,minHeadroom,profileHeight:profile.height,maxSupportedStep:MAX_STEP,maxSupportedGrade:MAX_SLOPE};
}
