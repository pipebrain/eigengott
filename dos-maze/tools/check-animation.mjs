import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Animation,stateAt,hash} from '../animation.js';
import {PROFILE} from '../profile.js';
import {Flicker,stateAt as oldStateAt} from '../../vector-labyrinth/animation.js';
import {Hierarchy} from '../../vector-labyrinth/hierarchy.js';
import {defaults} from '../../vector-labyrinth/settings.js';
const s=defaults(),old=new Flicker(hash(s.seed^0x9e3779b9)),hierarchy=new Hierarchy(),slim=new Animation();
let redraw=0,frames=0;
for(let i=0;i<7200;i++){
  const time=i/60,state=stateAt(time),flicker=old.update(time,true,s.mazeHardRate,s.mazeHardDuration,s.mazeJitter,1,0,.65);
  const order=hierarchy.update(time,s,state,flicker.events,0);redraw+=flicker.events;
  slim.update(time,state);
  assert.equal(state,oldStateAt(time,s));assert.equal(slim.opacity,flicker.opacity);
  assert.equal(slim.redraw,redraw);assert.equal(slim.salt,order.orderSeed);assert.deepEqual(Array.from(slim.order),order.order);
  assert.equal(slim.seed,redraw?hash(s.seed^Math.imul(redraw,0x9e3779b9)):s.seed);frames++;
}
assert.equal(PROFILE.seed,s.seed);assert.equal(PROFILE.deadspace,s.deadspace);
for(const [name,key]of [['wallWidth','wallWidth'],['pathGap','pathGap'],['tracking','tracking'],['titleX','titleX'],['titleY','titleY'],['textDrift','textDrift']])assert.equal(PROFILE[name],s[key]);
const report={passed:true,frames,simulatedSeconds:120,flickerRedraws:redraw,checks:['Exact corruption cycle','Exact flicker events and opacity','Exact redraw seeds','Exact letter hierarchy across cycles and flickers']};
await writeFile(new URL('../evidence/animation-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
