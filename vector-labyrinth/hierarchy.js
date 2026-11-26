import {hash} from './animation.js';
export class Hierarchy{
  constructor(){this.reset();}
  reset(pose){this.serial=Number.isInteger(pose?.serial)?Math.max(0,pose.serial):0;this.shuffle=pose?.shuffle>>>0;this.kick=Number.isFinite(pose?.kick)?Math.max(-1,Math.min(1,pose.kick)):0;}
  capture(){return {serial:this.serial,shuffle:this.shuffle,kick:this.kick};}
  update(time,s,base,mazeEvents,textEvents){
    const events=s.hierarchyTrigger==='maze'?mazeEvents:s.hierarchyTrigger==='title'?textEvents:mazeEvents+textEvents;
    for(let i=0;i<events;i++){
      this.serial++;const random=hash(s.seed^Math.imul(this.serial,0x318f127));
      if(s.hierarchyFlicker&&random/4294967296<s.hierarchyChance)this.shuffle=hash(random+93);
      if(s.flickerStateJumps)this.kick=hash(random+137)/2147483648-1;
    }
    const state=Math.max(0,Math.min(1,base+4*base*(1-base)*(s.flickerStateJumps?this.kick*s.flickerStateAmount:0)));
    const cycle=s.autoState?Math.floor(time/s.period):0,home=s.hierarchyReturn&&base<.000001;
    const salt=home?0:((s.hierarchyCycle?hash(s.seed^Math.imul(cycle+1,0x9e3779b9)):0)^(s.hierarchyFlicker?this.shuffle:0));
    const order=Array.from(s.title,(_,i)=>i).sort((a,b)=>salt?(hash(salt+a*1777)-hash(salt+b*1777)):((s.characters[a]?.priority??0)-(s.characters[b]?.priority??0)||a-b));
    return {state,order,orderSeed:salt>>>0,cycle};
  }
}
