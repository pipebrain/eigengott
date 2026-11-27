import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {Run} from '../playable-test/run.js';
import {equipmentValue} from '../playable-test/economy.js';
import {sanitizeLoadout} from '../playable-test/equipment.js';
const options={progression:true,startingWeapon:3},checks=[];
const r=new Run(6174,null,options);
assert.equal(r.remaining,6174);assert.ok(r.selves.length<=48);assert.equal(r.loadout.weapon.weapon,3);assert.ok(r.available().every(s=>s.loadout.weapon.weapon===3));
const old=r.available().at(-1),values=Object.values(old.loadout).map(equipmentValue);
for(const e of r.available().slice(0,15))assert.equal(r.kill(e.id),true);
const before=r.exactRemaining;assert.equal(r.advanceEconomy(1),true);assert.ok(r.exactRemaining<before);assert.equal(r.advanceEconomy(1),false);
for(let i=0;i<4;i++)assert.ok(equipmentValue(Object.values(r.available().find(s=>s.id===old.id).loadout)[i])>=values[i]);
assert.equal(r.loadout.weapon.weapon,3);assert.deepEqual(new Run(2,r.checkpoint()).checkpoint(),r.checkpoint());
checks.push('6174 exact starting Selves with at most 48 materialized equipment records and shotgun-only first encounter');
const huge=new Run('1000000000000000000000000000000',null,options);
assert.equal(huge.checkpoint().population.total,'1000000000000000000000000000000');assert.ok(huge.selves.length<=48);
const killed=huge.available()[0].id;huge.kill(killed);huge.advanceEconomy(1);assert.equal(huge.kill(killed),false);assert.equal(huge.available().some(e=>e.id===killed),false);
assert.ok(JSON.stringify(huge.checkpoint()).length<100000);assert.deepEqual(new Run(2,huge.checkpoint()).checkpoint(),huge.checkpoint());
const bad=huge.checkpoint();bad.population.latent='0';assert.throws(()=>new Run(2,bad));
checks.push('Exact large counters, no resurrected identities, bounded checkpoints and validated round trips');
for(let n=2;n<12;n++){r.encounter=n;r.advanceEconomy(n);assert.ok(r.selves.length<=48);}
assert.ok(r.weapons().includes(9));const item=r.available()[0].loadout;assert.deepEqual(sanitizeLoadout(item),item);assert.ok(Object.values(item).every(v=>v.quality>=7));assert.ok(Object.values(item).filter(v=>v.mod).length<=4);
checks.push('Survivors improve equipped items once per clear; player gear still requires loot and each item retains at most one fragment');
const fullRuns=[];
for(const cohortSize of [3,7,15]){
 const run=new Run(6174,null,options),seen=new Set(),started=performance.now();let clears=0,maxRecords=0,maxCheckpointBytes=0;
 while(run.remaining>1&&clears<1000){
  run.encounter=clears+1;const prior=run.exactRemaining,cohort=run.available().slice(0,cohortSize);assert.ok(cohort.length>0);
  for(const self of cohort){assert.equal(seen.has(self.id),false);seen.add(self.id);assert.equal(run.kill(self.id),true);assert.equal(run.kill(self.id),false);}
  assert.equal(run.exactRemaining,prior-BigInt(cohort.length));
  if(run.remaining>1){run.advanceEconomy(run.encounter);const once=run.exactRemaining;assert.equal(run.advanceEconomy(run.encounter),false);assert.equal(run.exactRemaining,once);}
  assert.ok(run.exactRemaining<prior);assert.ok(run.selves.length<=48);maxRecords=Math.max(maxRecords,run.selves.length);
  const save=run.checkpoint();maxCheckpointBytes=Math.max(maxCheckpointBytes,Buffer.byteLength(JSON.stringify(save)));assert.ok(maxCheckpointBytes<100000);assert.deepEqual(new Run(2,save).checkpoint(),save);clears++;
 }
 assert.equal(run.remaining,1);assert.equal(run.available().length,0);assert.equal(run.snapshot().completed,true);assert.equal(run.total,6174);
 fullRuns.push({cohortSize,clears,actualCombatEliminations:seen.size,maxRecords,maxCheckpointBytes,elapsedMs:+(performance.now()-started).toFixed(2)});
}
checks.push('Complete 6174-to-one runs at three cohort sizes keep exact accounting, unique identities, bounded storage and restorable checkpoints');
const legacy=new Run(6022,null,options),restored=new Run(2,legacy.checkpoint());assert.equal(restored.total,6022);assert.deepEqual(restored.checkpoint(),legacy.checkpoint());
checks.push('Explicitly imported 6022-copy saves retain their population and progress; new runs use 6174');
console.log(JSON.stringify({passed:true,checks,fullRuns},null,2));
