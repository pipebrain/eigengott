import {SKY_COLORS} from './sky.js';
import {readStats} from './base-stats.js';
import {hash,makeProp,planPacket} from './packets.js';
export const PHASE={idle:0,preparing:1,outbound:2,turn:3,landing:6,inbound:4,complete:5};
export const DEFAULTS=Object.freeze({span:4,coherence:0,outSeconds:4,backSeconds:4,turnSeconds:5,margin:.3,enemyCount:4,corpses:true,loop:false,interval:2});
export function descriptors(sim,span=4){const s=readStats(sim),n=s.gridSize,tile=s.arenaWidth/n,half=s.arenaWidth/2,cols=Math.ceil(n/span),data=new DataView(sim.memory.buffer,sim.active_cells_ptr(),n*n*52),groups=Array.from({length:cols*cols},(_,id)=>{const x=id%cols,y=Math.floor(id/cols);return {id,x,y,min:[x*span*tile-half,y*span*tile-half],max:[Math.min(n,(x+1)*span)*tile-half,Math.min(n,(y+1)*span)*tile-half],cells:[],flat:null};});
 for(let id=0;id<n*n;id++){if(!data.getUint32(id*52,true))continue;const x=id%n,y=Math.floor(id/n),g=groups[Math.floor(y/span)*cols+Math.floor(x/span)],f=[0,1,2,3].map(k=>data.getFloat32(id*52+20+k*4,true)),c=[0,1,2,3].map(k=>data.getFloat32(id*52+36+k*4,true)),px=(x+.5)*tile-half,py=(y+.5)*tile-half,pz=f[0]*px+f[1]*py+f[2];const cell={id,p:[px,py,pz],size:tile,ceil:c[0]*px+c[1]*py+c[2],floor:f,dark:data.getFloat32(id*52+32,true)>.5,sky:data.getFloat32(id*52+48,true)};g.cells.push(cell);if(!g.flat&&[-1,0,1].every(dy=>[-1,0,1].every(dx=>x+dx>=0&&y+dy>=0&&x+dx<n&&y+dy<n&&data.getUint32(((y+dy)*n+x+dx)*52,true)))&&Math.abs(f[0])+Math.abs(f[1])<.45&&cell.ceil-pz>3.6)g.flat=cell;}
 return {n,tile,half,cols,groups,seed:s.seed};
}
export class Sweep {
 constructor(sim,options={}){
  this.sim=sim;this.options={...DEFAULTS,...options};Object.assign(this,descriptors(sim,this.options.span));sim.engine_group_layout(this.options.span);
  Object.assign(this,{phase:'idle',cycle:0,time:0,elapsed:0,anchor:[0,0],radius:0,maxRadius:1,selected:new Set(),protected:new Set(),fields:[],enemies:[],bodies:[],events:[],serial:0,release:0,completed:0,rejected:0,actorRevision:1,fieldRevision:1,stateRevision:1,lootOpen:false});
  const spawn=readStats(sim).position;this.current=this.groups.map(g=>g.flat&&Math.hypot(g.flat.p[0]-spawn[0],g.flat.p[1]-spawn[1])>3?makeProp(g,hash(this.seed^g.id)%6):null);this.next=this.current;this.states=this.groups.map(()=>({visible:1,select:0,epoch:0,variant:0}));this.install();
  const a=new Float32Array(sim.memory.buffer,sim.arena_buffer_ptr(5,0),sim.arena_buffer_bytes(5,0)/4);this.environment=[];for(let n=0;n<a.length;n+=8){const p=Array.from(a.slice(n,n+3)),x=Math.floor((p[0]+this.half)/this.tile),y=Math.floor((p[1]+this.half)/this.tile),gid=Math.floor(y/this.options.span)*this.cols+Math.floor(x/this.options.span);this.environment.push({p,radius:a[n+3],color:Array.from(a.slice(n+4,n+7)),intensity:a[n+7],gid,priority:0});}
  if(options.lighting){this.environment=options.lighting.environment;this.skyEmitters=options.lighting.skyEmitters;this.darkCells=this.groups.flatMap(g=>g.cells.filter(c=>c.dark));return;}
  this.darkCells=this.groups.flatMap(g=>g.cells.filter(c=>c.dark));const bound=(p,r)=>Math.max(.1,Math.min(r,...this.darkCells.map(c=>Math.hypot(p[0]-c.p[0],p[1]-c.p[1],p[2]-c.p[2]-2.5)-this.tile*.75)));for(const l of this.environment)l.radius=bound(l.p,l.radius);
  this.skyEmitters=[];for(const g of this.groups){for(const scene of [1,2,3]){const c=g.cells.find(c=>c.sky===scene);if(c){const p=[c.p[0],c.p[1],c.ceil-.3],radius=bound(p,(c.ceil-c.p[2])*1.8);this.skyEmitters.push({p,radius,color:SKY_COLORS[scene-1],intensity:6,gid:g.id,priority:0,scene});}}}this.skyEmitters.sort((a,b)=>hash(this.seed^a.gid^a.scene)-hash(this.seed^b.gid^b.scene));this.skyEmitters.length=Math.min(48,this.skyEmitters.length);

 }
 emit(kind,gid=-1,p=null){const event={id:++this.serial,cycle:this.cycle,time:this.time,kind,gid,p:p||this.point(gid)};this.events.push(event);if(this.events.length>512)this.events.shift();this.onEvent?.(event);}
 point(id){const g=this.groups[id];return g?[...((g.flat||g.cells[0])?.p||[(g.min[0]+g.max[0])/2,(g.min[1]+g.max[1])/2,0])]:[...this.anchor,this.anchorZ||1.6];}
 proxies(){return Array.from(new Float32Array(this.sim.memory.buffer,this.sim.player_proxies(),16));}
 capture(){const a=this.proxies(),margin=this.options.margin;this.protected.clear();for(const g of this.groups){if(!g.cells.length)continue;for(const k of [0,8]){const r=a[k+3]+margin,lo=[Math.min(a[k],a[k+4])-r,Math.min(a[k+1],a[k+5])-r],hi=[Math.max(a[k],a[k+4])+r,Math.max(a[k+1],a[k+5])+r];if(hi[0]>=g.min[0]&&lo[0]<=g.max[0]&&hi[1]>=g.min[1]&&lo[1]<=g.max[1])this.protected.add(g.id);}}
  if(!this.protected.size)throw new Error('No protected clump contains the equipped player.');this.fields=[];if(this.options.freeRecomposition){this.fieldRevision++;if(!this.install())throw new Error('Invalid transition props.');return;}for(const id of this.protected){const g=this.groups[id];for(const [dx,dy,axis,at,lo,hi]of [[-1,0,0,g.min[0],g.min[1],g.max[1]],[1,0,0,g.max[0],g.min[1],g.max[1]],[0,-1,1,g.min[1],g.min[0],g.max[0]],[0,1,1,g.max[1],g.min[0],g.max[0]]]){const x=g.x+dx,y=g.y+dy,next=y*this.cols+x;if(x>=0&&y>=0&&x<this.cols&&y<this.cols&&this.protected.has(next))continue;this.fields.push({c:axis===0?[at,(lo+hi)/2,6]:[(lo+hi)/2,at,6],h:axis===0?[.015,(hi-lo)/2,18]:[(hi-lo)/2,.015,18],type:1,key:this.fields.length+1});}}
  this.fieldRevision++;if(!this.install())throw new Error('Protected clump boundary intersects the equipped player.');
 }
 records(){return [...this.current.filter(p=>p&&this.states[p.gid].visible).map(p=>({...p,h:[p.h[0]*1.12,p.h[1]*1.12,p.h[2]],type:3,key:p.gid})),...this.fields];}
 install(){const list=this.records();if(list.length>2048)throw new Error('Overlay capacity exceeded.');const a=new Float32Array(this.sim.memory.buffer,this.sim.overlay_input(),list.length*8);list.forEach((b,i)=>a.set([...b.c,...b.h,b.type,b.key],i*8));return this.sim.overlay_commit(list.length)===0;}
 landingProbe(check){const list=this.current.filter(Boolean).map(p=>({...p,h:[p.h[0]*1.12,p.h[1]*1.12,p.h[2]]})),a=new Float32Array(this.sim.memory.buffer,this.sim.overlay_input(),list.length*8);list.forEach((p,i)=>a.set([...p.c,...p.h,3,p.gid],i*8));if(this.sim.overlay_commit(list.length)!==0)return false;try{return check();}finally{this.install();}}
 stageBodies(){this.bodies=[];}
 visible(id,on){this.states[id].visible=+on;this.sim.engine_group_visible(id,+on);this.stateRevision++;}
 begin(){if(!['idle','complete'].includes(this.phase))return false;this.landing=readStats(this.sim).position;this.anchor=this.landing.slice(0,2);this.anchorZ=this.landing[2]+1.58;this.capture();this.cycle++;this.phase='preparing';this.elapsed=0;this.lootOpen=false;this.enemies=[];this.emit('prepare');return true;}
 request(){return {groups:this.groups,current:this.current,seed:this.seed,cycle:this.cycle,protectedIds:[...this.protected],coherence:this.options.coherence};}
 ready(packet){
  if(this.phase!=='preparing'||packet.cycle!==this.cycle)throw new Error('Stale prepared wave.');this.next=packet.next;for(const state of this.states)state.select=0;this.selected=new Set(this.groups.filter(g=>g.cells.length).map(g=>g.id));this.distance=this.groups.map(g=>Math.hypot((g.min[0]+g.max[0])/2-this.anchor[0],(g.min[1]+g.max[1])/2-this.anchor[1]));this.maxRadius=Math.max(1,...this.distance);this.radius=this.maxRadius;
  // Randomize adjacent groups within radial bands. The landing clump is last.
  const band=this.tile*this.options.span*1.5;this.outOrder=[...this.selected].sort((a,b)=>+this.protected.has(a)-+this.protected.has(b)||Math.floor(this.distance[b]/band)-Math.floor(this.distance[a]/band)||hash(this.seed^this.cycle^a)-hash(this.seed^this.cycle^b));this.inOrder=[...this.selected].sort((a,b)=>this.distance[a]-this.distance[b]);this.spawnVisited=new Set();this.cursor=0;this.phase='outbound';this.elapsed=0;this.emit('outbound');
 }
 adoptTransition(old){
  const newLanding=readStats(this.sim).position;
  for(const key of ['cycle','time','serial','completed','release','anchorZ'])this[key]=old[key];this.anchor=[...old.anchor];this.landing=this.options.freeRecomposition?[...newLanding]:[...old.landing];this.events=old.events.slice();this.options={...old.options};if(this.options.freeRecomposition){this.landing=[...newLanding];this.anchor=newLanding.slice(0,2);this.protected=new Set();}this.protected=new Set(this.options.freeRecomposition?[]:old.protected);this.phase='turn';this.elapsed=0;this.lootOpen=true;this.structural=true;this.next=this.current;this.fields=[];this.distance=this.groups.map(g=>Math.hypot((g.min[0]+g.max[0])/2-this.anchor[0],(g.min[1]+g.max[1])/2-this.anchor[1]));this.maxRadius=Math.max(1,...this.distance);this.radius=0;this.selected=new Set(this.groups.filter(g=>g.cells.length).map(g=>g.id));this.inOrder=[...this.selected].sort((a,b)=>this.distance[a]-this.distance[b]);this.spawnVisited=new Set();for(const g of this.groups)this.visible(g.id,false);this.install();if(!this.sim.engine_void_begin(...this.landing))throw new Error('Validated replacement lost its landing anchor.');this.actorRevision++;this.fieldRevision++;
 }
 choose(){if(this.phase!=='turn'||!this.lootOpen)return false;this.startLanding();return true;}
 startLanding(){
  if(this.options.freeRecomposition){this.lootOpen=false;this.fields=[];this.phase='inbound';this.elapsed=0;this.emit('landing');this.emit('inbound');return;}
  this.lootOpen=false;this.fields=[];this.capture();for(const id of this.protected)this.visible(id,true);if(!this.install()||!this.sim.engine_void_land())throw new Error('Cannot restore the validated landing clump.');this.phase='landing';this.elapsed=0;this.fieldRevision++;this.emit('landing');
 }
 stageEnemy(gid){for(const plan of this.spawnPlan||[]){if(plan.gid!==gid||this.enemies.some(e=>e.id===plan.id))continue;const p=plan.p,r=plan.r,e={...plan,staged:true,released:false,release:0},old=this.fields.length;for(const [axis,sign]of (this.options.freeRecomposition?[]:[[0,-1],[0,1],[1,-1],[1,1]])){const c=[p[0],p[1],p[2]+1.5],h=[r,r,3];c[axis]+=sign*r;h[axis]=.015;this.fields.push({c,h,type:2,key:1000+this.enemies.length*4+this.fields.length-old});}if(!this.install()){this.fields.length=old;this.rejected++;continue;}this.enemies.push(e);this.fieldRevision++;this.actorRevision++;this.emit('enemy',gid,p);}}
 advance(dt){
  this.time+=dt;if(!['outbound','turn','landing','inbound'].includes(this.phase))return;this.elapsed+=dt;
  if(this.phase==='outbound'){
   const fraction=Math.min(1,this.elapsed/Math.min(5,this.options.outSeconds));this.radius=this.maxRadius*(1-fraction);const count=Math.floor(fraction*this.outOrder.length+1e-7);let changed=false;
   while(this.cursor<count){const id=this.outOrder[this.cursor++];this.visible(id,false);this.emit('delete',id);changed=true;}
   if(changed&&!this.install())throw new Error('Deleted geometry cannot preserve stale solid props.');
   if(fraction>=1){this.fields=[];this.fieldRevision++;this.install();if(!this.sim.engine_void_active()&&!this.sim.engine_void_begin(...this.landing))throw new Error('Invalid void landing anchor.');this.phase='turn';this.elapsed=0;this.lootOpen=true;this.emit('turn');}
  }else if(this.phase==='turn'){if(this.elapsed+1e-8>=Math.min(10,this.options.turnSeconds))this.startLanding();}
  else if(this.phase==='landing'){if(this.elapsed>=.65){this.phase='inbound';this.elapsed=0;this.emit('inbound');}}
  else{
   const fraction=Math.min(1,this.elapsed/Math.min(5,this.options.backSeconds));this.radius=this.maxRadius*fraction;
   for(const id of this.inOrder)if(!this.states[id].visible&&this.distance[id]<=this.radius+1e-7){const old=this.current[id];this.current[id]=this.next[id];this.visible(id,true);if(this.install()){Object.assign(this.states[id],{select:this.structural?0:1,epoch:this.cycle,variant:this.next[id]?.variant??((this.states[id].variant+1)%6)});}else{this.current[id]=old;this.install();this.rejected++;}this.emit('insert',id);}
   for(const id of this.inOrder)if(this.states[id].visible&&!this.spawnVisited.has(id)){this.spawnVisited.add(id);this.stageEnemy(id);}
   if(fraction>=1){for(const id of this.selected){this.visible(id,true);if(!this.protected.has(id)&&this.enemies.length<this.options.enemyCount)this.stageEnemy(id);}this.fields=[];if(this.options.freeRecomposition&&!this.ensureLanding?.())throw new Error('No validated sector can accept the returning player.');if(!this.install())throw new Error('Cannot release an invalid composed world.');this.release++;for(const e of this.enemies){e.released=true;e.release=this.release;}this.fieldRevision++;this.actorRevision++;this.phase='complete';this.completed++;this.lootOpen=false;this.elapsed=0;this.emit('release');}
  }
 }
 abort(){for(const g of this.groups)this.visible(g.id,true);this.fields=[];this.install();if(this.options.freeRecomposition)this.ensureLanding?.();else if(this.sim.engine_void_active())this.sim.engine_void_land();this.enemies=[];this.phase='idle';this.lootOpen=false;this.fieldRevision++;this.actorRevision++;this.emit('abort');}
 gpuStates(){const out=new Uint32Array(this.groups.length*4);this.states.forEach((s,i)=>out.set([s.visible,s.select,s.variant,s.epoch],i*4));return out;}
 snapshot(){return {phase:this.phase,cycle:this.cycle,completed:this.completed,anchor:[...this.anchor],landing:this.landing,void:!!this.sim.engine_void_active(),radius:this.radius,maxRadius:this.maxRadius,elapsed:this.elapsed,protected:[...this.protected],selected:this.selected.size,hidden:this.groups.filter(g=>g.cells.length&&!this.states[g.id].visible).length,oldestAge:Math.max(...this.states.map(s=>this.cycle-s.epoch)),remainingBodies:0,bodies:[],enemies:this.enemies.map(e=>({...e})),fields:this.fields.length,release:this.release,lootOpen:this.lootOpen,rejected:this.rejected,overlayCount:this.sim.overlay_count(),clumps:this.groups.length,events:this.events.slice(-64)};}
}
