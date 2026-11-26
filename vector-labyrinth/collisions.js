import {hash} from './animation.js';
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
export function quadsFromFrames(frames){
  const result=new Float32Array(frames.length/12*8);
  for(let i=0;i<frames.length/12;i++){
    const f=frames.subarray(i*12,i*12+12),turn=((Math.round(f[8])%4)+4)%4;
    for(let k=0;k<4;k++){
      let x=([-1,1,1,-1][k])*f[2]*f[4]/2,y=([-1,-1,1,1][k])*f[3]*f[5]/2;
      if(turn===1)[x,y]=[-y,x];if(turn===2)[x,y]=[-x,-y];if(turn===3)[x,y]=[y,-x];
      result.set([f[0]+f[6]+x,f[1]+f[7]+y],i*8+k*2);
    }
  }return result;
}
function bounds(q){const xs=[q[0],q[2],q[4],q[6]],ys=[q[1],q[3],q[5],q[7]];return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}
function contact(a,b,padding){
  let smallest=Infinity,point=null;
  for(const q of [a,b])for(let i=0;i<4;i++){
    const j=(i+1)%4,nx=q[j*2+1]-q[i*2+1],ny=q[i*2]-q[j*2];if(nx*nx+ny*ny<.0001)continue;
    let al=Infinity,ah=-Infinity,bl=Infinity,bh=-Infinity;
    for(let k=0;k<4;k++){const av=a[k*2]*nx+a[k*2+1]*ny,bv=b[k*2]*nx+b[k*2+1]*ny;al=Math.min(al,av);ah=Math.max(ah,av);bl=Math.min(bl,bv);bh=Math.max(bh,bv);}
    const overlap=Math.min(ah,bh)-Math.max(al,bl);if(overlap < -padding*Math.hypot(nx,ny))return null;
    const depth=overlap/Math.hypot(nx,ny);if(depth<smallest){smallest=depth;point=[(a[0]+a[2]+a[4]+a[6]+b[0]+b[2]+b[4]+b[6])/8,(a[1]+a[3]+a[5]+a[7]+b[1]+b[3]+b[5]+b[7])/8];}
  }
  // Edge intersections locate the contact region more accurately than centers.
  let sx=0,sy=0,n=0;
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    const ni=(i+1)%4,nj=(j+1)%4,ax=a[ni*2]-a[i*2],ay=a[ni*2+1]-a[i*2+1],bx=b[nj*2]-b[j*2],by=b[nj*2+1]-b[j*2+1],d=cross(ax,ay,bx,by);
    if(Math.abs(d)<.0001)continue;const px=b[j*2]-a[i*2],py=b[j*2+1]-a[i*2+1],t=cross(px,py,bx,by)/d,u=cross(px,py,ax,ay)/d;
    if(t>=0&&t<=1&&u>=0&&u<=1){sx+=a[i*2]+t*ax;sy+=a[i*2+1]+t*ay;n++;}
  }return n?[sx/n,sy/n]:point;
}
function edgeAt(q,p){let best=Infinity,edge=0;for(let i=0;i<4;i++){const j=(i+1)%4,dx=q[j*2]-q[i*2],dy=q[j*2+1]-q[i*2+1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-q[i*2])*dx+(p[1]-q[i*2+1])*dy)/length)):0,d=Math.hypot(p[0]-q[i*2]-t*dx,p[1]-q[i*2+1]-t*dy);if(d<best){best=d;edge=i;}}return edge;}
export class CollisionEdges{
  constructor(){this.reset();}
  reset(pose){
    this.serial=Number.isInteger(pose?.serial)?Math.max(0,pose.serial):0;this.decisions=0;this.contacts=new Map();this.edges=new Map();this.previousTime=-1;
    for(const entry of (Array.isArray(pose?.edges)?pose.edges:[]).slice(0,640))if(Array.isArray(entry)&&Number.isInteger(entry[0])&&entry[1]?.values?.length===4&&entry[1]?.revisions?.length===4&&[...entry[1].values,...entry[1].revisions].every(Number.isFinite))this.edges.set(entry[0],{values:entry[1].values.map(v=>Math.max(0,Math.min(1,v))),revisions:entry[1].revisions.map(v=>Math.max(0,Math.min(100000,v)))});
    for(const entry of (Array.isArray(pose?.contacts)?pose.contacts:[]).slice(0,10000))if(Array.isArray(entry)&&typeof entry[0]==='string'&&Number.isFinite(entry[1]?.time))this.contacts.set(entry[0],entry[1]);
  }
  capture(){return {serial:this.serial,edges:[...this.edges],contacts:[...this.contacts]};}
  update(time,s,state,frames,quads){
    if(time<this.previousTime)this.reset();this.previousTime=time;
    const n=frames.length/12,priorities=new Float32Array(n*4),revisions=new Float32Array(n*4),shapes=[];
    if(!n||state<.000001){this.contacts.clear();this.edges.clear();return {priorities,revisions,collisions:0,decisions:0,redraws:0};}
    const score=(kind,value)=>kind===3?.01+value*.05:.1+value*.89;
    for(let i=0;i<n;i++){
      const id=frames[i*12+9],kind=frames[i*12+10],parent=frames[i*12+11]||id,q=quads.subarray(i*8,i*8+8);
      if(!this.edges.has(id))this.edges.set(id,{values:Array.from({length:4},(_,k)=>hash(s.seed^Math.imul(parent,1777)^k*911)/4294967296),revisions:[0,0,0,0]});
      shapes.push({id,kind,parent,q,box:bounds(q),data:this.edges.get(id)});
    }
    const live=new Set(shapes.map(shape=>shape.id));for(const id of this.edges.keys())if(!live.has(id))this.edges.delete(id);
    let collisions=0,decisions=0,redraws=0;const active=new Set();
    if(s.collisionEdges)for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const a=shapes[i],b=shapes[j];if(a.parent===b.parent||a.kind===3&&b.kind===3)continue;
      const padding=s.wallWidth*.5;
      if(a.box[0]>b.box[2]+padding||a.box[2]<b.box[0]-padding||a.box[1]>b.box[3]+padding||a.box[3]<b.box[1]-padding)continue;
      const p=contact(a.q,b.q,padding);if(!p)continue;collisions++;
      const ae=edgeAt(a.q,p),be=edgeAt(b.q,p),key=a.id<b.id?`${a.id}:${b.id}`:`${b.id}:${a.id}`,old=this.contacts.get(key);active.add(key);
      const signature=a.id<b.id?`${ae}:${be}`:`${be}:${ae}`;
      if(old&&time-old.time<s.collisionHold&&old.signature===signature)continue;
      this.serial++;decisions++;
      const random=hash(s.seed^Math.imul(this.serial,0x318f127)^Math.imul(a.id,337)^b.id),keep=random/4294967296<s.collisionRetain;
      const aWasTop=score(a.kind,a.data.values[ae])>=score(b.kind,b.data.values[be]),aWins=keep?aWasTop:!aWasTop;
      const high=.65+hash(random+13)/4294967296*.35,low=hash(random+71)/4294967296*.35;
      a.data.values[ae]=aWins?high:low;b.data.values[be]=aWins?low:high;
      if(s.collisionRedraw){a.data.revisions[ae]++;b.data.revisions[be]++;redraws+=2;}
      this.contacts.set(key,{time,signature});
    }
    for(const key of this.contacts.keys())if(!active.has(key))this.contacts.delete(key);
    for(let i=0;i<n;i++)for(let k=0;k<4;k++){
      priorities[i*4+k]=s.collisionEdges?score(shapes[i].kind,shapes[i].data.values[k]):(i+1)/(n+1);
      revisions[i*4+k]=s.collisionEdges&&s.collisionRedraw?shapes[i].data.revisions[k]:0;
    }
    this.decisions+=decisions;
    return {priorities,revisions,collisions,decisions,redraws};
  }
}
