import {PROFILE} from './profile.js';
export function hash(x){x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return (x^(x>>>16))>>>0;}
export function stateAt(time){
  const t=((time%PROFILE.period)+PROFILE.period)%PROFILE.period,half=PROFILE.period/2;
  const x=t<half?t/half:(t-half)/half,value=x*x*(3-2*x);
  return t<half?value:1-value;
}
export class Animation{
  constructor(){this.order=new Uint32Array(9);this.reset();}
  reset(){
    this.next=Infinity;this.last=-Infinity;this.flickers=0;this.hierarchyEvents=0;this.shuffle=0;
    this.redraw=0;this.time=-1;this.salt=-1;this.opacity=1;this.started=false;
  }
  update(time,state,automatic=true,flicker=true){
    if(time<this.time)this.reset();this.time=time;
    const seed=hash(PROFILE.seed^0x9e3779b9);
    const interval=()=>1/PROFILE.mazeHardRate*(1+(hash(seed+this.flickers*13)/4294967296-.5)*PROFILE.mazeJitter*1.5);
    if(!this.started){this.started=true;this.next=flicker?time+interval():Infinity;}
    let events=0;
    while(time>=this.next&&events<32){
      this.last=this.next;this.flickers++;events++;this.redraw++;this.hierarchyEvents++;
      const random=hash(PROFILE.seed^Math.imul(this.hierarchyEvents,0x318f127));
      if(random/4294967296<PROFILE.hierarchyChance)this.shuffle=hash(random+93);
      this.next+=interval();
    }
    if(events&&time-this.last>PROFILE.mazeHardDuration/1000)this.last=time;
    this.opacity=flicker&&time-this.last<PROFILE.mazeHardDuration/1000?0:1;
    const cycle=automatic?Math.floor(time/PROFILE.period):0;
    const salt=state<.000001?0:(hash(PROFILE.seed^Math.imul(cycle+1,0x9e3779b9))^this.shuffle)>>>0;
    if(salt!==this.salt){
      this.salt=salt;for(let i=0;i<9;i++)this.order[i]=i;
      if(salt)this.order.sort((a,b)=>hash(salt+a*1777)-hash(salt+b*1777));
    }
    return events;
  }
  get seed(){return this.redraw===0?PROFILE.seed:hash(PROFILE.seed^Math.imul(this.redraw,0x9e3779b9));}
}
