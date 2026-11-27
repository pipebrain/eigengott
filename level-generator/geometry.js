// Planar boolean operations and independently checked, hole-aware triangulation.
import clip from './vendor/polygon-clipping.js';
import earcut from './vendor/earcut.js';
export {clip};
export const Q=1024, snap=x=>Math.round(x*Q)/Q||0;
export const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export const pointKey=p=>p.map(n=>Math.round(n*1e8)).join(',');
export const same=(a,b)=>pointKey(a)===pointKey(b);
export function ringArea(r){let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;}
export const area=polygons=>polygons.reduce((sum,p)=>sum+Math.abs(ringArea(p[0]))-p.slice(1).reduce((s,r)=>s+Math.abs(ringArea(r)),0),0);
export function cleanRing(r,quantize=false){const out=[];for(const p of r){const q=quantize?p.map(snap):p.slice();if(!out.length||!same(q,out.at(-1)))out.push(q);}if(out.length&&same(out[0],out.at(-1)))out.pop();return out;}
export const rectangle=r=>[[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]];
export function inRing(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if(Math.abs(cross(a,b,p))<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export const contains=(polygons,p)=>polygons.some(poly=>inRing(p,poly[0])&&!poly.slice(1).some(r=>inRing(p,r)));
export function boundaries(polygons){return polygons.flatMap(poly=>poly.flatMap(r=>{r=cleanRing(r);return r.map((p,i)=>[p,r[(i+1)%r.length]]);}));}
export function hull(points){const p=[...new Map(points.map(p=>[pointKey(p),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lower=[],upper=[];for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}for(const q of p.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
export function triangulate(polygons){
 const triangles=[];
 for(const polygon of polygons){const rings=polygon.map(r=>cleanRing(r)).filter(r=>r.length>=3),points=[],holes=[];for(let i=0;i<rings.length;i++){if(i)holes.push(points.length);points.push(...rings[i]);}const indices=earcut(points.flat(),holes,2);for(let i=0;i<indices.length;i+=3){const t=indices.slice(i,i+3).map(n=>points[n]);if(cross(...t)<0)[t[1],t[2]]=[t[2],t[1]];if(cross(...t)<=1e-10)throw new Error('Degenerate planar triangle.');triangles.push(t);}}
 // Earcut prioritizes speed; accept only an exact covering, with no overlaps.
 if(!triangles.length)throw new Error('Empty triangulation.');
 const union=clip.union(...triangles.map(t=>[t])),expected=area(polygons),sum=triangles.reduce((s,t)=>s+cross(...t)/2,0),tolerance=Math.max(1e-6,expected*1e-10);
 if(Math.abs(sum-expected)>tolerance||Math.abs(sum-area(union))>tolerance||area(clip.xor(union,polygons))>tolerance)throw new Error('Planar triangles do not exactly cover the declared domain.');
 return triangles;
}
export function conform(triangles,polygons){
 // Earcut may omit collinear ring vertices. Split every affected triangle edge
 // so a room/doorway join cannot become a false wall or an unwelded T junction.
 const vertices=[...new Map(polygons.flat(2).map(p=>[pointKey(p),p])).values()],pending=triangles.slice(),out=[];
 while(pending.length){const t=pending.pop();let split=false;outer:for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],c=t[(i+2)%3],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;for(const p of vertices){const along=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2;if(along>1e-10&&along<1-1e-10&&Math.abs(cross(a,b,p))<1e-10){pending.push([a,p,c],[p,b,c]);split=true;break outer;}}}if(!split)out.push(t);}
 return out;
}
export function erode(polygons,radius){
 // A translating AABB fits iff its centre avoids every boundary segment swept
 // by the AABB. This includes concave corners and all obstacle/void boundaries.
 const expanded=boundaries(polygons).map(edge=>[hull(edge.flatMap(([x,y])=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dy])=>[x+dx*radius,y+dy*radius])))]);
 return clip.difference(polygons,...expanded);
}
export function boxCovered(structure,x,y,r){
 if(!contains(structure.polygons,[x,y]))return false;
 const lo=[x-r+1e-8,y-r+1e-8],hi=[x+r-1e-8,y+r-1e-8];
 for(const [a,b]of structure.boundary){let enter=0,leave=1;for(let k=0;k<2;k++){const d=b[k]-a[k];if(Math.abs(d)<1e-12){if(a[k]<lo[k]||a[k]>hi[k]){enter=2;break;}}else{const u=(lo[k]-a[k])/d,v=(hi[k]-a[k])/d;enter=Math.max(enter,Math.min(u,v));leave=Math.min(leave,Math.max(u,v));}}if(enter<=leave&&enter<=1&&leave>=0)return false;}
 return true;
}
