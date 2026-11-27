import {clip,cleanRing,rectangle,snap,triangulate,conform,pointKey,same,Q,contains} from './geometry.js';
import {partitionSectors} from './sectors.js';
import {elevationCuts,planeFor} from './elevation.js';
const pointInside=(p,poly)=>contains([poly],p);
const edgeKey=(a,b)=>[pointKey(a),pointKey(b)].sort().join(':');

export function refineOutline(plan,polygons){
 const pts=polygons.flat(2),xs=elevationCuts(plan,'x',Math.min(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[0]))),ys=elevationCuts(plan,'y',Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[1])));
 return polygons.map(poly=>poly.map(ring=>{const r=cleanRing(ring),out=[];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],ts=[0];for(const[k,cuts]of [[0,xs],[1,ys]])if(a[k]!==b[k])for(const at of cuts){const t=(at-a[k])/(b[k]-a[k]);if(t>1e-8&&t<1-1e-8)ts.push(t);}for(const t of [...new Set(ts)].sort((a,b)=>a-b))out.push(a.map((n,k)=>snap(n+(b[k]-n)*t)));}return cleanRing(out);}));
}

export function terrainFaces(plan,polygons){
 const p=polygons.flat(2),xs=elevationCuts(plan,'x',Math.min(...p.map(p=>p[0])),Math.max(...p.map(p=>p[0]))),ys=elevationCuts(plan,'y',Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[1]))),tiles=[];
 for(let x=1;x<xs.length;x++)for(let y=1;y<ys.length;y++){const domain=clip.intersection(polygons,[rectangle({x0:xs[x-1],x1:xs[x],y0:ys[y-1],y1:ys[y]})]).map(p=>p.map(r=>cleanRing(r,true)));if(domain.length)tiles.push(...domain);}
 const parts=tiles.flatMap(tile=>partitionSectors(plan,[tile])),partition=parts.flatMap(p=>p.polygons),triangles=conform(triangulate(partition),partition),floorEdges=new Map(),faces=[];let volume=0;
 for(const t of triangles){const c=t[0].map((_,k)=>t.reduce((s,p)=>s+p[k],0)/3),fp=planeFor(plan,...c),cp=planeFor(plan,...c,true),floor=t.map(([x,y])=>[x,y,snap(fp[0]*x+fp[1]*y+fp[2])]),ceil=t.map(([x,y])=>[x,y,snap(cp[0]*x+cp[1]*y+cp[2])]),part=parts.find(p=>p.sector&&p.sector.polygons.some(poly=>pointInside(c,poly))),material=part?.sector?.hazard==='lava'?1:part?.sector?.hazard==='radiation'?2:0;
 if(ceil.some((p,i)=>p[2]<=floor[i][2]))throw Error('Sector ceiling intersects its floor.');
 volume+=Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))/2*floor.reduce((s,p,i)=>s+(ceil[i][2]-p[2])/3,0);
 faces.push({p:floor,kind:'floor',material},{p:ceil.slice().reverse(),kind:'ceiling',material:0});for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=edgeKey(a,b),edge={a,b,za:floor[i][2],zb:floor[(i+1)%3][2],ca:ceil[i][2],cb:ceil[(i+1)%3][2],material};if(!floorEdges.has(key))floorEdges.set(key,[]);floorEdges.get(key).push(edge);}}
 const wall=(e,loA,loB,hiA,hiB,role='wall',material=0)=>{if(Math.abs(loA-hiA)+Math.abs(loB-hiB)<1e-8)return;faces.push({p:[[...e.a,loA],[...e.a,hiA],[...e.b,hiB],[...e.b,loB]],kind:role,material});};
 for(const edges of floorEdges.values()){
  if(edges.length===1){const e=edges[0];wall(e,e.za,e.zb,e.ca,e.cb,'wall',e.material);}
  else if(edges.length===2){const [a,b]=edges;
   if(a.za+a.zb!==b.za+b.zb){const low=a.za+a.zb<b.za+b.zb?a:b,high=low===a?b:a;wall(low,low.za,low.zb,high.zb,high.za,'riser',low.material);}
   if(a.ca+a.cb!==b.ca+b.cb){const low=a.ca+a.cb<b.ca+b.cb?a:b,high=low===a?b:a;wall(high,low.cb,low.ca,high.ca,high.cb,'ceiling-riser');}
  }else throw new Error('Non-manifold terrain partition.');
 }
 // Every vertical boundary is split at all adjoining floor/ceiling levels.
 const levels=new Map();for(const {p}of faces)for(const v of p){const k=pointKey(v.slice(0,2));if(!levels.has(k))levels.set(k,new Map());levels.get(k).set(Math.round(v[2]*Q),v);}
 const output=[];
 for(const face of faces){const pending=[];for(let i=1;i<face.p.length-1;i++)pending.push([face.p[0],face.p[i],face.p[i+1]]);while(pending.length){const t=pending.pop();let split=false;for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],c=t[(i+2)%3];if(!same(a.slice(0,2),b.slice(0,2)))continue;for(const q of levels.get(pointKey(a.slice(0,2))).values()){if(q[2]>Math.min(a[2],b[2])+1e-8&&q[2]<Math.max(a[2],b[2])-1e-8){pending.push([a,q,c],[q,b,c]);split=true;break;}}if(split)break;}if(!split)output.push({p:t,kind:face.kind,material:face.material});}}
 return{faces:output,tileCount:partition.length,volume,cells:parts.map(p=>{const t=triangulate(p.polygons)[0],c=[0,1].map(k=>t.reduce((n,v)=>n+v[k],0)/3);return{polygons:p.polygons,sample:c,floorPlane:planeFor(plan,...c),ceilingPlane:planeFor(plan,...c,true),sector:p.sector?.id??null};})};
}
