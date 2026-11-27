export const imports=()=>({env:{sin:Math.sin,cos:Math.cos,atan2:Math.atan2,sqrt:Math.sqrt,now:()=>performance.now(),progress:()=>{}}});
export async function createSimulation(module,plan,structure){
 const sim=(await WebAssembly.instantiate(module,imports())).exports;
 new Int32Array(sim.memory.buffer,sim.lab_points(),structure.points.length).set(structure.points);new Uint32Array(sim.memory.buffer,sim.lab_triangles(),structure.triangles.length).set(structure.triangles);
 const spawn=plan.rooms[0],error=sim.lab_import(structure.points.length/3,structure.triangles.length/3,plan.seed,spawn.cx,spawn.cy,spawn.floorZ+.035,plan.ceiling,structure.extent);
 if(error)throw new Error('v0.1.3 mesh import rejected: '+error);return sim;
}
export function applyProfile(sim,profile){const okay=sim.engine_equipment(profile.radius,profile.height,profile.eye??1.75,.7,.12,.2,.1,.18,1,profile.eye??1.75,1.5);if(!okay)throw new Error('Selected collision profile does not fit.');}
export function pose(sim){return Array.from(new Float32Array(sim.memory.buffer,sim.engine_pose_ptr(),20));}
export function certifySweeps(sim,nav){
 let sweeps=0,edges=0,stairTransitions=0;
 const cast=(p,q)=>{sweeps++;return sim.lab_box_sweep(...p,...q.map((v,k)=>v-p[k]),nav.radius,nav.height)>.99999;};
 for(let a=0;a<nav.count;a++){const p=nav.points[a];if(!sim.lab_box_clear(...p,nav.radius,nav.height))throw new Error('Waypoint does not fit live collision: '+a);
  for(const[b]of nav.edges[a]){const q=nav.points[b],distance=Math.hypot(q[0]-p[0],q[1]-p[1]),ts=[0,1],steps=Math.ceil(distance/.4);for(let i=1;i<steps;i++)ts.push(i/steps);
   for(const[k,axis]of [[0,'x'],[1,'y']])if(Math.abs(q[k]-p[k])>1e-9)for(const at of nav.supportCuts[axis])for(const offset of[-nav.supportRadius,0,nav.supportRadius]){const t=(at+offset-p[k])/(q[k]-p[k]);if(t>0&&t<1){ts.push(t);if(t>1e-6)ts.push(t-1e-6);if(t<1-1e-6)ts.push(t+1e-6);}}
   let last=p;for(const t of [...new Set(ts)].sort((a,b)=>a-b)){if(t===0)continue;const at=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];at.push(sim.lab_floor(...at,nav.supportRadius)+.035);if(!sim.lab_box_clear(...at,nav.radius,nav.height))throw new Error('Terrain edge lacks body/headroom clearance: '+a+' → '+b);
    if(!cast(last,at)){if(Math.abs(last[2]-at[2])>.251)throw new Error('Terrain edge exceeds the supported step height.');const z=Math.max(last[2],at[2]),lift=[last[0],last[1],z],forward=[at[0],at[1],z];if(!cast(last,lift)||!cast(lift,forward)||!cast(forward,at))throw new Error('Terrain edge blocked by continuous collision: '+a+' → '+b);stairTransitions++;}last=at;
   }edges++;
  }
 }
 return{sweeps,edges,stairTransitions,engine:'0.1.3-based generator terrain adapter',skin:'Zero relief; continuous SAT body sweeps and bounded 0.25 m step traversal over actual terrain.'};
}
export function nearestNode(nav,p){let best=-1,d=Infinity;for(let i=0;i<nav.count;i++){const q=nav.points[i],n=(q[0]-p[0])**2+(q[1]-p[1])**2;if(n<d){d=n;best=i;}}return best;}
export function canConnect(sim,nav,from,to,profile){
 try{certifySweeps(sim,{count:2,points:[from,to],edges:[[[1,0]],[]],radius:profile.radius,height:profile.height,supportRadius:profile.radius+.006,supportCuts:nav.supportCuts});return true;}catch{return false;}
}
