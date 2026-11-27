import {startingLoadout,generatedLoadout,sanitizeLoadout,clone} from './equipment.js';
export class Run {
 constructor(count=13,saved=null){this.version=1;this.total=Math.max(2,Math.min(65,Math.round(count)||13));this.encounter=1;this.health=100;this.deaths=0;this.playerId='self-00001';this.loadout=startingLoadout();this.selves=Array.from({length:this.total},(_,i)=>({id:'self-'+String(i+1).padStart(5,'0'),alive:true,loadout:i?generatedLoadout(i):startingLoadout()}));if(saved)this.restore(saved);}
 restore(s){if(s.version!==1||!Array.isArray(s.selves)||s.selves.length<2||s.selves.length>65||s.selves.some((e,i)=>e.id!=='self-'+String(i+1).padStart(5,'0')||typeof e.alive!=='boolean')||!s.selves.some(e=>e.id===s.playerId&&e.alive))throw new Error('Invalid run checkpoint.');this.health=Number.isFinite(s.health)?Math.max(1,Math.min(100,s.health)):100;this.total=s.selves.length;this.playerId=s.playerId;this.encounter=Math.max(1,Math.min(1000,Math.trunc(s.encounter)||1));this.deaths=Math.max(0,Math.min(1000,Math.trunc(s.deaths)||0));this.selves=s.selves.map(e=>({id:e.id,alive:e.alive,loadout:sanitizeLoadout(e.loadout)}));this.loadout=sanitizeLoadout(s.loadout);}
 get remaining(){return this.selves.filter(s=>s.alive).length;}
 get entropy(){return Math.max(0,Math.min(1,(this.remaining-1)/(this.total-1)));}
 available(excluded=[]){return this.selves.filter(e=>e.alive&&e.id!==this.playerId&&!excluded.includes(e.id));}
 kill(id){const e=this.selves.find(s=>s.id===id);if(!e?.alive)return false;e.alive=false;return true;}
 checkpoint(){const p=this.selves.find(s=>s.id===this.playerId);if(p)p.loadout=clone(this.loadout);return {version:1,total:this.total,health:this.health,playerId:this.playerId,encounter:this.encounter,deaths:this.deaths,loadout:clone(this.loadout),selves:clone(this.selves)};}
 snapshot(){return {total:this.total,remaining:this.remaining,entropy:this.entropy,coherence:1-this.entropy,encounter:this.encounter,deaths:this.deaths,playerId:this.playerId,completed:this.remaining===1,identities:this.selves.map(s=>({id:s.id,alive:s.alive}))};}
}
