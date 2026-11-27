import {snap,rectangle,clip} from './geometry.js';
export const GENERATOR_VERSION='m2.0';
export function random(seed){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const key=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(':');
export function makePlan(seed,count=9,{widthOverride=null,features=true}={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Seed must be an unsigned 32-bit integer.');
 if(![6,9,12].includes(count))throw new Error('Choose 6, 9 or 12 rooms.');
 if(widthOverride!==null&&(!Number.isFinite(widthOverride)||widthOverride<4||widthOverride>12))throw new Error('Corridor width must be within 4–12 m.');
 const rng=random(seed),cols=count===12?4:3,rows=count/cols,spacing=52,rooms=[],snake=[];
 for(let y=0;y<rows;y++)for(let c=0;c<cols;c++){const x=y%2?cols-1-c:c;snake.push(y*cols+x);}
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const w=snap(28+rng()*8),h=snap(28+rng()*8),cx=(x-(cols-1)/2)*spacing,cy=(y-(rows-1)/2)*spacing;rooms.push({id:y*cols+x,name:'Room '+(y*cols+x+1),x0:snap(cx-w/2),x1:snap(cx+w/2),y0:snap(cy-h/2),y1:snap(cy+h/2),cx,cy,grid:[x,y],hallways:[]});}
 const links=[],linked=new Set(),mainCount=Math.ceil(count*.6),main=snake.slice(0,mainCount),attached=new Set(main);
 const link=(a,b,type)=>{const k=key(a,b);if(linked.has(k))return;linked.add(k);links.push({a,b,type});};
 for(let i=1;i<main.length;i++)link(main[i-1],main[i],'main');
 const adjacent=(a,b)=>Math.abs(rooms[a].grid[0]-rooms[b].grid[0])+Math.abs(rooms[a].grid[1]-rooms[b].grid[1])===1;
 const remaining=new Set(snake.slice(mainCount));while(remaining.size){const candidates=[];for(const id of remaining)for(const other of attached)if(adjacent(id,other))candidates.push([id,other]);if(!candidates.length)throw new Error('Cannot attach branch.');const [id,other]=candidates[Math.floor(rng()*candidates.length)];link(id,other,'branch');attached.add(id);remaining.delete(id);}
 const loops=[];for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)if(adjacent(a,b)&&!linked.has(key(a,b)))loops.push([a,b]);
 for(let n=0;n<Math.min(count===6?1:2,loops.length);n++){const at=Math.floor(rng()*loops.length),[a,b]=loops.splice(at,1)[0];link(a,b,'loop');}
 const hallways=links.map((e,id)=>{
  const width=widthOverride??snap(4+rng()*8),r=width/2;let a=rooms[e.a],b=rooms[e.b],points;
  if(a.grid[1]===b.grid[1]){if(a.cx>b.cx)[a,b]=[b,a];const offset=Math.min(width*.62+.6,(a.y1-a.y0)/2-r-.5,(b.y1-b.y0)/2-r-.5)*(rng()<.5?-1:1),mid=snap((a.x1+b.x0)/2);points=[[a.x1,snap(a.cy+offset)],[mid,snap(a.cy+offset)],[mid,snap(b.cy-offset)],[b.x0,snap(b.cy-offset)]];}
  else{if(a.cy>b.cy)[a,b]=[b,a];const offset=Math.min(width*.62+.6,(a.x1-a.x0)/2-r-.5,(b.x1-b.x0)/2-r-.5)*(rng()<.5?-1:1),mid=snap((a.y1+b.y0)/2);points=[[snap(a.cx+offset),a.y1],[snap(a.cx+offset),mid],[snap(b.cx-offset),mid],[snap(b.cx-offset),b.y0]];}
  const rects=[];for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i];if(p[1]===q[1]){const y0=snap(p[1]-r);rects.push({x0:snap(Math.min(p[0],q[0])-r),x1:snap(Math.max(p[0],q[0])+r),y0,y1:snap(y0+width)});}else{const x0=snap(p[0]-r);rects.push({x0,x1:snap(x0+width),y0:snap(Math.min(p[1],q[1])-r),y1:snap(Math.max(p[1],q[1])+r)});}}
  rooms[e.a].hallways.push(id);rooms[e.b].hallways.push(id);return{id,name:'Hallway '+(id+1),a:e.a,b:e.b,type:e.type,width,points,rects};
 });
 const plan={seed,count,cols,rows,rooms,hallways,main,ceiling:5.5,version:GENERATOR_VERSION,features};
 addShapes(plan,rng);return plan;
}

function roundedRoom(r){
 const radius=4,out=[];
 for(const [cx,cy,start]of [[r.x1-radius,r.y1-radius,0],[r.x0+radius,r.y1-radius,Math.PI/2],[r.x0+radius,r.y0+radius,Math.PI],[r.x1-radius,r.y0+radius,Math.PI*1.5]])
  for(let n=0;n<=3;n++){const a=start+n*Math.PI/6;out.push([snap(cx+radius*Math.cos(a)),snap(cy+radius*Math.sin(a))]);}
 return out;
}
function regular(cx,cy,radius,sides){return Array.from({length:sides},(_,i)=>{const a=i*Math.PI*2/sides;return[snap(cx+Math.cos(a)*radius),snap(cy+Math.sin(a)*radius)];});}
function addShapes(plan,rng){
 for(const r of plan.rooms){r.kind=plan.features&&r.id>0?(r.id===1||r.id===plan.count-2?'donut':r.id%3===2?'posts':'plain'):'plain';r.outline=r.kind==='donut'?roundedRoom(r):rectangle(r);r.obstacles=[];r.anchor=[r.cx,r.cy];
  if(r.kind==='donut'){const radius=snap(5+rng()*1.5);r.obstacles.push({kind:'core',outline:regular(r.cx,r.cy,radius,12)});r.anchor=[r.cx,snap((r.cy-radius+r.y0)/2)];}
  if(r.kind==='posts')for(const dx of [-6.5,6.5])r.obstacles.push({kind:'post',outline:regular(r.cx+dx,r.cy,snap(2+rng()*.6),rng()<.5?4:8)});
 }
 for(const h of plan.hallways){h.shape=plan.features&&h.id%3!==2?'curved':'dogleg';h.sectionWidths=[h.width];
  if(h.shape==='dogleg'){h.polygons=clip.union(...h.rects.map(r=>[rectangle(r)]));h.anchor=h.points[1].map((v,k)=>(v+h.points[2][k])/2);delete h.rects;continue;}
  let a=plan.rooms[h.a],b=plan.rooms[h.b];const horizontal=a.grid[1]===b.grid[1];if(horizontal?a.cx>b.cx:a.cy>b.cy)[a,b]=[b,a];
  const old=h.points,offset=horizontal?old[0][1]-a.cy:old[0][0]-a.cx;
  const start=horizontal?[a.x1-3,a.cy+offset]:[a.cx+offset,a.y1-3],end=horizontal?[b.x0+3,b.cy-offset]:[b.cx-offset,b.y0+3];
  const along=horizontal?0:1,length=end[along]-start[along],controlA=start.slice(),controlB=end.slice();controlA[along]+=length*.42;controlB[along]-=length*.42;
  const points=[],normals=[];for(let i=0;i<=12;i++){const t=i/12,u=1-t,p=start.map((v,k)=>u*u*u*v+3*u*u*t*controlA[k]+3*u*t*t*controlB[k]+t*t*t*end[k]),d=start.map((v,k)=>3*u*u*(controlA[k]-v)+6*u*t*(controlB[k]-controlA[k])+3*t*t*(end[k]-controlB[k])),len=Math.hypot(...d);points.push(p.map(snap));normals.push([-d[1]/len,d[0]/len]);}
  // Normal clearance of an axis-aligned square depends on wall orientation.
  // The 0.16 m allowance also covers chord tessellation and fixed-point snaps.
  const widths=normals.map(([nx,ny],i)=>{let projection=Math.abs(nx)+Math.abs(ny);for(const j of [i-1,i])if(j>=0&&j+1<points.length){const d=points[j+1].map((v,k)=>v-points[j][k]),len=Math.hypot(...d);projection=Math.max(projection,(Math.abs(d[0])+Math.abs(d[1]))/len);}return snap(Math.min(12,Math.max(h.width,2*1.856*projection+.16)));});
  const side=sign=>points.map((p,i)=>p.map((v,k)=>snap(v+sign*normals[i][k]*widths[i]/2)));
  delete h.rects;h.points=points;h.polygons=[[side(1).concat(side(-1).reverse())]];h.sectionWidths=widths;h.anchor=points[6];h.curve={kind:'cubic-bezier',controls:[start,controlA,controlB,end],segments:12};
 }
 plan.summary={curved:plan.hallways.filter(h=>h.shape==='curved').length,donutRooms:plan.rooms.filter(r=>r.kind==='donut').length,posts:plan.rooms.flatMap(r=>r.obstacles).filter(o=>o.kind==='post').length};
}
