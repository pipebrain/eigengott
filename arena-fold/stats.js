export const imports=()=>({env:{sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt}});
export function readStats(sim){
 const p=sim.fold_stats(),w=new Uint32Array(sim.memory.buffer,p,16),f=new Float32Array(sim.memory.buffer,p+64,32);
 return {clear:!!w[0],sealed:!!w[1],bounded:!!w[2],blockedPanels:w[3],blockedBy:w[4],checks:w[5],rejections:w[6],certificationNodes:w[7],deepestSubdivision:w[8],physicsSteps:w[9],contacts:w[10],blockedLooks:w[11],playing:!!w[12],enabled:!!w[13],camera:w[14],loop:!!w[15],phase:f[0],target:f[1],duration:f[2],margin:f[3],position:Array.from(f.slice(4,7)),yaw:f[7],pitch:f[8],bodyClearance:f[9],weaponClearance:f[10],time:f[11],velocity:Array.from(f.slice(12,15)),accumulator:f[15]};
}
export const bytes=(sim,kind)=>new Uint8Array(sim.memory.buffer,sim.fold_buffer(kind),sim.fold_bytes(kind));
