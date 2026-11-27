import {WEAPONS} from './weapons.js';
export const MAX_LIGHTS=128,MAX_CASTERS=128,MAX_PARTICLES=256,MAX_SPRITES=512;
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const boxDistance=(b,p)=>Math.hypot(...p.map((v,i)=>Math.max(0,Math.abs(v-b.c[i])-b.h[i])));
const contains=(b,p)=>p.every((v,i)=>Math.abs(v-b.c[i])<=b.h[i]+.04);
// Event pools, emitter selection and eight nearby box casters per light are bounded.
export class Effects {
 constructor(random){this.random=random;this.particles=[];this.lights=[];this.waves=[];this.waveRevision=0;this.time=0;this.serial=0;this.dropped=0;this.casterCount=0;this.lightArray=new Float32Array(4+MAX_LIGHTS*16);this.lightIndices=new Uint32Array(this.lightArray.buffer);this.boxData=new Float32Array(MAX_CASTERS*8);}
 light(p,color,radius,intensity,ttl,priority=1){if(this.lights.length>=MAX_LIGHTS){this.lights.sort((a,b)=>a.priority-b.priority||a.born-b.born);this.lights.shift();this.dropped++;}this.lights.push({p:[...p],color:color.map(v=>v/255),radius,intensity,ttl,born:this.time,priority});}
 particle(p,velocity,color,size,ttl,kind='glow'){if(this.particles.length>=MAX_PARTICLES){this.dropped++;return;}this.particles.push({p:[...p],velocity,color:color.map(v=>v/255),size,ttl,born:this.time,kind,rotation:this.random()*Math.PI*2});}
 muzzle(p,color){this.light(p,color,3.5,2.5,.075,2);this.particle(p,[0,0,0],color,.11,.06,'flash');}
 impact(p,color,size=.1){this.light(p,color,1.5,1.2,.12,1);for(let n=0;n<5;n++)this.particle(p,[(this.random()-.5)*3,(this.random()-.5)*3,this.random()*2],color,.025,.2+this.random()*.2,'spark');this.particle(p,[0,0,.25],[150,150,145],Math.max(.1,size),.5,'smoke');}
 death(e){const p=[e.p[0],e.p[1],e.p[2]+e.height*.55];this.light(p,[155,210,195],6,3,.65,4);for(let n=0;n<48;n++)this.particle(p,[(this.random()-.5)*5,(this.random()-.5)*5,(this.random()-.3)*5],[130+this.random()*90,170+this.random()*60,170],.025+this.random()*.035,.45+this.random()*.65,n%5?'spark':'smoke');}
 advance(dt){this.time+=dt;if(this.waves.length){this.waves=this.waves.filter(w=>this.time-w.born<w.ttl);this.waveRevision++;}this.lights=this.lights.filter(l=>this.time-l.born<l.ttl);this.particles=this.particles.filter(p=>this.time-p.born<p.ttl);for(const p of this.particles){p.p=p.p.map((x,i)=>x+p.velocity[i]*dt);p.velocity=p.velocity.map(v=>v*Math.max(0,1-dt*1.3));}}
 wave(event,model){if(!['delete','insert'].includes(event.kind))return;const g=model.groups[event.gid];if(!g?.cells.length)return;const lo=Math.min(...g.cells.map(c=>c.p[2])),hi=Math.max(...g.cells.map(c=>c.ceil));this.waves.push({gid:g.id,born:this.time,ttl:.45,kind:event.kind==='delete'?3:4,c:[(g.min[0]+g.max[0])/2,(g.min[1]+g.max[1])/2,(lo+hi)/2],h:[(g.max[0]-g.min[0])/2,(g.max[1]-g.min[1])/2,(hi-lo)/2]});if(this.waves.length>32)this.waves.shift();this.waveRevision++;this.light([event.p[0],event.p[1],event.p[2]+2],[170,205,190],Math.min(8,model.tile*2),.6,.3,2);}
 waveFaces(model){if(model.phase==='turn')return [];return this.waves.flatMap((w,i)=>{const fade=1-(this.time-w.born)/w.ttl,out=[];for(const [axis,sign]of [[0,-1],[0,1],[1,-1],[1,1]]){const c=[...w.c],h=[...w.h];c[axis]+=sign*h[axis];h[axis]=.005;out.push({c,h,type:w.kind,key:i+1,fade});}return out;});}
 lightData(game,settings){
  const data=this.lightArray,indices=this.lightIndices,boxes=this.boxData;data.fill(0);boxes.fill(0);this.casterCount=0;if(!settings.dynamicLights||game.sweep?.phase==='turn')return data;
  const eye=game.player.p,list=this.lights.map(l=>({...l,intensity:l.intensity*(1-(this.time-l.born)/l.ttl)}));
  if(settings.skyboxes&&settings.skyEmission>0)for(const l of game.sweep.skyEmitters||[])if(game.sweep.states[l.gid]?.visible)list.push({...l,intensity:l.intensity*settings.skyEmission});
  if(settings.environmentLights!==false)for(const l of game.sweep?.environment||[])if(game.sweep.states[l.gid]?.visible)list.push(l);
  for(const p of game.projectiles)if(['rocket','plasma','bfg'].includes(p.kind)){const w=WEAPONS[p.weapon]||game.weapon(p.owner);list.push({p:p.p,color:w.color.map(v=>v/255),radius:3,intensity:1.4,priority:1});}
  for(const l of list)l.distance=distance(l.p,eye);list.sort((a,b)=>b.priority-a.priority||a.distance-b.distance);const active=list.slice(0,Math.min(MAX_LIGHTS,settings.lightBudget??128));data[0]=active.length;
  const casters=[];if(settings.boxShadows!==false){for(const e of game.renderEntities()){if(!e.staged)continue;const r=e.gear.radius;casters.push({c:[e.p[0],e.p[1],e.p[2]+e.height/2+.035],h:[r,r,Math.max(.01,e.height/2-.035)]});}for(const p of game.sweep?.current||[])if(p&&game.sweep.states[p.gid]?.visible)casters.push({c:p.c,h:p.h});}
  casters.sort((a,b)=>boxDistance(a,eye)-boxDistance(b,eye));casters.length=Math.min(casters.length,MAX_CASTERS);this.casterCount=casters.length;data[1]=casters.length;casters.forEach((b,i)=>boxes.set([...b.c.map((v,k)=>v-b.h[k]),0,...b.c.map((v,k)=>v+b.h[k]),0],i*8));
  active.forEach((l,i)=>{const at=4+i*16;data.set([...l.p,l.radius,...l.color,l.intensity*(settings.dynamicIntensity??1)],at);const nearest=[],ranks=[];for(let id=0;id<casters.length;id++){const b=casters[id],d=boxDistance(b,l.p);if(d>=l.radius||contains(b,l.p))continue;let k=0;while(k<ranks.length&&ranks[k]<=d)k++;if(k>=8)continue;ranks.splice(k,0,d);nearest.splice(k,0,id);if(nearest.length>8){nearest.length=ranks.length=8;}}nearest.forEach((id,j)=>indices[at+8+j]=id+1);});return data;
 }
 snapshot(){return {particles:this.particles.length,lights:this.lights.length,casters:this.casterCount,waves:this.waves.length,dropped:this.dropped,time:this.time};}
}
