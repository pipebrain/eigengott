export const imports=()=>({env:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt}});
export const bytes=(sim,kind)=>new Uint8Array(sim.memory.buffer,sim.fold_buffer(kind),sim.fold_bytes(kind));
export function readStats(sim){
 const p=sim.fold_stats(),w=new Uint32Array(sim.memory.buffer,p,32),f=new Float32Array(sim.memory.buffer,p+128,32);
 return {clear:!!w[0],sealed:!!w[1],catalogValid:!!w[2],active:!!w[3],playing:!!w[4],cycle:w[5],completed:w[6],visited:w[7],changed:w[8],protected:w[9],pending:w[10],bodies:!!w[11],bodyClears:w[12],previews:w[13],previewBlocks:w[14],physicsSteps:w[15],meshRevision:w[16],camera:w[17],enabled:!!w[18],loop:!!w[19],waveTick:w[20],eventCount:w[21],oldestAge:w[22],colliders:w[23],instigators:w[24],flickering:w[25],stageBodies:!!w[26],seed:w[27],blockedLooks:w[28],position:Array.from(f.slice(0,3)),yaw:f[3],pitch:f[4],time:f[5],waveTime:f[6],effectiveSpread:f[7],coherence:f[8],margin:f[9],velocity:Array.from(f.slice(10,13)),accumulator:f[13]};
}
export function readSectors(sim){
 const data=new Uint32Array(sim.memory.buffer,sim.wave_sectors(),20*16),out=[];
 for(let id=0;id<20;id++){const s=data.subarray(id*16,id*16+16);out.push({id:s[0],variant:s[1],visible:s[2]|0,state:s[3],parent:s[4]|0,depth:s[5],age:s[6],epoch:s[7],instigator:!!s[8],slot:s[9],due:s[10],start:s[11],finish:s[12],target:s[13],protectedBy:s[14]});}return out;
}
export function readEvents(sim){
 const count=readStats(sim).eventCount,data=new Uint32Array(sim.memory.buffer,sim.wave_events(),256*6),out=[];
 for(let n=Math.max(0,count-256);n<count;n++){const s=data.subarray((n%256)*6,(n%256)*6+6);out.push({wave:s[0],tick:s[1],sector:s[2],kind:s[3],variant:s[4]|0,parent:s[5]|0});}return out;
}
