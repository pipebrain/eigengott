export const MAX_LIGHTS=32,MAX_PARTICLES=256,MAX_SPRITES=512;
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
// Fixed-capacity, simulation-timed effects; presentation continues through death.
export class Effects {
 constructor(random){this.random=random;this.particles=[];this.lights=[];this.time=0;this.serial=0;this.dropped=0;}
 light(p,color,radius,intensity,ttl,priority=1){if(this.lights.length>=MAX_LIGHTS){this.lights.sort((a,b)=>a.priority-b.priority||a.born-b.born);this.lights.shift();this.dropped++;}this.lights.push({p:[...p],color:color.map(v=>v/255),radius,intensity,ttl,born:this.time,priority});}
 particle(p,velocity,color,size,ttl,kind='glow'){if(this.particles.length>=MAX_PARTICLES){this.dropped++;return;}this.particles.push({p:[...p],velocity,color:color.map(v=>v/255),size,ttl,born:this.time,kind,rotation:this.random()*Math.PI*2});}
 muzzle(p,color){this.light(p,color,3.5,2.5,.075,2);this.particle(p,[0,0,0],color,.11,.06,'flash');}
 impact(p,color,size=.1){this.light(p,color,1.5,1.2,.12,1);for(let n=0;n<5;n++)this.particle(p,[(this.random()-.5)*3,(this.random()-.5)*3,this.random()*2],color,.025,.2+this.random()*.2,'spark');this.particle(p,[0,0,.25],[150,150,145],Math.max(.1,size),.5,'smoke');}
 death(e){const p=[e.p[0],e.p[1],e.p[2]+e.height*.55];this.light(p,[155,210,195],6,3,.65,4);for(let n=0;n<48;n++)this.particle(p,[(this.random()-.5)*5,(this.random()-.5)*5,(this.random()-.3)*5],[130+this.random()*90,170+this.random()*60,170],.025+this.random()*.035,.45+this.random()*.65,n%5?'spark':'smoke');}
 advance(dt){this.time+=dt;this.lights=this.lights.filter(l=>this.time-l.born<l.ttl);this.particles=this.particles.filter(p=>this.time-p.born<p.ttl);for(const p of this.particles){p.p=p.p.map((x,i)=>x+p.velocity[i]*dt);p.velocity=p.velocity.map(v=>v*Math.max(0,1-dt*1.3));}}
 lightData(game,settings){const data=new Float32Array(4+MAX_LIGHTS*8);if(!settings.dynamicLights)return data;const eye=game.player.p,list=this.lights.map(l=>({...l,intensity:l.intensity*(1-(this.time-l.born)/l.ttl)}));for(const p of game.projectiles)if(['rocket','plasma','bfg'].includes(p.kind)){const w=game.weapon(p.owner);list.push({p:p.p,color:w.color.map(v=>v/255),radius:3,intensity:1.4,priority:1});}list.sort((a,b)=>b.priority-a.priority||distance(a.p,eye)-distance(b.p,eye));const active=list.slice(0,Math.min(MAX_LIGHTS,settings.lightBudget||16));data[0]=active.length;active.forEach((l,i)=>data.set([...l.p,l.radius,...l.color,l.intensity*(settings.dynamicIntensity??1)],4+i*8));return data;}
 snapshot(){return {particles:this.particles.length,lights:this.lights.length,dropped:this.dropped,time:this.time};}
}
