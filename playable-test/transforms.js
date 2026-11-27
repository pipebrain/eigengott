export const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function multiply(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
export const point=(m,p)=>[0,1,2].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]);
export function tag(part,name,a,b,t){const rows=part.tags[name];if(!rows?.length)return identity();const x=rows[Math.min(a,rows.length-1)],y=rows[Math.min(b,rows.length-1)],v=x.map((n,i)=>n+(y[i]-n)*t),m=identity();m.splice(12,3,...v.slice(0,3));for(let c=0;c<3;c++){const vec=v.slice(3+c*3,6+c*3),len=Math.hypot(...vec)||1;for(let r=0;r<3;r++)m[c*4+r]=vec[r]/len;}return m;}
export function framePair(part,clip,time){if(!clip)return [0,0,0];let [start,count,loop,fps,reverse]=clip;count=Math.max(1,count);let f=Math.max(0,time)*Math.max(1,fps),i=Math.floor(f),t=f-i;const frame=n=>{if(n>=count)n=loop?count-loop+(n-count)%loop:count-1;if(reverse)n=count-1-n;return Math.max(0,Math.min(part.frames-1,start+n));};return [frame(i),frame(i+1),t];}
export function actorPose(asset,weapon,entity,time){
 const meta=asset.meta,anim=meta.animations,dead=entity.dead,elapsed=dead?time-entity.deathAt:time-(entity.animStart||0),speed=Math.hypot(...(entity.velocity||[0,0,0]).slice(0,2)),crouch=entity.crouched;
 const lowerClip=dead?0:!entity.grounded?18:crouch?(speed>.1?13:23):speed>.1?(speed>2?15:14):22;
 const upperClip=dead?0:time-(entity.lastShot??-100)<.35?(entity.weapon===1?8:7):time-(entity.gestureAt??-100)<2?6:entity.weapon===1?12:11;
 const lower=framePair(meta.parts.lower,anim[lowerClip],elapsed),upper=framePair(meta.parts.upper,anim[upperClip],dead?elapsed:time-(upperClip===7||upperClip===8?entity.lastShot:upperClip===6?entity.gestureAt:0));
 const scale=1/32,c=Math.cos(entity.yaw),s=Math.sin(entity.yaw),root=[s*scale,c*scale,0,0,-c*scale,s*scale,0,0,0,0,scale,0,...entity.p,1];root[14]+=asset.lift;
 const torso=multiply(root,tag(meta.parts.lower,'tag_torso',...lower));
 const pitch=dead?0:entity.pitch||0,cp=Math.cos(pitch),sp=Math.sin(pitch),tilt=[cp,0,sp,0,0,1,0,0,-sp,0,cp,0,0,0,0,1];const upperWorld=multiply(torso,tilt),head=multiply(upperWorld,tag(meta.parts.upper,'tag_head',...upper));
 const parts=[{name:'lower',matrix:root,frames:lower},{name:'upper',matrix:upperWorld,frames:upper},{name:'head',matrix:head,frames:[0,0,0]}];let gun=null,muzzle=point(upperWorld,[24,-5,-2]),direction=[Math.sin(entity.yaw)*Math.cos(pitch),Math.cos(entity.yaw)*Math.cos(pitch),Math.sin(pitch)];
 if(weapon){const matrix=multiply(upperWorld,tag(meta.parts.upper,'tag_weapon',...upper));gun={matrix,parts:[{name:'main',matrix,frames:[0,0,0]}]};const w=weapon.meta.parts;
  if(w.barrel){const roll=(time-entity.lastShot<.3)?time*25:0,cr=Math.cos(roll),sr=Math.sin(roll),rotation=[1,0,0,0,0,cr,sr,0,0,-sr,cr,0,0,0,0,1];gun.parts.push({name:'barrel',matrix:multiply(multiply(matrix,tag(w.main,'tag_barrel',0,0,0)),rotation),frames:[0,0,0]});}
  const flash=multiply(matrix,tag(w.main,'tag_flash',0,0,0));if(w.flash&&time-entity.lastShot<.06)gun.parts.push({name:'flash',matrix:flash,frames:[0,0,0],flash:true});muzzle=point(flash,[0,0,0]);direction=[matrix[0],matrix[1],matrix[2]];const len=Math.hypot(...direction)||1;direction=direction.map(v=>v/len);
 }
 return {parts,gun,muzzle,direction};
}
export function bounds(part,matrix,frame=0){if(!part.vertices)return null;const b=part.bounds[Math.min(frame,part.bounds.length-1)],p=[];for(const x of [b[0],b[3]])for(const y of [b[1],b[4]])for(const z of [b[2],b[5]])p.push(point(matrix,[x,y,z]));return [0,1,2].map(k=>[Math.min(...p.map(v=>v[k])),Math.max(...p.map(v=>v[k]))]);}
