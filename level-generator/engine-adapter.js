export const imports=()=>({env:{sin:Math.sin,cos:Math.cos,atan2:Math.atan2,sqrt:Math.sqrt,now:()=>performance.now(),progress:()=>{}}});
export async function createSimulation(module,plan,structure){
 const sim=(await WebAssembly.instantiate(module,imports())).exports;
 new Int32Array(sim.memory.buffer,sim.lab_points(),structure.points.length).set(structure.points);new Uint32Array(sim.memory.buffer,sim.lab_triangles(),structure.triangles.length).set(structure.triangles);
 const spawn=plan.rooms[0],error=sim.lab_import(structure.points.length/3,structure.triangles.length/3,plan.seed,spawn.cx,spawn.cy,plan.ceiling,structure.extent);
 if(error)throw new Error('v0.1.3 mesh import rejected: '+error);return sim;
}
export function applyProfile(sim,profile){const okay=sim.engine_equipment(profile.radius,profile.height,profile.eye??1.75,.7,.12,.2,.1,.18,1,profile.eye??1.75,1.5);if(!okay)throw new Error('Selected collision profile does not fit.');}
export function pose(sim){return Array.from(new Float32Array(sim.memory.buffer,sim.engine_pose_ptr(),20));}
export function certifySweeps(sim,nav){let sweeps=0;for(let a=0;a<nav.count;a++){const p=nav.points[a];if(!sim.lab_box_clear(...p,.035,nav.radius,nav.height))throw new Error('Waypoint does not fit live collision: '+a);for(const[b]of nav.edges[a]){const q=nav.points[b],t=sim.lab_box_sweep(...p,.035,q[0]-p[0],q[1]-p[1],0,nav.radius,nav.height);if(t<.99999)throw new Error('Waypoint edge blocked by v0.1.3 collision: '+a+' → '+b+' ('+t+')');sweeps++;}}return{sweeps,engine:'0.1.3 private snapshot',skin:'zero structural relief; original continuous SAT body sweep'};}
export function nearestNode(nav,p){let best=-1,d=Infinity;for(let i=0;i<nav.count;i++){const q=nav.points[i],n=(q[0]-p[0])**2+(q[1]-p[1])**2;if(n<d){d=n;best=i;}}return best;}
