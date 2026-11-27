// At most five screen-space square bodies. Models rotate inside these boxes;
// their collision and click areas share the same dimensions.
export function createLootMotion(){
 let bodies=[],key='',width=0,height=0,last=0,acc=0,collisions=0;
 function reset(items,time,w,h){
  key=items.map(i=>i.id).join('|');width=w;height=h;last=time;acc=0;collisions=0;
  const cols=Math.min(items.length,w<h?2:3),rows=Math.ceil(items.length/cols),size=Math.min(190,(w-40)/(cols+.25),(h-60)/(rows+.35));
  bodies=items.map((item,i)=>({id:item.id,size,x:w/2+(i%cols-(cols-1)/2)*(size+12),y:h/2+(Math.floor(i/cols)-(rows-1)/2)*(size+12),vx:Math.cos(i*2.4+.3)*65,vy:Math.sin(i*2.4+.8)*55}));
 }
 function tick(dt){
  const bound=b=>{const r=b.size/2+10;for(const [p,v,max]of [['x','vx',width],['y','vy',height]]){if(b[p]<r){b[p]=r;b[v]=Math.abs(b[v]);}if(b[p]>max-r){b[p]=max-r;b[v]=-Math.abs(b[v]);}}};
  for(const b of bodies){b.x+=b.vx*dt;b.y+=b.vy*dt;bound(b);}
  for(let pass=0;pass<12;pass++){let changed=false;for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
   const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y,r=(a.size+b.size)/2+3,ox=r-Math.abs(dx),oy=r-Math.abs(dy);if(ox<=0||oy<=0)continue;
   const p=ox<oy?'x':'y',v=ox<oy?'vx':'vy',sign=(b[p]-a[p])>=0?1:-1,shift=(Math.min(ox,oy)+.001)/2;
   a[p]-=sign*shift;b[p]+=sign*shift;if((b[v]-a[v])*sign<0)[a[v],b[v]]=[b[v],a[v]];bound(a);bound(b);changed=true;collisions++;
  }if(!changed)break;}
 }
 return {views(items,time,w,h){if(!items.length){bodies=[];key='';return [];}if(key!==items.map(i=>i.id).join('|')||w!==width||h!==height||time<last)reset(items,time,w,h);acc+=Math.min(.25,Math.max(0,time-last));last=time;while(acc>=1/120){tick(1/120);acc-=1/120;}return bodies.map((b,i)=>({id:b.id,x:(b.x-b.size/2)/w,y:(b.y-b.size/2)/h,w:b.size/w,h:b.size/h,rotation:time*.32+i*.7,labelPhase:time*.7+i*2.1}));},snapshot:()=>({collisions,bodies:bodies.map(b=>({...b}))})};
}
