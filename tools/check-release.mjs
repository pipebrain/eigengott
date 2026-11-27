import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VERSION,PRESET} from '../game/preset.js';
import {chooseCohort} from '../playable-test/cohort.js';
assert.equal(VERSION,'0.1.4');
const expected={fixedResolution:true,chunkyEffects:true,freeRecomposition:true,randomWorkload:true,progression:true,startingWeapon:3,offscreenLoss:.1,selfCount:6174,model:'smarine',skin:'default',injuryOpacity:.67,armorOpacity:.33,hitOpacity:1,enemyDamage:.25,retaliationBias:2,botCountRandom:true,botCountMin:1,botCountMax:7,skill:2,outSeconds:2.5,backSeconds:2.5,turnSeconds:10,heightDeviation:4,darkFraction:.1,skyCoverage:.33,skyScroll:.5,skyParallax:.5,dynamicIntensity:1.5,skyEmission:.65,waveGlow:1,waveVolume:.33,halfLife:6,stretch:3,resolution:480,uiLoop:false,uiMetrics:true,uiKills:false,uiLog:false};assert.deepEqual(PRESET,expected);
const buckets=new Array(7).fill(0);for(let i=0;i<700;i++)buckets[chooseCohort(PRESET,31,()=>i/700)-1]++;assert.deepEqual(buckets,new Array(7).fill(100));assert.equal(chooseCohort(PRESET,2,()=>.999),2);assert.equal(chooseCohort(PRESET,0),0);assert.equal(chooseCohort({...PRESET,botCountRandom:false,botCount:3},31),3);
const catalog=JSON.parse(await readFile(new URL('../encounter-test/assets/catalog.json',import.meta.url)));assert.ok(catalog.characters.find(c=>c.id==='smarine').skins.includes('default'));

const {chooseArena}=await import('../playable-test/cohort.js');for(const [profile,lo,hi]of [[0,1,3],[1,3,7],[2,3,15]]){for(const limit of [0,.999999]){const rng=[(profile+.1)/3,limit];const a=chooseArena(PRESET,6173,0,true,()=>rng.shift());assert.equal(a.profile,profile);assert.equal(a.botCount,limit===0?lo:hi);assert.equal(chooseArena(PRESET,1,profile,false,()=>limit).botCount,1);}}

console.log(JSON.stringify({passed:true,version:VERSION,checks:['Exact v0.1.4 release preset and existing S_Marine default skin','Small 1–3, Medium 3–7 and Large 3–15 inclusive cohorts, finite-population cap and fixed-count comparison']},null,2));
