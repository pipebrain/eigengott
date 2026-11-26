export function hash(x){x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return (x^(x>>>16))>>>0;}
export function stateAt(time,s){
  if(!s.autoState)return s.manualState;
  const holds=s.stableHold+s.chaosHold;
  const factor=holds>s.period-.5?(s.period-.5)/holds:1;
  const stable=s.stableHold*factor,chaos=s.chaosHold*factor,travel=(s.period-stable-chaos)/2;
  const t=((time%s.period)+s.period)%s.period;
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  let amount;
  if(t<stable)amount=0;
  else if(t<stable+travel)amount=smooth((t-stable)/travel);
  else if(t<stable+travel+chaos)amount=1;
  else amount=1-smooth((t-stable-travel-chaos)/travel);
  return s.minState+(s.maxState-s.minState)*amount;
}
export class Flicker{
  constructor(seed){this.seed=seed;this.reset();}
  reset(){this.next=Infinity;this.last=-Infinity;this.serial=0;this.key='';this.previousTime=-1;}
  update(time,enabled,rate,duration,jitter,hardAmount,pulseAmount,pulseRate){
    const key=`${enabled}/${rate}/${jitter}`;
    if(time<this.previousTime)this.reset();this.previousTime=time;
    const interval=()=>1/Math.max(rate,.001)*(1+(hash(this.seed+this.serial*13)/4294967296-.5)*jitter*1.5);
    if(key!==this.key){this.key=key;this.next=enabled&&rate>0?time+interval():Infinity;this.last=-Infinity;}
    let events=0;
    while(time>=this.next&&events<32){this.last=this.next;this.serial++;events++;this.next+=interval();}
    if(events&&time-this.last>duration/1000)this.last=time; // Preserve short dropouts on slow frames.
    const on=time-this.last<duration/1000;
    const hard=on?1-hardAmount:1;
    const soft=1-pulseAmount*(.5+.5*Math.sin(time*pulseRate*Math.PI*2+this.seed*.001));
    return {opacity:enabled?hard*soft:1,events:enabled&&hardAmount>0?events:0};
  }
}
