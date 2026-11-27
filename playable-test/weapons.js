// OpenArena/Quake III reference parameters converted at 32 units per metre.
// This is original runtime code; the reference files and exact upstream commits
// are listed in README.md. No QVM, BSP, AAS or legacy renderer is embedded.
export const WEAPONS=Object.freeze([
 null,
 {id:1,name:'Gauntlet',kind:'melee',damage:50,delay:.4,range:1.2,sound:'melee/fstatck.wav',color:[220,220,180]},
 {id:2,name:'Machinegun',kind:'hitscan',damage:7,delay:.1,range:256,spread:.0244,sound:'machinegun/machgf1b.wav',color:[245,220,150]},
 {id:3,name:'Shotgun',kind:'hitscan',damage:10,pellets:11,delay:1,range:256,spread:.0854,sound:'shotgun/sshotf1b.wav',color:[240,190,130]},
 {id:4,name:'Grenade launcher',kind:'grenade',damage:100,splash:100,radius:4.6875,speed:21.875,gravity:25,fuse:2.5,delay:.8,sound:'grenade/grenlf1a.wav',color:[220,160,65]},
 {id:5,name:'Rocket launcher',kind:'rocket',damage:100,splash:100,radius:3.75,speed:28.125,delay:.8,sound:'rocket/rocklf1a.wav',color:[245,115,65]},
 {id:6,name:'Lightning gun',kind:'beam',damage:8,delay:.05,range:24,sound:'lightning/lg_fire.wav',color:[145,180,255]},
 {id:7,name:'Railgun',kind:'rail',damage:100,delay:1.5,range:256,sound:'railgun/railgf1a.wav',color:[90,220,200]},
 {id:8,name:'Plasma gun',kind:'plasma',damage:20,splash:15,radius:.625,speed:62.5,delay:.1,sound:'plasma/hyprbf1a.wav',color:[100,150,255]},
 {id:9,name:'BFG',kind:'bfg',damage:100,splash:100,radius:3.75,speed:62.5,delay:.2,sound:'bfg/bfg_fire.wav',color:[100,240,130]},
 {id:10,name:'Grappling hook',kind:'hook',damage:5,speed:25,delay:.4,sound:'grapple/grapfire.wav',color:[180,195,190]},
 {id:11,name:'Nailgun',kind:'nail',damage:20,pellets:15,speed:45,spread:.061,delay:1,sound:'nailgun/wnalfire.wav',color:[170,190,210]},
 {id:12,name:'Proximity mine launcher',kind:'mine',damage:0,splash:100,radius:4.6875,speed:21.875,gravity:25,delay:.8,sound:'proxmine/wstbfire.wav',color:[235,100,85]},
 {id:13,name:'Chaingun',kind:'hitscan',damage:7,delay:.03,range:256,spread:.0732,sound:'vulcan/vulcanf1b.wav',color:[235,205,150]},
]);
export const MAX_PROJECTILES=128,MAX_BEAMS=128,MAX_IMPACTS=64,MAX_BOTS=16;
export function rayCapsule(p,q,e,extra=0){if(e.gear.boxed){let near=0,far=1;const r=e.gear.radius+extra,min=[e.p[0]-r,e.p[1]-r,e.p[2]-extra],max=[e.p[0]+r,e.p[1]+r,e.p[2]+e.height+extra];for(let k=0;k<3;k++){const d=q[k]-p[k];if(Math.abs(d)<1e-9){if(p[k]<min[k]||p[k]>max[k])return Infinity;}else{const a=(min[k]-p[k])/d,b=(max[k]-p[k])/d;near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return Infinity;}}return near<=1&&far>=0?near:Infinity;}
const r=e.gear.radius+extra,z0=e.p[2]+r,z1=e.p[2]+Math.max(r,e.height-r),d=q.map((v,i)=>v-p[i]);let best=Infinity;
 const sphere=z=>{const a=d.reduce((s,v)=>s+v*v,0),v=[p[0]-e.p[0],p[1]-e.p[1],p[2]-z],b=2*v.reduce((s,n,i)=>s+n*d[i],0),c=v.reduce((s,n)=>s+n*n,0)-r*r,disc=b*b-4*a*c;if(c<=0){best=0;return;}if(a>0&&disc>=0){const t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<=1)best=Math.min(best,t);}};
 sphere(z0);sphere(z1);const a=d[0]**2+d[1]**2,b=2*((p[0]-e.p[0])*d[0]+(p[1]-e.p[1])*d[1]),c=(p[0]-e.p[0])**2+(p[1]-e.p[1])**2-r*r,disc=b*b-4*a*c;if(a>1e-10&&disc>=0){const t=(-b-Math.sqrt(disc))/(2*a),z=p[2]+d[2]*t;if(t>=0&&t<=1&&z>=z0&&z<=z1)best=Math.min(best,t);}return best;
}
export function spreadDirection(dir,amount,random){if(!amount)return [...dir];const r=[dir[1],-dir[0],0],rl=Math.hypot(...r)||1;for(let i=0;i<3;i++)r[i]/=rl;const u=[r[1]*dir[2],-r[0]*dir[2],r[0]*dir[1]-r[1]*dir[0]],a=(random()*2-1)*amount,b=(random()*2-1)*amount,v=dir.map((n,i)=>n+r[i]*a+u[i]*b),len=Math.hypot(...v)||1;return v.map(n=>n/len);}
