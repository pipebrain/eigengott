import assert from 'node:assert/strict';
import {createAcousticRuntime,propagate,wallReflections,validateAcoustics,locateAcousticNode} from '../acoustics.js';
import {qualify} from './qualify.mjs';
const checks=[];
const chain={schema:1,defaultStages:3,maxStages:8,referenceDistance:1,speedOfSound:343,corridorLossDb:6,nodes:Array.from({length:9},(_,i)=>({id:String(i),kind:i%2?'corridor':'room',position:[i*5,0,1.5],reflectionWalls:[]})),edges:Array.from({length:9},()=>[]),portals:[]};
for(let i=1;i<9;i++){const portal=chain.portals.length;chain.portals.push({position:[i*5-2.5,0,1.5]});for(const[a,b]of[[i-1,i],[i,i-1]])chain.edges[a].push({to:b,portal,distance:5,lossDb:3});}
chain.precomputed=chain.nodes.map((_,i)=>propagate(chain,i,3));validateAcoustics(chain);
const engine=createAcousticRuntime(chain),near=engine.evaluate({sourceNode:0,listenerNode:6}),far=engine.evaluate({sourceNode:0,listenerNode:8});
assert.equal(near.audible,true);assert.equal(near.transitions,6);assert.equal(near.lossDb,18);assert.equal(near.distance,30);assert.ok(Math.abs(near.energyGain-1/900*10**(-1.8))<1e-12);assert.equal(far.audible,false);assert.equal(near.reflections.length,0);assert.ok(near.expansions<=near.stateBudget);
assert.equal(engine.evaluate({sourceNode:0,listenerNode:8,maxStages:4}).audible,true);assert.equal(engine.evaluate({sourceNode:0,listenerNode:2,maxStages:0}).audible,false);
checks.push('Exactly three room/corridor/room stages (six transitions), per-corridor loss, travel delay, hard cutoff and bounded cycle expansion');
const sample=d=>engine.evaluate({sourceNode:0,listenerNode:0,sourcePosition:[0,0,1.5],listenerPosition:[d,0,1.5]});assert.equal(sample(2).energyGain/sample(4).energyGain,4);assert.equal(sample(2).gain/sample(4).gain,2);assert.equal(sample(0).gain,1);
for(let stage=0;stage<=8;stage++)for(let source=0;source<9;source++){const r=engine.evaluate({sourceNode:source,listenerNode:8,maxStages:stage});assert.ok(!r.audible||r.gain>=0&&r.gain<=1);assert.ok(r.expansions<=r.stateBudget);}
assert.ok(engine.snapshot().cachedSources<=engine.snapshot().cacheBudget);for(const maxStages of[-1,9,.5,NaN])assert.throws(()=>engine.evaluate({sourceNode:0,listenerNode:1,maxStages}));assert.throws(()=>engine.evaluate({sourceNode:0,listenerNode:1,referenceDistance:0}));assert.equal(engine.evaluate({sourceNode:'unknown',listenerNode:1}).audible,false);
checks.push('Inverse-square intensity, correct amplitude conversion, finite near-field gain and bounded cache for configurable limits');
const square=[[[[0,0],[10,0],[10,10],[0,10]]]],boundary=[[[0,0],[10,0]],[[10,0],[10,10]],[[10,10],[0,10]],[[0,10],[0,0]]],normal=[[0,1,0],[-1,0,0],[0,-1,0],[1,0,0]];
const box={referenceDistance:1,speedOfSound:343,polygons:square,boundary,nodes:[{kind:'room',reflectionWalls:boundary.map(([a,b],i)=>({a:[...a,0],b:[...b,0],normal:normal[i],bottom:0,top:3,energyReflectance:.35}))}]};
const taps=wallReflections(box,0,[5,5,1.5],[6,5,1.5]);assert.equal(taps.length,4);assert.deepEqual(taps.map(t=>Math.round(t.distance*1e6)),[Math.round(Math.sqrt(101)*1e6),9000000,Math.round(Math.sqrt(101)*1e6),11000000]);for(const t of taps){assert.equal(t.delaySeconds,t.distance/343);assert.ok(Math.abs(t.energyGain-.35/t.distance**2)<1e-12);}
box.nodes[0].kind='corridor';assert.deepEqual(wallReflections(box,0,[5,5,1.5],[6,5,1.5]),[]);checks.push('Four finite first-order wall echoes with independently known image-source distances; corridors add no reflection voices');
const q=await qualify(1776,6),graph=q.acoustics;validateAcoustics(graph);const runtime=createAcousticRuntime(graph);
for(let a=0;a<graph.nodes.length;a++){assert.equal(locateAcousticNode(graph,graph.nodes[a].position),a);for(let b=0;b<graph.nodes.length;b++){const r=runtime.evaluate({sourceNode:a,listenerNode:b});assert.ok(r.reflections.length<=4);if(r.audible){assert.ok(r.gain<=1);assert.ok(r.reflections.every(t=>t.energyGain<=r.energyGain+1e-10));}}}
for(const room of q.plan.rooms)for(const o of room.obstacles){const c=o.outline[0].map((_,k)=>o.outline.reduce((s,p)=>s+p[k],0)/o.outline.length);assert.equal(locateAcousticNode(graph,[...c,room.floorZ+1.5]),-1);}
assert.equal(locateAcousticNode(graph,[0,0,1000]),-1);checks.push('Generated graph matches room/hallway incidence and valid navigation distances; height-aware ownership excludes cores/posts and outside space; reflection energy never exceeds the arriving direct signal');
console.log(JSON.stringify({passed:true,checks,nodes:graph.nodes.length,defaultStages:graph.defaultStages,maxReflections:4},null,2));
