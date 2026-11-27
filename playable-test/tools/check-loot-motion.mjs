import assert from 'node:assert/strict';
import {createLootMotion} from '../loot-motion.js';
import {labelGeometry} from '../loot-labels.js';
const glyphs=new Map([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'].map(c=>[c,{aspect:.4,u:0,v:0,w:.1,h:.1}]));
const names=['SUPER SHOTGUN','HEAVY ARMOR','LIGHTNING GUN','BFG 10000','GRENADE LAUNCHER'];let samples=0,collisions=0;
for(const [width,height]of [[1376,768],[390,844],[320,568],[844,390]])for(let count=1;count<=5;count++){
 const motion=createLootMotion(),items=Array.from({length:count},(_,i)=>({id:String(i)}));let first;
 for(let frame=0;frame<3600;frame++){
  const views=motion.views(items,frame/120,width,height).map((v,i)=>({...v,label:names[i]}));first??=views;
  for(const a of views){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=1&&a.y+a.h<=1);assert.ok(Math.abs(a.w*width-a.h*height)<1e-6);}
  for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){const a=views[i],b=views[j];assert.ok(!(a.x<b.x+b.w-1e-5&&a.x+a.w>b.x+1e-5&&a.y<b.y+b.h-1e-5&&a.y+a.h>b.y+1e-5));}
  const {labels,segments}=labelGeometry(views,width,height,glyphs);assert.equal(labels.length,count);assert.equal(segments.length,count*10);
  for(const a of labels){assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=width&&a.y+a.height<=height);assert.equal(a.leader.length,2);assert.deepEqual(a.leader[0].slice(2),a.leader[1].slice(0,2));}
  for(const segment of segments){assert.ok(segment.every(Number.isInteger));assert.ok(segment[0]===segment[2]||segment[1]===segment[3]);}
  for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){const a=labels[i],b=labels[j];assert.ok(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y));}
  if(frame===3599)assert.notDeepEqual(views,first);samples++;
 }collisions+=motion.snapshot().collisions;
}
assert.ok(collisions>0);console.log(JSON.stringify({passed:true,samples,collisions,checks:['Square item bounds drift, collide, separate and remain on screen for 30 seconds across 1–5 items and four viewport shapes','Labels stay distinct while drifting near items; corner boxes and two-segment leaders use integer orthogonal geometry']},null,2));
