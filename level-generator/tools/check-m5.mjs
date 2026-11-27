import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {qualify,profiles,module} from './qualify.mjs';
import {createDoors,actorBounds,DOOR_TYPES} from '../doors.js';
import {createAcousticRuntime} from '../acoustics.js';
import {createSectorSound} from '../sector-sound.js';
import {skyOpeningAt} from '../openings.js';
import {ALCOVE_LIMITS,makeAlcoves} from '../architecture.js';
import {makeSectors} from '../sectors.js';
import {makeDoors} from '../doors.js';
import {makeOpenings} from '../openings.js';
import {makePlan,compileStructure,validateStructure,buildNavigation,validateRoutes} from '../generator.js';
import {createSimulation,certifySweeps} from '../engine-adapter.js';
import {clip,area,rectangle} from '../geometry.js';
const checks=[],samples=[];
for(const count of[6,9,12]){const q=await qualify(1776,count);let skyChecks=0;
 for(const o of q.plan.openings){assert.equal(o.sealed,true);const r=q.plan.rooms[o.room],p=[0,0,0],axis=o.axis;p[axis]=o.at;if(axis===2){const at=q.nav.targets.find(t=>t.kind==='room'&&t.id===r.id).point;p[0]=at[0];p[1]=at[1];if(o.kind==='skylight'){p[0]=(o.u0+o.u1)/2;p[1]=(o.v0+o.v1)/2;}}else{p[1-axis]=(o.u0+o.u1)/2;p[2]=(o.v0+o.v1)/2;}
 const inward=axis===2?-1:Math.sign((axis?r.cy:r.cx)-o.at),a=p.slice(),b=p.slice();a[axis]+=inward*3;b[axis]-=inward*3;const ray=new Float32Array(q.sim.memory.buffer,q.sim.engine_cast(...a,...b,0),8);assert.ok(ray[0]<1,'A sky opening must block projectiles');assert.ok(skyOpeningAt(q.plan,Array.from(ray.slice(4,7)),Array.from(ray.slice(1,4))),'Hit must be the declared sky boundary');assert.equal(q.sim.engine_contains(...b),0,'Sky must not expose an unsealed outside column');
 const feet=a.slice();feet[2]=axis===2?o.at-q.nav.height-.4:r.floorZ+1.15;const delta=[0,0,0];delta[axis]=-inward*6;assert.ok(q.sim.lab_box_sweep(...feet,...delta,q.nav.radius,q.nav.height)<1,'Largest Self must remain inside sealed sky boundary');skyChecks++;
 }
 for(const r of q.plan.rooms){assert.ok(r.alcoves.length<=ALCOVE_LIMITS.perRoom);let added=0;for(const id of r.alcoves){const a=q.plan.alcoves[id];assert.ok(a.depth<=ALCOVE_LIMITS.maxDepth);assert.ok(a.parent===null||q.plan.alcoves[a.parent].depth===a.depth-1);assert.ok(q.nav.targets.some(t=>t.kind==='alcove'&&t.id===id));added+=area(clip.difference(a.polygons,[[r.outline]]));}assert.ok(added<=ALCOVE_LIMITS.maxAreaPerRoom+3);if(r.terraces){const t=q.plan.sectors.filter(s=>s.room===r.id&&s.kind==='terrace');assert.equal(t.length,4);t.forEach((s,i)=>assert.equal(s.floor,r.floorZ-(i+1)*.15625));}}
 samples.push({count,skyChecks,alcoves:q.plan.alcoves.length,terracedRooms:q.plan.rooms.filter(r=>r.terraces).length});
}
checks.push('Windows, skylights and open ceilings render through sealed boundaries: actual engine rays and largest-hull sweeps cannot escape; every opening matches a real surface');
const plan=makePlan(391,9);makeAlcoves(plan,()=>0);assert.ok(plan.alcoves.some(a=>a.depth===2));makeSectors(plan,()=>.5);makeDoors(plan);makeOpenings(plan,()=>.5);const structure=compileStructure(plan);validateStructure(plan,structure);const nav=buildNavigation(plan,structure,profiles.composite);validateRoutes(nav);certifySweeps(await createSimulation(module,plan,structure),nav);assert.ok(plan.alcoves.every(a=>a.depth<=2));checks.push('A forced rare rebranch remains bounded, sealed, separated from doors/halls and fully represented in the connected clearance/LUT graph');
const q=await qualify(1776,9),door=q.plan.doors[0];for(const type of DOOR_TYPES){const p={doors:[{...door,id:0,type}]},d=createDoors(p),a=actorBounds([...door.position,door.floor+.035],q.nav.radius,q.nav.height),parts=type.startsWith('split')?2:1;for(let i=0;i<30;i++)d.update(1/120,[a]);assert.ok(d.states[0].open>.9999);let events=d.drainEvents();assert.equal(events.filter(e=>e.kind==='start').length,parts);assert.equal(events.filter(e=>e.kind==='finish').length,parts);for(let i=0;i<120;i++)d.update(1/120,[a]);assert.equal(d.drainEvents().length,0);for(let i=0;i<170;i++)d.update(1/120,[]);events=d.drainEvents();assert.equal(d.states[0].open,0);assert.equal(events.filter(e=>e.kind==='start').length,parts);assert.equal(events.filter(e=>e.kind==='finish').length,parts);d.update(.1,[a]);d.drainEvents();d.reset();assert.equal(d.drainEvents().length,0);}
const absorbed=createSectorSound(q.acoustics,createAcousticRuntime(q.acoustics),{trace:()=>({fraction:.5,normal:[0,0,-1],sky:true})});absorbed.emit('test',q.acoustics.nodes[0].position);absorbed.update(q.acoustics.nodes[0].position,.1);assert.equal(absorbed.snapshot().waves,0);assert.equal(absorbed.snapshot().reflections,0);
const reversing=createDoors({doors:[{...door,id:0,type:'split-horizontal'}]}),occupant=actorBounds([...door.position,door.floor+.035],q.nav.radius,q.nav.height);reversing.update(.25,[occupant]);reversing.drainEvents();for(let i=0;i<125;i++)reversing.update(1/120,[]);const closing=reversing.drainEvents();assert.ok(closing.some(e=>e.direction==='closing'&&e.kind==='start'));reversing.update(1/120,[occupant]);const reversal=reversing.drainEvents();assert.ok(reversal.every(e=>e.kind==='start'&&e.direction==='opening'));assert.equal(reversing.states[0].mode,'opening');
checks.push('All four door types open in 0.25 seconds, emit exactly start/finish per leaf for each stroke, stay quiet while parked, handle reversal without a false finish and clear queued events on reset');checks.push('Sky hits absorb sample waves without adding reflections');
await mkdir('.local/level-generator-checks',{recursive:true});const report={passed:true,checks,samples,limits:ALCOVE_LIMITS};await writeFile('.local/level-generator-checks/m5-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
